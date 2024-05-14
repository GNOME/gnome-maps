/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2024 Marcus Lundblad
 *
 * GNOME Maps is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 2 of the License, or (at your
 * option) any later version.
 *
 * GNOME Maps is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>.
 *
 * Author: Marcus Lundblad <ml@dfupdate.se>
 */

import GLib from 'gi://GLib';
import GWeather from 'gi://GWeather';
import Shumate from 'gi://Shumate';
import Soup from 'gi://Soup';

import {Application} from '../application.js';
import * as GraphHopperTransit from '../graphHopperTransit.js';
import * as HVT from '../hvt.js';
import {Itinerary, Leg, RouteType, Stop} from '../transitPlan.js';
import * as Utils from '../utils.js';

const MAX_WALKING_DURATION = 1200; // 20 min
const SEARCH_INTERVAL = 4 * 60 * 60; // 4 hours
const MIN_CONNECTIONS = 5;

const Clasz = {
    AIR:            0,
    HIGH_SPEED:     1,
    LONG_DISTANCE:  2,
    COACH:          3,
    NIGHT:          4,
    REGIONAL_FAST:  5,
    REGIONAL:       6,
    METRO:          7,
    SUBWAY:         8,
    TRAM:           9,
    BUS:           10,
    SHIP:          11,
    OTHER:         12
}

export class Motis {
    constructor(params) {
        this._baseUrl = GLib.getenv('MOTIS_BASE_URL') ?? params?.baseUrl;
        this._plan = Application.routingDelegator.transitRouter.plan;
        this._query = Application.routeQuery;
        this._session =
            new Soup.Session({ user_agent : 'gnome-maps/' + pkg.version });

        if (!this._baseUrl)
            throw new Error('must specify baseUrl as an argument');
    }

    fetchFirstResults() {
        // for now, don't handle via locations
        if (this._query.filledPoints.length > 2) {
            this._plan.noRouteFound();
            return;
        }

        this._fetch();
    }

    fetchMoreResults() {
        this._fetch(true);
    }

    _fetch(extendPrevious = false) {
        const body = this._getQueryBody(extendPrevious);
        const request = Soup.Message.new_from_encoded_form('POST', this._baseUrl,
                                                         body);

        Utils.debug(`query body: ${body}`);

        request.request_headers.replace('Content-Type', 'application/json');

        this._session.send_and_read_async(request, GLib.PRIORITY_DEFAULT, null,
                                          (source, res) => {
            try {
                const buffer = this._session.send_and_read_finish(res).get_data();

                if (request.get_status() !== Soup.Status.OK) {
                    Utils.debug('Failed to get trip: ' + request.get_status());

                    this._plan.requestFailed();
                } else {
                    const result = JSON.parse(Utils.getBufferText(buffer));
                    Utils.debug('result: ' + JSON.stringify(result, null, 2));

                    this._parseResult(result, extendPrevious);
                }
            } catch (error) {
                Utils.debug('Failed to send request: ' + error.msg);
                this._plan.requestFailed();
            }
        });
    }

    _parseResult(result, extendPrevious) {
        const connections = result?.content?.connections;
        if (!Array.isArray(connections) || connections.length === 0) {
            Utils.debug('No connections in result');
            if (extendPrevious)
                this._plan.noMoreResults();
            else
                this._plan.noRouteFound();
            return;
        }

        if (connections.length === 1 && extendPrevious &&
            this._isNonTransitConnection(connections[0])) {
            this._plan.noMoreResults();
            return;
        }

        try {
            const filledPoints = this._query.filledPoints;
            const startPlace = filledPoints[0].place;
            const destinationPlace = filledPoints.last().place;
            const startTz = this._getTimezone(startPlace.location.latitude,
                                              startPlace.location.longitude);
            const destinationTz =
                this._getTimezone(destinationPlace.location.latitude,
                                  destinationPlace.location.longitude);

            /* if start and destination is in the same timezone, use this
             * timezone for all legs and stops to avoid recalculate it
             */
            const commonTz =
                startTz.get_identifier() === destinationTz.get_identifier() ?
                startTz : null;
            // filter out walking-only itinerary when extending previous result
            const itineraries =
                connections.filter((connection) => {
                                return !extendPrevious ||
                                       !this._isNonTransitConnection(connection);
                            })
                            .map(connection =>
                                this._parseConnection(connection,
                                                      startPlace,
                                                      destinationPlace,
                                                      commonTz));

            GraphHopperTransit.addWalkingToItineraries(itineraries,
                        () => this._plan.updateWithNewItineraries(itineraries,
                                                                  this._query.arriveBy,
                                                                  extendPrevious));
        } catch (error) {
            Utils.debug(`error parsing connections ${error} ${error.stack}`);
            this._plan.requestFailed();
        }
    }

    _isNonTransitConnection(connection) {
        return connection.transports.length === 1 &&
               connection.transports[0].move_type === 'Walk';
    }

    _parseConnection(connection, startPlace, destinationPlace, commonTz) {
        const departure = connection.stops[0].departure.time;
        const arrival = connection.stops.last().arrival.time;
        /* use common timezone offset if the same timezone is in effect
         * for the departure and arrival, calculate it once to avoid
         * recalculate it for each stop
         */
        const departureTimezoneOffset =
            this._getTimezoneOffset(departure,
                                    commonTz ??
                                    this._getTimezone(startPlace.location.latitude,
                                                      startPlace.location.longitude));
        const arrivalTimezoneOffset =
            this._getTimezoneOffset(arrival,
                                    commonTz ??
                                    this._getTimezone(destinationPlace.location.latitude,
                                                      destinationPlace.location.longitude));
        const commonTimezoneOffset =
            departureTimezoneOffset === arrivalTimezoneOffset ?
            departureTimezoneOffset * 1000 : null;
        const stops = connection.stops.map(stop =>
                                           this._parseStop(stop,
                                                           startPlace,
                                                           destinationPlace,
                                                           commonTimezoneOffset));
        const legs = connection.transports.map(transport =>
                                               this._parseTransport(transport,
                                                                    stops,
                                                                    startPlace,
                                                                    destinationPlace));
        const firstLeg = legs[0];
        const lastLeg = legs.last();
        const duration = arrival - departure;

        return new Itinerary({ departure:               firstLeg.departure,
                               departureTimezoneOffset: firstLeg.departureTimezoneOffset,
                               arrival:                 lastLeg.arrival,
                               arrivalTimezoneOffset:   lastLeg.arrivalTimezoneOffset,
                               duration:                duration,
                               legs:                    legs });
    }

    _getStraightDistance(from, to) {
        const fromCoord =
            new Shumate.Coordinate({ latitude:  from.coordinate[0],
                                     longitude: from.coordinate[1] });
        const toCoord =
            new Shumate.Coordinate({ latitude:  to.coordinate[0],
                                     longitude: to.coordinate[1] });

        return fromCoord.distance(toCoord);
    }

    _parseTransport(transport, stops, startPlace, destinationPlace) {
        const fromIndex = transport.move.range.from;
        const toIndex = transport.move.range.to;
        const isTransit = transport.move_type === 'Transport';
        const from = stops[fromIndex];
        const to = stops[toIndex];
        const departure = from.departure;
        const arrival = to.arrival;
        const intermediateStops =
            isTransit ? stops.slice(fromIndex + 1, toIndex + 1) : null;
        const distance = !isTransit ? this._getStraightDistance(from, to) : null;

        return new Leg({ isTransit: isTransit,
                         routeType: this._getRouteType(transport?.move?.clasz),
                         route:     transport?.move.line_id,
                         color:     transport?.move.route_color,
                         textColor: transport?.move.route_text_color,
                         departure: departure,
                         departureTimezoneOffset: from.agencyTimezoneOffset,
                         arrival:   arrival,
                         arrivalTimezoneOffset: to.agencyTimezoneOffset,
                         duration:  (arrival - departure) / 1000,
                         from:      from.name,
                         fromCoordinate: from.coordinate,
                         agencyName: transport?.move?.provider,
                         to:        to.name,
                         toCoordinate: to.coordinate,
                         distance:  distance,
                         headsign:  transport?.move?.direction,
                         intermediateStops: intermediateStops });
    }

    _getRouteType(clazs) {
        switch (clazs) {
            case Clasz.AIR:
                return HVT.AIR_SERVICE;
            case Clasz.HIGH_SPEED:
                return HVT.HIGH_SPEED_RAIL_SERVICE;
            case Clasz.LONG_DISTANCE:
                return HVT.LONG_DISTANCE_TRAINS;
            case Clasz.COACH:
                return HVT.COACH_SERVICE;
            case Clasz.NIGHT:
                return HVT.SLEEPER_RAIL_SERVICE;
            case Clasz.REGIONAL_FAST:
                return HVT.REGIONAL_RAIL_SERVICE;
            case Clasz.REGIONAL:
                return HVT.REGIONAL_RAIL_SERVICE;
            case Clasz.METRO:
                return HVT.URBAN_METRO_SERVICE;
            case Clasz.SUBWAY:
                return HVT.UNDERGROUND_SERVICE;
            case Clasz.TRAM:
                return HVT.TRAM_SERVICE;
            case Clasz.BUS:
                return HVT.BUS_SERVICE;
            case Clasz.SHIP:
                return HVT.WATER_TRANSPORT_SERVICE;
            case Clasz.OTHER:
                return HVT.MISCELLANEOUS_SERVICE;
            default:
                return null;
        }
    }

    _parseStop(stop, startPlace, destinationPlace, commonTimezoneOffset) {
        const name = stop.station.id === 'START' ? startPlace.name :
                     stop.station.id === 'END' ? destinationPlace.name :
                     stop.station.name;
        const lat = stop.station.pos.lat;
        const lon = stop.station.pos.lng;
        const timezoneOffset =
            commonTimezoneOffset ??
            this._getTimezoneOffset(Math.max(stop.arrival.time, stop.departure.time),
                                    this._getTimezone(lat, lon)) * 1000;

        return new Stop({ name:                 name,
                          arrival:              stop.arrival.time * 1000,
                          departure:            stop.departure.time * 1000,
                          agencyTimezoneOffset: timezoneOffset,
                          coordinate:           [lat, lon] });
    }

    _getTimezone(lat, lon) {
        const location = GWeather.Location.new_detached('', null, lat, lon);

        return location.get_timezone();
    }

    _getTimezoneOffset(timestamp, tz) {
        const interval = tz.find_interval(GLib.TimeType.STANDARD, timestamp);

        return tz.get_offset(interval);
    }

    _getTimestamp(extendPrevious) {
        if (extendPrevious) {
            const last = this._plan.itineraries.last();

            return this._query.arriveBy ? last.arrival / 1000 - 60 :
                                          last.departure / 1000 + 60;
        } else if (!this._query.time && !this._query.date) {
            return GLib.DateTime.new_now_local().to_unix();
        } else {
            /* use timezone from start or destination depending on if
             * search is "leave by" or "arrive by"
             */
            const location = this._query.arriveBy ?
                             this._query.filledPoints.last().place.location :
                             this._query.filledPoints[0].place.location;
            const tz = this._getTimezone(location.latitude, location.longitude);
            // use current date, if no date is set in query
            const dateString = (new Date()).toISOString();
            const date =
                this._query.date ?? dateString.substring(0, 10);
            const timeString = this._query.time ?
                               `${date}T${this._query.time}:00` :
                               `${date}T${dateString.substring(11, 19)}`;

            return GLib.DateTime.new_from_iso8601(timeString, tz).to_unix();
        }
    }

    _getQueryBody(extendPrevious) {
        const timestamp = this._getTimestamp(extendPrevious);
        const arriveBy = this._query.arriveBy;
        const startLoc = this._query.filledPoints[0].place.location;
        const destinationLoc = this._query.filledPoints.last().place.location;

        const body = {
            destination: { type: "Module", target: "/intermodal" },
            content_type: "IntermodalRoutingRequest",
            content: {
                start_type: "IntermodalPretripStart",
                start: {
                    position: {
                        lat: startLoc.latitude,
                        lng: startLoc.longitude
                    },
                    min_connection_count: MIN_CONNECTIONS,
                    interval: {
                        begin: timestamp,
                        end:   timestamp + (arriveBy ? -1 : 1)
                    },
                    extend_interval_later: !arriveBy,
                    extend_interval_earlier: arriveBy
                },
                start_modes: [
                    {
                        mode: {
                            search_options: {
                                duration_limit: MAX_WALKING_DURATION,
                                profile: "default"
                            }
                        },
                        mode_type: "FootPPR"
                    }
                ],
                destination_type: "InputPosition",
                destination: {
                    lat: destinationLoc.latitude,
                    lng: destinationLoc.longitude
                },
                destination_modes: [
                    {
                        mode: {
                            search_options: {
                                duration_limit: MAX_WALKING_DURATION,
                                profile: "default"
                            }
                        },
                        mode_type: "FootPPR"
                    }
                ],
                search_type: "Default",
                search_dir: arriveBy ? "Backward" : "Forward",
                router: ""
            }
        };

        if (!this._query.transitOptions.showAllTransitTypes)
            body.content.allowed_claszes = this._getAllowedClaszses();

        return JSON.stringify(body, '', 2);
    }

    _getAllowedClaszses() {
        return this._query.transitOptions.transitTypes.map((type) => {
            switch (type) {
                case RouteType.BUS:
                    return [Clasz.COACH, Clasz.BUS];
                case RouteType.TRAM:
                    return Clasz.TRAM;
                case RouteType.TRAIN:
                    return [Clasz.HIGH_SPEED, Clasz.LONG_DISTANCE, Clasz.NIGHT,
                            Clasz.REGIONAL, Clasz.REGIONAL_FAST];
                case RouteType.SUBWAY:
                    return [Clasz.METRO, Clasz.SUBWAY];
                case RouteType.FERRY:
                    return Clasz.SHIP;
                case HVT.AIR_SERVICE:
                    return Clasz.AIR;
                default:
                    throw 'unkown transit type: ' + type;
            }
        }).flat();
    }
}

