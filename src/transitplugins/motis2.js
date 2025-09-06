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

import gettext from 'gettext';

import Gio from 'gi://Gio';
import GWeather from 'gi://GWeather';
import GLib from 'gi://GLib';
import Shumate from 'gi://Shumate';
import Soup from 'gi://Soup';

import {Application} from '../application.js';
import * as Epaf from '../epaf.js';
import * as HVT from '../hvt.js';
import {Query} from '../http.js';
import {TurnPoint} from '../route.js';
import * as Time from '../time.js';
import {Itinerary, Leg, RouteType, Stop} from '../transitPlan.js';
import * as Utils from '../utils.js';

const _ = gettext.gettext;

export class Motis2 {
    constructor(params) {
        this._requestCancellable = null
        this._baseUrl = GLib.getenv('MOTIS_BASE_URL') ?? params?.baseUrl;
        this._plan = Application.routingDelegator.transitRouter.plan;
        this._query = Application.routeQuery;
        this._session =
            new Soup.Session({ user_agent : 'gnome-maps/' + pkg.version });
        this._cachedEncodedPolylines = {};

        if (!this._baseUrl)
            throw new Error('must specify baseUrl as an argument');
    }

    cancelCurrentRequest() {
        if (this._requestCancellable) {
            this._requestCancellable.cancel();
            this._requestCancellable = null;
        }
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
        const query = this._getQuery(extendPrevious);
        const request = Soup.Message.new('GET', this._baseUrl + '/api/v4/plan?' +
                                         query.toString());

        // if trying to extend trips, and there was no page cursor, show no results
        const pageCursor =
            this._query.arriveBy ? this._previousCursor : this._nextCursor;

        if (extendPrevious && !pageCursor) {
            this._plan.noMoreResults();
            return;
        }

        request.request_headers.replace('Content-Type', 'application/json');

        this._requestCancellable = new Gio.Cancellable();

        this._session.send_and_read_async(request, GLib.PRIORITY_DEFAULT, this._requestCancellable,
                                          (source, res) => {
            try {
                if (request.get_status() !== Soup.Status.OK) {
                    Utils.debug('Failed to get trip: ' + request.get_status());

                    this._plan.requestFailed();
                } else {
                    const buffer = this._session.send_and_read_finish(res).get_data();
                    const result = JSON.parse(Utils.getBufferText(buffer));
                    Utils.debug('result: ' + JSON.stringify(result, null, 2));

                    this._previousCursor = result.previousPageCursor;
                    this._nextCursor = result.nextPageCursor;

                    this._parseResult(result, extendPrevious);
                }
                this._requestCancellable = null;
            } catch (error) {
                if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                    Utils.debug('Failed to send request: ' + error.msg + ', ' + error.stack);
                    this._plan.requestFailed();
                }
            }
        });
    }

    _parseResult(result, extendPrevious) {
        try {
            const itineraries = result?.itineraries;
            const direct = result?.direct;

            if (!Array.isArray(itineraries) || !Array.isArray(direct)) {
                Utils.debug('No itineraries in response');
                this._plan.requestFailed();
                return;
            }

            if (extendPrevious && itineraries.length === 0) {
                this._plan.noMoreResults();
                return;
            } else if (!extendPrevious &&
                       itineraries.length === 0 && direct.length === 0) {
                this._plan.noRouteFound();
                return;
            }

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

            const parsedItineraries =
                itineraries.map((itinerary) =>
                                 this._parseItinerary(itinerary,
                                                      startPlace,
                                                      destinationPlace,
                                                      commonTz));
            // don't include direct connections when extending a search
            const parsedDirect = extendPrevious ? [] :
                                 direct.map((itinerary) =>
                                            this._parseItinerary(itinerary,
                                                                 startPlace,
                                                                 destinationPlace,
                                                                 commonTz));
            const newItineraries = [...parsedDirect, ...parsedItineraries];

            this._plan.updateWithNewItineraries(newItineraries,
                                                this._query.arriveBy,
                                                extendPrevious);
        } catch (error) {
            Utils.debug(`error parsing connections ${error} ${error.stack}`);
            this._plan.requestFailed();
        }
    }

    _parseItinerary(itinerary, startPlace, destinationPlace, commonTz) {
        const [departure,] = Time.parseTime(itinerary.startTime);
        const [arrival,] = Time.parseTime(itinerary.endTime);

        /* use common timezone offset if the same timezone is in effect
         * for the departure and arrival, calculate it once to avoid
         * recalculate it for each stop
         */
        const departureTimezoneOffset =
            this._getTimezoneOffset(departure / 1000,
                                    commonTz ??
                                    this._getTimezone(startPlace.location.latitude,
                                                      startPlace.location.longitude));
        const arrivalTimezoneOffset =
            this._getTimezoneOffset(arrival / 1000,
                                    commonTz ??
                                    this._getTimezone(destinationPlace.location.latitude,
                                                      destinationPlace.location.longitude));
        const commonTimezoneOffset =
            departureTimezoneOffset === arrivalTimezoneOffset ?
            departureTimezoneOffset * 1000 : null;
        const legs =
            itinerary.legs.map((leg, index) =>
                               this._parseLeg(leg, index === 0,
                                              index === itinerary.legs.length - 1,
                                              startPlace, destinationPlace,
                                              commonTimezoneOffset));

        return new Itinerary({
            legs:                    legs,
            departure:               departure,
            departureTimezoneOffset: departureTimezoneOffset * 1000,
            arrival:                 arrival,
            arrivalTimezoneOffset:   arrivalTimezoneOffset * 1000,
            duration:                itinerary.duration,
            transfers:               itinerary.transfers
        });
    }

    _parseLeg(leg, isFirst, isLast, startPlace, destinationPlace,
              commonTimezoneOffset) {
        const isTransit = leg.mode !== 'WALK';
        const distance =
            leg.distance ?? (!isTransit ?
                             this._getStraightDistance(leg.from, leg.to) :
                             undefined);
        const [departure,] = Time.parseTime(leg.startTime);
        const departureTimezoneOffset =
            commonTimezoneOffset ??
            this._getTimezoneOffset(departure / 1000, this._getTimezone(leg.from.lat,
                                                                        leg.from.lon));
        const [arrival,] = Time.parseTime(leg.endTime);
        const arrivalTimezoneOffset =
            commonTimezoneOffset ??
            this._getTimezoneOffset(arrival / 1000, this._getTimezone(leg.to.lat,
                                                                      leg.to.lon));
        const from = isFirst && !isTransit ? startPlace.name : leg.from.name;
        const to = isLast && !isTransit ? destinationPlace.name : leg.to.name;

        const polyline =
            leg?.legGeometry?.points ?
            this._getEncodedPolyline(leg.legGeometry.points,
                                     leg.legGeometry.precision) : undefined;

        const commonLegTimezoneOffset =
            arrivalTimezoneOffset === departureTimezoneOffset ?
            arrivalTimezoneOffset : undefined;
        const intermediateStops =
            isTransit ?
            [...leg.intermediateStops.map(stop =>
                                          this._parseStop(stop,
                                                          commonLegTimezoneOffset)),
             new Stop({ name: to,
                        arrival:              arrival,
                        departure:            arrival,
                        agencyTimezoneOffset: arrivalTimezoneOffset,
                        coordinate:           [leg.to.lat, leg.to.lon] })
            ] :
            undefined;
        const steps =
            !isTransit && leg.steps ?
            this._parseSteps(leg.steps, polyline[0], polyline.last()) : undefined;

        return new Leg({ isTransit:               isTransit,
                         duration:                leg.duration,
                         distance:                distance,
                         departure:               departure,
                         departureTimezoneOffset: departureTimezoneOffset,
                         arrival:                 arrival,
                         arrivalTimezoneOffset:   arrivalTimezoneOffset,
                         from:                    from,
                         fromCoordinate:          [leg.from.lat, leg.from.lon],
                         to:                      to,
                         toCoordinate:            [leg.to.lat, leg.to.lon],
                         headsign:                leg.headsign,
                         color:                   leg.routeColor,
                         textColor:               leg.routeTextColor,
                         route:                   this._getRoute(leg),
                         routeType:               isTransit ?
                                                  leg.routeType ??
                                                  this._getRouteType(leg) :
                                                  undefined,
                         agencyName:              leg.agencyName,
                         agencyUrl:               leg.agencyUrl,
                         polyline:                polyline,
                         intermediateStops:       intermediateStops,
                         walkingInstructions:     steps });
    }

    _getStraightDistance(from, to) {
        const fromCoord = new Shumate.Coordinate({ latitude:  from.lat,
                                                   longitude: from.lon });
        const toCoord = new Shumate.Coordinate({ latitude:  to.lat,
                                                 longitude: to.lon });

        return fromCoord.distance(toCoord);
    }

    _getEncodedPolyline(polyline, precision) {
        if (!this._cachedEncodedPolylines[polyline]) {
            // clear cached entries when above threashhold to prevent overgrowing
            if (Object.values(this._cachedEncodedPolylines).length > 100)
                this._cachedEncodedPolylines = {};

            this._cachedEncodedPolylines[polyline] =
                Epaf.decode(polyline, precision);
        }

        return this._cachedEncodedPolylines[polyline];
    }

    _parseStop(stop, commonTimezoneOffset) {
        const [departure,] = Time.parseTime(stop.departure);
        const [arrival,] = Time.parseTime(stop.arrival);
        const timezoneOffset =
            commonTimezoneOffset ??
            this._getTimezoneOffset(Math.max(arrival / 1000, departure / 1000),
                                    this._getTimezone(stop.lat, stop.lon));

        return new Stop({ name:                 stop.name,
                          arrival:              arrival,
                          departure:            departure,
                          agencyTimezoneOffset: timezoneOffset,
                          coordinate:           [stop.lat, stop.lon] });
    }

    _parseSteps(steps, fromCoordinate, toCoordinate) {
        // create starting turnpoint instruction based on leg
        const startTurnpoint = new TurnPoint({ type:        TurnPoint.Type.START,
                                               distance:    0,
                                               instruction: _("Start"),
                                               coordinate:  fromCoordinate });

        const intermediateTurnpoints = steps.map((step) => {
            const [type, instruction] =
                this._getTurnpointTypeAndInstruction(step);
            const coordinate =
                Epaf.decodeFirstCoordinate(step.polyline.points,
                                           step.polyline.precision);

            return new TurnPoint({ type:        type,
                                   distance:    step.distance,
                                   instruction: instruction,
                                   coordinate:  coordinate });
        });

        // add ending turnPoint
        const endTurnpoint = new TurnPoint({ type:        TurnPoint.Type.END,
                                             distance:    0,
                                             instruction: _("Arrive"),
                                             coordinate:  toCoordinate });

        return [startTurnpoint, ...intermediateTurnpoints, endTurnpoint];
    }

    _getTurnpointTypeAndInstruction(step) {
        switch (step.relativeDirection) {
            case 'DEPART':
            case 'STAIRS':
                return [TurnPoint.Type.STAIRS,
                        step.hasOwnProperty('toLevel') ?
                        _("Take the stairs to level %s").format(step.toLevel) :
                        _("Take the stairs")];
            case 'CONTINUE':
                return [TurnPoint.Type.CONTINUE,
                        step.streetName ?
                        _("Continue on %s").format(step.streetName) :
                        _("Continue")];
            case 'LEFT':
                return [TurnPoint.Type.LEFT,
                        step.streetName ?
                        _("Turn left on %s").format(step.streetName) :
                        _("Turn left")];
            case 'SLIGHTLY_LEFT':
                return [TurnPoint.Type.SLIGHT_LEFT,
                        step.streetName ?
                        _("Turn slightly left on %s").format(step.streetName) :
                        _("Turn slightly left")];
            case 'HARD_LEFT':
                return [TurnPoint.Type.SHARP_LEFT,
                        step.streetName ?
                        _("Turn sharp left on %s").format(step.streetName) :
                        _("Turn sharp left")];
            case 'RIGHT':
                return [TurnPoint.Type.RIGHT,
                        step.streetName ?
                        _("Turn right on %s").format(step.streetName) :
                        _("Turn right")];
            case 'SLIGHT_RIGHT':
                return [TurnPoint.Type.SLIGHT_RIGHT,
                        step.streetName ?
                        _("Turn slightly right on %s").format(step.streetName) :
                        _("Turn slightly right")];
            case 'HARD_RIGHT':
                return [TurnPoint.Type.SHARP_RIGHT,
                        step.streetName ?
                        _("Turn sharp right on %s").format(step.streetName) :
                        _("Turn sharp right")];
            case 'CIRCLE_CLOCKWISE':
            case 'CIRCLE_COUNTERCLOCKWISE': {
                let instruction;

                if (step.exit) {
                    instruction =
                        _("At the roundabout, take exit %s").format(step.exit);
                } else if (step.streetName) {
                    instruction =
                        _("At the roundabout, take exit to %s").format(step.streetName);
                } else {
                    instruction = _("Take the roundabout");
                }

                return [TurnPoint.Type.ROUNDABOUT, instruction];
            }
            case 'ELEVATOR':
                return [TurnPoint.Type.ELEVATOR,
                        step.hasOwnProperty('toLevel') ?
                        _("Take the elevator and get off at %s").format(step.toLevel) :
                        _("Take the elevator")];
            case 'UTRUN_LEFT':
                return [TurnPoint.Type.UTURN_LEFT,
                        step.streetName ?
                        _("Make a left u-turn onto %s").format(step.streetName) :
                        _("Make a left u-turn")];
            case 'UTURN_RIGHT':
                return [TurnPoint.Type.UTURN_RIGHT,
                        step.streetName ?
                        _("Make a right u-turn onto %s").format(step.streetName) :
                        _("Make a right u-turn")];
            default:
                throw 'unknown direction ' + step.relativeDirection;
        }
    }

    _getRoute(leg) {
        return leg.displayName ?? leg.shortName;
    }

    _getRouteType(leg) {
        switch (leg.mode) {
            case 'BUS':
                return RouteType.BUS;
            case 'TRAM':
                return RouteType.TRAM;
            case 'SUBWAY':
                return RouteType.SUBWAY;
            case 'FERRY':
                return RouteType.FERRY;
            case 'AIRPLANE':
                return HVT.AIR_SERVICE;
            case 'METRO':
                return HVT.METRO_SERVICE;
            case 'COACH':
                return HVT.COACH_SERVICE;
            case 'RAIL':
                return RouteType.TRAIN;
            case 'HIGHSPEED_RAIL':
                return HVT.HIGH_SPEED_RAIL_SERVICE;
            case 'LONG_DISTANCE':
                return HVT.LONG_DISTANCE_TRAINS;
            case 'NIGHT_RAIL':
                return HVT.SLEEPER_RAIL_SERVICE;
            case 'REGIONAL_FAST_RAIL':
            case 'REGIONAL_RAIL':
                return HVT.REGIONAL_RAIL_SERVICE;
            case 'OTHER':
                return HVT.MISCELLANEOUS_SERVICE;
            default:
                return undefined;
        }
    }

    _getTimezone(lat, lon) {
        const location = GWeather.Location.new_detached('', null, lat, lon);

        return location.get_timezone();
    }

    _getTimezoneOffset(timestamp, tz) {
        const interval = tz.find_interval(GLib.TimeType.STANDARD, timestamp);

        return tz.get_offset(interval);
    }

    _getPlaceParamFromLocation(place) {
        const location = place.location;

        /* return comma-separated tuple of latitude,longitude, and when
         * available, level
         */
        return [location.latitude, location.longitude, place.level].
               filter(e => e).join(',');
    }

    _getQuery(extendPrevious) {
        const from = this._query.filledPoints[0].place;
        const to = this._query.filledPoints.last().place;
        const params = { fromPlace: this._getPlaceParamFromLocation(from),
                         toPlace:   this._getPlaceParamFromLocation(to),
                         arriveBy:  this._query.arriveBy };

        if (this._query.time)
            params.time = this._getTimeParam();

        if (!this._query.transitOptions.showAllTransitTypes)
            params.transitModes = this._getTransitModesParam();

        if (extendPrevious) {
            params.pageCursor =
                this._query.arriveBy ? this._previousCursor : this._nextCursor;
        }

        return new Query(params);
    }

    _getTimeParam() {
        const filledPoints = this._query.filledPoints;
        const loc = this._query.arriveBy ? filledPoints.last().place.location :
                                           filledPoints[0].place.location;
        const tz = this._getTimezone(loc.latitude, loc.longitude);
        const date = this._query.date ?? GLib.DateTime.new_now_local().format('%F');
        const dateTime =
            GLib.DateTime.new_from_iso8601(`${date}T${this._query.time}:00`,
                                           tz);

        return dateTime.to_utc().format_iso8601();
    }

    _getTransitModesParam() {
         return this._query.transitOptions.transitTypes.map((type) => {
            switch (type) {
                case RouteType.BUS:
                    return 'BUS,COACH';
                case RouteType.TRAM:
                    return 'TRAM'
                case RouteType.TRAIN:
                    return 'HIGHSPEED_RAIL,LONG_DISTANCE,NIGHT_RAIL,REGIONAL_RAIL,REGIONAL_FAST_RAIL';
                case RouteType.SUBWAY:
                    return 'METRO,SUBWAY';
                case RouteType.FERRY:
                    return 'FERRY';
                case HVT.AIR_SERVICE:
                    return 'AIRPLANE';
                default:
                    throw 'unkown transit type: ' + type;
            }
        }).flat().join(',');
    }
}
