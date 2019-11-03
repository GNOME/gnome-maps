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

const Champlain = imports.gi.Champlain;
const GLib = imports.gi.GLib;
const Soup = imports.gi.Soup;

const Application = imports.application;
const HTTP = imports.http;
const TransitPlan = imports.transitPlan;
const Utils = imports.utils;

const BASE_URL = 'https://transport.opendata.ch';
const API_VERSION = 'v1';

var OpendataCH = class OpendataCH {
    constructor() {
        this._session = new Soup.Session({ user_agent : 'gnome-maps/' + pkg.version });
        this._plan = Application.routingDelegator.transitRouter.plan;
        this._query = Application.routeQuery;
    }

    fetchFirstResults() {
        let filledPoints = this._query.filledPoints;

        this._extendPrevious = false;

        if (filledPoints.length > 7) {
            Utils.debug('This plugin supports at most five via location');
            this._plan.reset();
            this._plan.requestFailed();
            this._query.reset();
        } else {
            this._fetchResults();
        }
    }

    fetchMoreResults() {
        this._extendPrevious = true;

        this._fetchResults();
    }

    _fetchResults() {
        let query = new HTTP.Query(this._getQueryParams());
        let uri = new Soup.URI(BASE_URL + '/' + API_VERSION + '/connections?' +
                               query.toString());
        let request = new Soup.Message({ method: 'GET', uri: uri });

        this._session.queue_message(request, (obj, message) => {
            if (message.status_code !== Soup.Status.OK) {
                Utils.debug('Failed to get trip: ' + message.status_code);
            } else {
                let result = JSON.parse(message.response_body.data);
                Utils.debug('result: ' + JSON.stringify(result, null, 2));

                if (result.connections) {
                    let itineraries = this._createItineraries(result.connections);

                    this._plan.updateWithNewItineraries(itineraries,
                                                        this._query.arriveBy,
                                                        this._extendPrevious);
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
        let [startTime,] = this._parseTime(from.departure);
        let [endTime,] = this._parseTime(to.arrival);

        return new TransitPlan.Itinerary({ duration:  duration,
                                           departure: startTime,
                                           arrival:   endTime,
                                           legs:      legs,
                                           duration:  duration });
    }

    /**
     * Parse a time string into an array with
     * an absolute timestamp in ms since Unix epoch and a timezone offset
     * for the provider's native timezone at the given time and date
     */
    _parseTime(timeString) {
        let dateTime = GLib.DateTime.new_from_iso8601(timeString, null);

        return [dateTime.to_unix() * 1000, dateTime.get_utc_offset() / 1000];
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
        let [departureTime, tzOffset] = this._parseTime(departure.departure);
        let [arrivalTime,] = this._parseTime(arrival.arrival);
        let route = journey ? journey.number : null;
        let routeType =
            journey ? this._getHVTCodeFromCategory(journey.category) : null;
        let agencyName = journey ? journey.operator : null;
        let polyline = this._createPolylineForSection(section, index, sections);
        let duration = arrival.arrivalTimestamp - departure.departureTimestamp;
        let headsign = journey ? journey.to : null;
        let [departureX, departureY, arrivalX, arrivalY] =
            this._getCoordsForSection(section, index, sections);

        let result = new TransitPlan.Leg({ departure:            departureTime,
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
                                           polyline:             polyline,
                                           isTransit:            isTransit,
                                           duration:             duration,
                                           agencyName:           agencyName,
                                           agencyTimezoneOffset: tzOffset,
                                           tripShortName:        route });

        if (journey)
            result.intermediateStops = this._createIntermediateStops(journey);

        return result;
    }

    _getHVTCodeFromCategory(category) {
        // TODO: parse category
        return null;
    }

    _getCoordsForSection(section, index, sections) {
        let departureX = section.departure.location.coordinate.x;
        let departureY = section.departure.location.coordinate.y;
        let arrivalX = section.arrival.location.coordinate.x;
        let arrivalY = section.arrival.location.coordinate.y;

        if (index === 0) {
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

    _createPolylineForSection(section, index, sections) {
        let polyline;

        if (section.journey) {
            polyline = [];

            section.journey.passList.forEach((pass) => {
                let coordinate = pass.location.coordinate;
                polyline.push(new Champlain.Coordinate({ latitude:  coordinate.x,
                                                         longitude: coordinate.y }));
            });
        } else {
            let [departureX, departureY, arrivalX, arrivalY] =
                this._getCoordsForSection(section, index, sections);

            polyline =
                [new Champlain.Coordinate({ latitude:  departureX,
                                            longitude: departureY }),
                 new Champlain.Coordinate({ latitude:  arrivalX,
                                            longitude: arrivalY })];
        }

        return polyline;
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
            [departure, departureTzOffset] = this._parseTime(pass.departure)
        if (pass.arrival)
            [arrival, arrivalTzOffset] = this._parseTime(pass.arrival);

        if (!arrival)
            arrival = departure;
        if (!departure)
            departure = arrival;

        return new TransitPlan.Stop({ name:                 pass.station.name,
                                      arrival:              arrival,
                                      departure:            departure,
                                      agencyTimezoneOffset: departureTzOffset || arrivalTzOffset,
                                      coordinate: [pass.location.coordinate.x,
                                                   pass.location.coordinate.y] });
    }

    _getQueryParams() {
        let points = this._query.filledPoints;
        let originLocation = points[0].place.location;
        let destLocation = points.last().place.location;
        let transitOptions = this._query.transitOptions;
        let params = { from:  originLocation.latitude + ',' + originLocation.longitude,
                       to:    destLocation.latitude + ',' + destLocation.longitude };

        if (!transitOptions.showAllTransitTypes)
            this._setTransportations(transitOptions);


        if (this._extendPrevious) {
            // TODO: pagination
        } else  {
            if (this._query.arriveBy)
                params.isArrivalTime = 1;

            if (this._query.time)
                params.time = this._query.time;

            if (this._query.date)
                params.date = this._query.date;
        }

        return params;
    }

    _setTransportations(transitOptions) {

    }
}
