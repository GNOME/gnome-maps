/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2019 Marcus Lundblad
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
 * Author: Marcus Lundblad <ml@update.uu.se>
 */

/**
 * This module implements a transit routing plugin for the Swiss national
 * opendata.ch transit journey planning API.
 *
 * API docs for opendata.ch journey planning can be found at:
 * https://transport.opendata.ch/docs.html
 */

import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

import {Application} from '../application.js';
import * as GraphHopperTransit from '../graphHopperTransit.js';
import * as HVT from '../hvt.js';
import {Query} from '../http.js';
import * as Time from '../time.js';
import {Itinerary, Leg, RouteType, Stop} from '../transitPlan.js';
import * as Utils from '../utils.js';

const BASE_URL = 'https://transport.opendata.ch';
const API_VERSION = 'v1';

const Transportations = {
    TRAIN:    'train',
    TRAM:     'tram',
    SHIP:     'ship',
    BUS:      'bus',
    CABLEWAY: 'cableway'
};

/**
 * These are not documented in the API documentation, so had to
 * reverse-engineer by trial-and-error.
 */
const Category = {
    // bus
    B:    'B',
    NFB:  'NFB',
    NFO:  'NFO',
    BUS:  'BUS',

    // tram
    NFT:  'NFT',
    TRAM: 'TRAM',
    T:    'T',

    // metro
    M:    'M',

    // urban rail
    R:    'R',
    S:    'S',

    // regional rail
    RE:   'RE',

    // interregional rail
    IR:   'IR',

    // intercity rail
    IC:   'IC',
    ICE:  'ICE',

    // night trains
    N:    'N',
    SN:   'SN',

    // funicular
    FUN:  'FUN',

    // water transport
    BAT:  'BAT'
};

// gap to use when fetching additional routes
const GAP_BEFORE_MORE_RESULTS = 120;

export class OpendataCH {
    constructor() {
        this._session = new Soup.Session({ user_agent : 'gnome-maps/' + pkg.version });
        this._plan = Application.routingDelegator.transitRouter.plan;
        this._query = Application.routeQuery;
    }

    cancelCurrentRequest() {
        //Do nothing.
    }

    fetchFirstResults() {
        let filledPoints = this._query.filledPoints;

        this._extendPrevious = false;
        this._viaLocations = [];

        if (filledPoints.length > 7) {
            Utils.debug('This plugin supports at most five via location');
            this._plan.reset();
            this._plan.requestFailed();
            this._query.reset();
        } else {
            if (filledPoints.length > 2)
                this._fetchNearbyLocations(filledPoints.slice(1, -1));
            else
                this._fetchResults();
        }
    }

    fetchMoreResults() {
        this._extendPrevious = true;
        // if there's only a walking-only itinerary, don't try to fetch more
        if (this._plan.itineraries.length === 1 &&
            this._plan.itineraries[0].legs.length === 1 &&
            !this._plan.itineraries[0].legs[0].transit) {
            this._plan.noMoreResults();
        } else {
            this._fetchResults();
        }
    }

    _fetchNearbyLocations(points) {
        this._fetchNearbyLocationsRecursive(points, 0);
    }

    _fetchNearbyLocationsRecursive(points, index) {
        if (index === points.length) {
            this._fetchResults();
        } else {
            let location = points[index].place.location;
            let query = new Query({ x: location.latitude,
                                    y: location.longitude });
            let uri = BASE_URL + '/' + API_VERSION + '/locations?' + query.toString();
            let request = Soup.Message('GET', uri);

            this._session.send_and_read_async(request, GLib.PRIORITY_DEFAULT, null,
                                              (source, res) => {
                if (request.get_status() !== Soup.Status.OK) {
                    Utils.debug('Failed to get location: ' + request.get_status());
                    this._plan.requestFailed();
                    this._plan.reset();
                } else {
                    let buffer =
                        this._session.send_and_read_finish(res).get_data();
                    let result = JSON.parse(Utils.getBufferText(buffer));

                    Utils.debug('locations: ' + JSON.stringify(result, null, 2));

                    if (result.stations && result.stations.length > 0) {
                        let station = this._getBestStation(result.stations);

                        if (station) {
                            this._viaLocations.push(station);
                            this._fetchNearbyLocationsRecursive(points, index + 1);
                        } else {
                            Utils.debug('No suitable via location found');
                            this._plan.noRouteFound();
                        }
                    } else {
                        Utils.debug('No via location found');
                        this._plan.noRouteFound();
                    }
                }
            });
        }
    }

    _getBestStation(stations) {
        let name = null;

        for (let i = 0; i < stations.length; i++) {
            if (stations[i].icon)
                name = stations[i].name;
        }

        return name;
    }

    _fetchResults() {
        let query = this._getQuery();
        let uri = BASE_URL + '/' + API_VERSION + '/connections?' + query.toString(true);
        let request = Soup.Message.new('GET', uri);

        Utils.debug('uri: ' + uri);

        this._session.send_and_read_async(request, GLib.PRIORITY_DEFAULT, null,
                                          (source, res) => {
            if (request.get_status() !== Soup.Status.OK) {
                Utils.debug('Failed to get trip: ' + request.get_status());
                this._plan.requestFailed();
                this._plan.reset();
            } else {
                let buffer = this._session.send_and_read_finish(res).get_data();
                let result = JSON.parse(Utils.getBufferText(buffer));
                Utils.debug('result: ' + JSON.stringify(result, null, 2));

                if (result.connections && result.connections.length > 0) {
                    let itineraries = this._createItineraries(result.connections);

                    GraphHopperTransit.addWalkingToItineraries(itineraries,
                        () => this._plan.updateWithNewItineraries(itineraries,
                                                          this._query.arriveBy,
                                                          this._extendPrevious));
                } else {
                    this._plan.noRouteFound();
                }
            }
        });
    }

    _createItineraries(connections) {
        return connections.map((connection) => this._createItinerary(connection));
    }

    _createItinerary(connection) {
        let legs = this._createLegs(connection.sections);
        let duration =
            connection.to.arrivalTimestamp - connection.from.departureTimestamp;
        let from = connection.from;
        let to = connection.to;
        let [startTime,] = Time.parseTime(from.departure);
        let [endTime,] = Time.parseTime(to.arrival);

        return new Itinerary({ duration:  duration,
                               departure: startTime,
                               arrival:   endTime,
                               legs:      legs });
    }

    _createLegs(sections) {
        let result = sections.map((section, index, sections) =>
                                    this._createLeg(section, index, sections));

        return result;
    }

    _createLeg(section, index, sections) {
        let isTransit = section.journey;

        let departure = section.departure;
        let arrival = section.arrival;
        let journey = section.journey;

        if (!departure)
            throw new Error('Missing departure element');
        if (!arrival)
            throw new Error('Missing arrival element');

        let first = index === 0;
        let last = index === sections.length - 1;
        /* for walking legs in the beginning or end, use the name from the
         * query, so we get the names of the place the user searched for in
         * the results, when starting/ending at a transitstop, use the stop
         * name
         */
        let from =
            first && !journey ? this._query.filledPoints[0].place.name :
                                departure.station.name;
        let to =
            last && !journey ? this._query.filledPoints.last().place.name :
                               arrival.station.nam;
        let [departureTime, tzOffset] = Time.parseTime(departure.departure);
        let [arrivalTime,] = Time.parseTime(arrival.arrival);
        let route = journey ? journey.number : null;
        let routeType =
            journey ? this._getHVTCodeFromCategory(journey.category) : null;
        let agencyName = journey ? journey.operator : null;
        let duration = arrival.arrivalTimestamp - departure.departureTimestamp;
        let headsign = journey ? journey.to : null;
        let [departureX, departureY, arrivalX, arrivalY] =
            this._getCoordsForSection(section, index, sections);
        let intermediateStops =
            journey ? this._createIntermediateStops(journey) : null;

        return new Leg({ departure:            departureTime,
                         arrival:              arrivalTime,
                         from:                 from,
                         to:                   to,
                         headsign:             headsign,
                         fromCoordinate:       [departureX,
                                                departureY],
                         toCoordinate:         [arrivalX,
                                                arrivalY],
                         route:                route,
                         routeType:            routeType,
                         isTransit:            isTransit,
                         duration:             duration,
                         agencyName:           agencyName,
                         agencyTimezoneOffset: tzOffset,
                         tripShortName:        route,
                         intermediateStops:    intermediateStops });
    }

    _getHVTCodeFromCategory(category) {
        switch (category) {
            case Category.B:
            case Category.BUS:
            case Category.NFB:
            case Category.NFO:
                return HVT.BUS_SERVICE;
            case Category.TRAM:
            case Category.NFT:
            case Category.T:
                return HVT.TRAM_SERVICE;
            case Category.M:
                return HVT.METRO_SERVICE;
            case Category.R:
            case Category.S:
                return HVT.SUBURBAN_RAILWAY_SERVICE;
            case Category.RE:
                return HVT.REGIONAL_RAIL_SERVICE;
            case Category.IR:
                return HVT.INTER_REGIONAL_RAIL_SERVICE;
            case Category.IC:
            case Category.ICE:
                return HVT.LONG_DISTANCE_TRAINS;
            case Category.N:
            case Category.SN:
                return HVT.SLEEPER_RAIL_SERVICE;
            case Category.FUN:
                return HVT.FUNICULAR_SERVICE;
            case Category.BAT:
                return HVT.WATER_TRANSPORT_SERVICE;
            default:
                return null;
        }
    }

    _getCoordsForSection(section, index, sections) {
        let departureX = section.departure.location.coordinate.x;
        let departureY = section.departure.location.coordinate.y;
        let arrivalX = section.arrival.location.coordinate.x;
        let arrivalY = section.arrival.location.coordinate.y;

        if (sections.length === 1) {
            if (!departureX)
                departureX = this._query.filledPoints[0].place.location.latitude;
            if (!departureY)
                departureY = this._query.filledPoints[0].place.location.longitude;
            if (!arrivalX)
                arrivalX = this._query.filledPoints.last().place.location.latitude;
            if (!arrivalY)
                arrivalY = this._query.filledPoints.last().place.location.longitude;
        } else if (index === 0) {
            if (!departureX)
                departureX = this._query.filledPoints[0].place.location.latitude;
            if (!departureY)
                departureY = this._query.filledPoints[0].place.location.longitude;
        } else if (index === sections.length - 1)  {
            if (!arrivalX)
                arrivalX = this._query.filledPoints.last().place.location.latitude;
            if (!arrivalY)
                arrivalY = this._query.filledPoints.last().place.location.longitude;
        }

        return [departureX, departureY, arrivalX, arrivalY];
    }

    _createIntermediateStops(journey) {
        let result = [];

        journey.passList.forEach((pass, index) => {
            if (index !== 0)
                result.push(this._createIntermediateStop(pass));
        });

        return result;
    }

    _createIntermediateStop(pass) {
        let [departure, departureTzOffset] = [,];
        let [arrival, arrivalTzOffset] = [,];

        if (pass.departure)
            [departure, departureTzOffset] = Time.parseTime(pass.departure);
        if (pass.arrival)
            [arrival, arrivalTzOffset] = Time.parseTime(pass.arrival);

        if (!arrival)
            arrival = departure;
        if (!departure)
            departure = arrival;

        return new Stop({ name:                 pass.station.name,
                          arrival:              arrival,
                          departure:            departure,
                          agencyTimezoneOffset: departureTzOffset || arrivalTzOffset,
                          coordinate: [pass.location.coordinate.x,
                                       pass.location.coordinate.y] });
    }

    // get a time suitably formatted for the the query param
    _formatTime(time, offset) {
        let utcTimeWithOffset = (time + offset) / 1000;
        let date = GLib.DateTime.new_from_unix_utc(utcTimeWithOffset);

        return date.format('%R');
    }

    // get a date suitably formatted for the query param
    _formatDate(time, offset) {
        let utcTimeWithOffset = (time + offset) / 1000;
        let date = GLib.DateTime.new_from_unix_utc(utcTimeWithOffset);

        return date.format('%F');
    }

    _getPlaceParam(point) {
        let location = point.place.location;

        return location.latitude + ',' + location.longitude;
    }

    _getQuery(vias) {
        let points = this._query.filledPoints;
        let transitOptions = this._query.transitOptions;
        let params = { from:  this._getPlaceParam(points[0]),
                       to:    this._getPlaceParam(points.last()) };

        if (!transitOptions.showAllTransitTypes)
            params.transportations = this._getTransportations(transitOptions);

        if (this._query.arriveBy)
            params.isArrivalTime = 1;

        /* the "page" parameter of the API seems broken for "arrive by"
         * searches, so instead search by updated time
         */
        if (this._extendPrevious) {
            let itineraries = this._plan.itineraries;
            let lastItinerary = itineraries.last();
            let time;
            let offset;

            if (this._query.arriveBy) {
                time = lastItinerary.transitArrivalTime -
                       GAP_BEFORE_MORE_RESULTS * 1000;
                offset = lastItinerary.transitArrivalTimezoneOffset;
            } else {
                time = lastItinerary.transitDepartureTime +
                       GAP_BEFORE_MORE_RESULTS * 1000;
                offset = lastItinerary.transitDepartureTimezoneOffset;
            }

            params.time = this._formatTime(time, offset);
            params.date = this._formatDate(time, offset);
        } else {
            if (this._query.time)
                params.time = this._query.time;

            if (this._query.date)
                params.date = this._query.date;
        }

        let query = new Query(params);

        if (this._viaLocations.length > 0) {
            this._viaLocations.forEach((p) => { query.add('via', p); });
        }

        return query;
    }

    _getTransportations(transitOptions) {
        let transportations = [];

        this._query.transitOptions.transitTypes.forEach((type) => {
            let transportation = this._transportationForTransitType(type);

            if (transportation)
                transportations.push(transportation);
        });

        return transportations;
    }

    _transportationForTransitType(type) {
        switch (type) {
            case RouteType.BUS:
                return Transportations.BUS;
            case RouteType.TRAM:
                return Transportations.TRAM;
            case RouteType.TRAIN:
                return Transportations.TRAIN;
            case RouteType.FERRY:
                return Transportations.SHIP;
            default:
                return null;
        }
    }
}
