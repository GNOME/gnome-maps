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
 * This module implements a transit routing plugin for the Swedish national
 * Resrobot transit journey planning API.
 *
 * API docs for Resrobot can be found at:
 * https://www.trafiklab.se/api/resrobot-reseplanerare/dokumentation/sokresa
 */

const Champlain = imports.gi.Champlain;
const GLib = imports.gi.GLib;
const Soup = imports.gi.Soup;

const Application = imports.application;
const HTTP = imports.http;
const HVT = imports.hvt;
const TransitPlan = imports.transitPlan;
const Utils = imports.utils;

const BASE_URL = 'https://api.resrobot.se';
const API_VERSION = 'v2';

// Timezone for timestamps returned by this provider
const NATIVE_TIMEZONE = 'Europe/Stockholm';

const ISO_8601_DURATION_REGEXP = new RegExp(/PT((\d+)H)?((\d+)M)?/);

const Products = {
    EXPRESS_TRAIN:  2,
    REGIONAL_TRAIN: 4,
    EXPRESS_BUS:    8,
    LOCAL_TRAIN:    16,
    SUBWAY:         32,
    TRAM:           64,
    BUS:            128,
    FERRY:          256
};

const LegType = {
    WALK:     'WALK',
    TRANSIT:  'JNY',
    TRANSFER: 'TRSF'
};

const CatCode = {
    EXPRESS_TRAIN:  1,
    REGIONAL_TRAIN: 2,
    EXPRESS_BUS:    3,
    LOCAL_TRAIN:    4,
    SUBWAY:         5,
    TRAM:           6,
    BUS:            7,
    FERRY:          8
};

var Resrobot = class Resrobot {
    constructor(params) {
        this._session = new Soup.Session();
        this._plan = Application.routingDelegator.transitRouter.plan;
        this._query = Application.routeQuery;
        this._key = params.key;
        this._tz = GLib.TimeZone.new(NATIVE_TIMEZONE);

        if (!this._key)
            throw new Error('missing key');
    }

    fetchFirstResults() {
        let query = new HTTP.Query(this._getQueryParams());
        let uri = new Soup.URI(BASE_URL + '/' + API_VERSION + '/trip?' +
                               query.toString());
        let request = new Soup.Message({ method: 'GET', uri: uri });

        Utils.debug('uri: ' + uri.to_string(false));

        this._session.queue_message(request, (obj, message) => {
            if (message.status_code !== Soup.Status.OK) {
                Utils.debug('Failed to get trip');
                //callback(null);
            } else {
                try {
                    let result = JSON.parse(message.response_body.data);

                    Utils.debug('result: ' + JSON.stringify(result, null, 2));
                    if (result.Trip) {
                        let itineraries = this._createItineraries(result.Trip);
                    } else {
                        this._plan.noRouteFound();
                    }

                    //callback(result);
                } catch (e) {
                    Utils.debug('Error parsing result: ' + e);
                    //callback(null);
                }
            }
        });
    }

    _createItineraries(trips) {
        return trips.map((trip) => this._createItinerary(trip));
    }

    _createItinerary(trip) {
        let legs = this._createLegs(trip.LegList.Leg);
        let duration = this._parseDuration(trip.duration);
        let origin = trip.LegList.Leg[0].Origin;
        let destination = trip.LegList.Leg.last().Destination;
        let [startTime,] = this._parseTime(origin.time, origin.date);
        let [endTime,] = this._parseTime(destination.time, destination.date);

        return new TransitPlan.Itinerary({ duration:  duration,
                                           departure: startTime,
                                           arrival:   endTime,
                                           legs:      legs});
    }

    /**
     * Parse a time and date string into a timestamp into an array with
     * an absolute timestamp in ms since Unix epoch and a timezone offset
     * for the provider's native timezone at the given time and date
     */
    _parseTime(time, date) {
        let timeText = '%sT%s'.format(date, time);
        Utils.debug('timeText: ' + timeText);
        let dateTime = GLib.DateTime.new_from_iso8601(timeText, this._tz);

        return [dateTime.to_unix() * 1000, dateTime.get_utc_offset() / 1000];
    }

    /**
     * Parse a subset of ISO 8601 duration expressions.
     * Handle hour and minute parts
     */
    _parseDuration(duration) {
        let match = duration.match(ISO_8601_DURATION_REGEXP);

        if (match) {
            let [,,h,,min] = match;

            return h * 3600 + min * 60;
        } else {
            Utils.debug('Unknown duration: ' + duration);

            return -1;
        }
    }

    _createLegs(legs) {
        return legs.map((leg, index, legs) => this._createLeg(leg, index, legs));
    }

    _createLeg(leg, index, legs) {
        let isTransit;

        if (leg.type === LegType.TRANSIT)
            isTransit = true;
        else if (leg.type === LegType.WALK || leg.type === LegType.TRANSFER)
            isTransit = false;
        else
            throw new Error('Unknown leg type: ' + leg.type);

        let origin = leg.Origin;
        let destination = leg.Destination;
        let product = leg.Product;

        if (!origin)
            throw new Error('Missing Origin element');
        if (!destination)
            throw new Error('Missing Destination element');
        if (!product && isTransit)
            throw new Error('Missing Product element for transit leg');

        let first = index === 0;
        let last = index === legs.length - 1;
        /* for walking legs in the beginning or end, use the name from the
         * query, so we get the names of the place the user searched for in
         * the results, when starting/ending at a transitstop, use the stop
         * name
         */
        let from =
            first && !isTransit ? this._query.filledPoints[0].place.name :
                                  origin.name;
        let to =
            last && !isTransit ? this._query.filledPoints.last().place.name :
                                 destination.name;
        let [departure, tzOffset] = this._parseTime(origin.time, origin.date);
        let [arrival,] = this._parseTime(destination.time, destination.date);
        let route = isTransit ? product.num : null;
        let routeType =
            isTransit ? this._getHVTCodeFromCatCode(product.catCode) : null;
        let agencyName = isTransit ? product.operator : null;
        let agencyUrl = isTransit ? product.operatorUrl : null;
        let polyline = this._createPolylineForLeg(leg);

        let result = new TransitPlan.Leg({ departure:            departure,
                                           arrival:              arrival,
                                           from:                 from,
                                           to:                   to,
                                           headsign:             leg.direction,
                                           fromCoordinate:       [origin.lat,
                                                                  origin.lon],
                                           toCoordinate:         [destination.lat,
                                                                  destination.lon],
                                           route:                route,
                                           routeType:            routeType,
                                           polyline:             polyline,
                                           isTransit:            isTransit,
                                           distance:             leg.distance,
                                           duration:             leg.duration,
                                           agencyName:           agencyName,
                                           agencyUrl:            agencyUrl,
                                           agencyTimezoneOffset: tzOffset,
                                           tripShortName:        route });

        if (isTransit)
            result.intermediateStops = this._createIntermediateStops(leg);

        return result;
    }

    _createPolylineForLeg(leg) {
        let polyline;

        if (leg.Stops && leg.Stops.Stop) {
            polyline = [];

            leg.Stops.Stop.forEach((stop) => {
                polyline.push(new Champlain.Coordinate({ latitude:  stop.lat,
                                                         longitude: stop.lon }));
            });
        } else {
            polyline =
                [new Champlain.Coordinate({ latitude:  leg.Origin.lat,
                                            longitude: leg.Origin.lon }),
                new Champlain.Coordinate({  latitude:  leg.Destination.lat,
                                            longitude: leg.Destination.lon })];
        }

        return polyline;
    }

    _createIntermediateStops(leg) {
        let result = [];

        if (!leg.Stops && !leg.Stops.Stop)
            throw new Error('Missing Stops element');

        leg.Stops.Stop.forEach((stop, index) => {
            if (index !== 0)
                result.push(this._createIntermediateStop(stop));
        });

        return result;
    }

    _createIntermediateStop(stop) {
        let [arrival, tzOffset] = this._parseTime(stop.arrTime, stop.arrDate);
        let departure =
            stop.depTime ? this._parseTime(stop.depTime, stop.depDate)[0] : null;

        return new TransitPlan.Stop({ name:                 stop.name,
                                      arrival:              arrival,
                                      departure:            departure,
                                      agencyTimezoneOffset: tzOffset,
                                      coordinate: [stop.lat, stop.lon] });
    }

    _getHVTCodeFromCatCode(code) {
        switch (code) {
            case CatCode.EXPRESS_TRAIN:
                return HVT.HIGH_SPEED_RAIL_SERVICE;
            case CatCode.REGIONAL_TRAIN:
                return HVT.REGIONAL_RAIL_SERVICE;
            case CatCode.EXPRESS_BUS:
                return HVT.EXPRESS_BUS;
            case CatCode.LOCAL_TRAIN:
                return HVT.SUBURBAN_RAILWAY_SERVICE;
            case CatCode.SUBWAY:
                return HVT.METRO_SERVICE;
            case CatCode.TRAM:
                return HVT.TRAM_SERVICE;
            case CatCode.BUS:
                return HVT.BUS_SERVICE;
            case CatCode.FERRY:
                return HVT.WATER_TRANSPORT_SERVICE;
            default:
                return HVT.MISCELLANEOUS_SERVICE;
        }
    }

    _getQueryParams() {
        let points = this._query.filledPoints;
        let originLocation = points[0].place.location;
        let destLocation = points.last().place.location;
        let params = { key:             this._key,
                       originCoordLat:  originLocation.latitude,
                       originCoordLong: originLocation.longitude,
                       destCoordLat:    destLocation.latitude,
                       destCoordLong:   destLocation.longitude,
                       format:          'json' };
        let transitOptions = this._query.transitOptions;

        if (this._query.arriveBy)
            params.searchForArrival = 1;

        if (this._query.time)
            params.time = this._query.time;

        if (this._query.date)
            params.date = this._query.date;

        if (!transitOptions.showAllTransitTypes)
            params.products = this._getAllowedProductsForQuery();

        return params;
    }

    _getAllowedProductsForQuery() {
        let products = 0;

        this._query.transitOptions.transitTypes.forEach((type) => {
            products += this._productCodeForTransitType(type);
        });

        return products;
    }

    _productCodeForTransitType(type) {
        switch (type) {
            case TransitPlan.RouteType.BUS:
                return Products.BUS + Products.EXPRESS_BUS;
            case TransitPlan.RouteType.TRAM:
                return Products.TRAM;
            case TransitPlan.RouteType.TRAIN:
                return Products.EXPRESS_TRAIN + Products.LOCAL_TRAIN;
            case TransitPlan.RouteType.SUBWAY:
                return Products.SUBWAY;
            case TransitPlan.RouteType.FERRY:
                return Products.FERRY;
            default:
                return 0;
        }
    }
}
