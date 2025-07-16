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

import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

import {Application} from '../application.js';
import * as GraphHopperTransit from '../graphHopperTransit.js';
import {Query} from '../http.js';
import * as HVT from '../hvt.js';
import * as Time from '../time.js';
import {Itinerary, Leg, RouteType, Stop} from '../transitPlan.js';
import * as Utils from '../utils.js';

const BASE_URL = 'https://api.resrobot.se';
const API_VERSION = 'v2.1';

// Timezone for timestamps returned by this provider
const NATIVE_TIMEZONE = 'Europe/Stockholm';

const ISO_8601_DURATION_REGEXP = new RegExp(/P((\d+)D)?T((\d+)H)?((\d+)M)?/);

const Products = {
    EXPRESS_TRAIN:  2,
    REGIONAL_TRAIN: 4,
    EXPRESS_BUS:    8,
    LOCAL_TRAIN:    16,
    SUBWAY:         32,
    TRAM:           64,
    BUS:            128,
    FERRY:          256,
    TAXI:           512
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
    FERRY:          8,
    TAXI:           9
};

const MAX_NUM_NEARBY_STOPS = 5;
const NEARBY_STOPS_SEARCH_RADIUS = 500;

// ignore walking legs at the beginning/end when below this distance
const DISTANCE_THREASHOLD_TO_IGNORE = 50;

// search radius to search for walk-only journeys
const WALK_SEARCH_RADIUS = 2000;

// maximum distance for walk-only journey
const MAX_WALK_ONLY_DISTANCE = 2500;

/* set of transit agencies where "regional rail" is interpreted as
 * HVT.TOURIST_RAILWAY_SERVICE, e.g. heritage rail
 */
const TOURIST_TRAIN_AGENCIES = new Set(['Engelsberg-Norbergs Jä',
                                        'Lennakatten',
                                        'TJF Smalspåret']);

export class Resrobot {
    constructor(params) {
        this._session = new Soup.Session({ user_agent : 'gnome-maps/' + pkg.version });
        this._plan = Application.routingDelegator.transitRouter.plan;
        this._query = Application.routeQuery;
        this._accessId = params.accessId;
        this._tz = GLib.TimeZone.new(NATIVE_TIMEZONE);

        if (!this._accessId)
            throw new Error('missing accessId');

        if (typeof(this._accessId) !== 'string' ||
            !GLib.uuid_string_is_valid(this._accessId)) {
            throw new Error('invalid accessId');
        }
    }
    
    cancelCurrentRequest() {
        //Do nothing.
    }

    fetchFirstResults() {
        let filledPoints = this._query.filledPoints;

        this._extendPrevious = false;
        this._viaId = null;

        if (filledPoints.length > 3) {
            Utils.debug('This plugin supports at most one via location');
            this._plan.reset();
            this._plan.requestFailed();
            this._query.reset();
        } else if (filledPoints.length === 2) {
            this._fetchResults();
        } else {
            let lat = filledPoints[1].place.location.latitude;
            let lon = filledPoints[1].place.location.longitude;

            this._fetchNearbyStops(lat, lon, MAX_NUM_NEARBY_STOPS,
                                   NEARBY_STOPS_SEARCH_RADIUS,
                                   () => this._fetchResults());
        }
    }

    fetchMoreResults() {
        this._extendPrevious = true;

        if ((!this._scrF && !this._query.arriveBy) ||
            (!this._scrB && this._query.arriveBy))
            this._noRouteFound();
        else
            this._fetchResults();
    }

    _fetchNearbyStops(lat, lon, num, radius, callback) {
        let query = new Query(this._getNearbyStopsQueryParams(lat, lon,
                                                              num, radius));
        let uri = BASE_URL + '/' + API_VERSION + '/location.nearbystops?' + query.toString();
        let request = Soup.Message.new('GET', uri);

        this._session.send_and_read_async(request, GLib.PRIORITY_DEFAULT, null,
                                          (source, res) => {
            if (request.get_status() !== Soup.Status.OK) {
                Utils.debug('Failed to get nearby stops: ' + request.get_status());
                this._noRouteFound();
            } else {
                try {
                    let buffer = this._session.send_and_read_finish(res).get_data();
                    let result = JSON.parse(Utils.getBufferText(buffer));
                    let stopLocations = result.stopLocationOrCoordLocation;

                    Utils.debug('nearby stops: ' + JSON.stringify(result, null, 2));

                    if (stopLocations?.length > 0) {
                        let extId = stopLocations[0]?.StopLocation.extId;

                        this._viaId = extId;
                        callback();
                    } else {
                        Utils.debug('No nearby stops found');
                        this._noRouteFound();
                    }
                } catch (e) {
                    Utils.debug('Error parsing result: ' + e);
                    this._plan.reset();
                    this._plan.requestFailed();
                }
            }
        });
    }

    _fetchResults() {
        let query = new Query(this._getQueryParams());
        let uri = BASE_URL + '/' + API_VERSION + '/trip?' + query.toString();
        let request = Soup.Message.new('GET', uri);

        this._session.send_and_read_async(request, GLib.PRIORITY_DEFAULT, null,
                                          (source, res) => {
            if (request.get_status() !== Soup.Status.OK) {
                Utils.debug('Failed to get trip: ' + request.get_status());
                /* No routes found. If this is the first search
                 * (not "load more") and the distance is short
                 * enough, generate a walk-only itinerary
                 */
                let [start, end, distance] =
                    this._getAsTheCrowFliesPointsAndDistanceForQuery();

                if (!this._extendPrevious &&
                    distance <= WALK_SEARCH_RADIUS) {
                    GraphHopperTransit.fetchWalkingRoute([start, end], (route) => {
                        if (route && route.distance <= MAX_WALK_ONLY_DISTANCE) {
                            let walkingItinerary =
                                this._createWalkingOnlyItinerary(start,
                                                                 end,
                                                                 route);
                            this._plan.updateWithNewItineraries([walkingItinerary]);
                        } else {
                            this._noRouteFound();
                        }
                    });
                } else {
                    this._noRouteFound();
                }
            } else {
                try {
                    let buffer = this._session.send_and_read_finish(res).get_data();
                    let result = JSON.parse(Utils.getBufferText(buffer));

                    Utils.debug('result: ' + JSON.stringify(result, null, 2));
                    if (result.Trip) {
                        let itineraries = this._createItineraries(result.Trip);

                        // store the back and forward references from the result
                        this._scrB = result.scrB;
                        this._scrF = result.scrF;
                        this._processItineraries(itineraries);
                    } else {
                        this._noRouteFound();
                    }
                } catch (e) {
                    Utils.debug('Error parsing result: ' + e);
                    this._plan.reset();
                    this._plan.requestFailed();
                }
            }
        });
    }

    /* get total "as the crow flies" start, and end points, and distance for
     * the query
     */
    _getAsTheCrowFliesPointsAndDistanceForQuery() {
        let start = this._query.filledPoints[0];
        let end = this._query.filledPoints.last();
        let startLoc = start.place.location;
        let endLoc = end.place.location;

        return [start, end, endLoc.get_distance_from(startLoc) * 1000];
    }

    _processItineraries(itineraries) {
        /* if this is the first request, and the distance is short enough,
         * add an additional walking-only itinerary at the beginning
         */
        let [start, end, distance] =
            this._getAsTheCrowFliesPointsAndDistanceForQuery();

        if (!this._extendPrevious && distance <= WALK_SEARCH_RADIUS) {
            GraphHopperTransit.fetchWalkingRoute([start, end], (route) => {
                if (route && route.distance <= MAX_WALK_ONLY_DISTANCE) {
                    let walkingItinerary =
                        this._createWalkingOnlyItinerary(start, end, route);

                    itineraries.unshift(walkingItinerary);
                }
                GraphHopperTransit.addWalkingToItineraries(itineraries,
                    () => this._plan.updateWithNewItineraries(itineraries,
                                                              this._query.arriveBy,
                                                              this._extendPrevious));
            });
        } else {
            GraphHopperTransit.addWalkingToItineraries(itineraries,
                () => this._plan.updateWithNewItineraries(itineraries,
                                                          this._query.arriveBy,
                                                          this._extendPrevious));
        }
    }

    _createWalkingOnlyItinerary(start, end, route) {
        let walkingLeg = GraphHopperTransit.createWalkingLeg(start, end,
                                                             start.place.name,
                                                             end.place.name,
                                                             route);
        let duration = route.duration;
        /* if the query has no date, just use a fake, since only the time
         * is relevant for displaying in this case
         */
        let date = this._query.date || '2019-01-01';
        let time = this._query.time + ':00';

        let [timestamp, tzOffset] =
            this._query.time ? this._parseTime(time, date) :
                               this._getTimestampAndTzOffsetNow();

        if (this._query.arriveBy) {
            walkingLeg.arrival = timestamp;
            walkingLeg.departure = timestamp - route.time;
        } else {
            walkingLeg.departure = timestamp;
            walkingLeg.arrival = timestamp + route.time;
        }

        walkingLeg.agencyTimezoneOffset = tzOffset;

        let walkingItinerary =
            new Itinerary({ legs: [walkingLeg]} );

        walkingItinerary.adjustTimings();

        return walkingItinerary;
    }

    /* Indicate that no routes where found, either shows the "No route found"
     * message, or in case of loading additional (later/earlier) results,
     * indicate no such where found, so that the sidebar can disable the
     * "load more" functionality as appropriate.
     */
    _noRouteFound() {
        if (this._extendPrevious) {
            this._plan.noMoreResults();
        } else {
            this._plan.noRouteFound();
        }
    }

    _createItineraries(trips) {
        return trips.map((trip) => this._createItinerary(trip));
    }

    _createItinerary(trip) {
        let legs = this._createLegs(trip.LegList.Leg);
        let itinerary = new Itinerary({ legs: legs });

        itinerary.adjustTimings();

        return itinerary;
    }

    /**
     * Parse a time and date string into a timestamp into an array with
     * an absolute timestamp in ms since Unix epoch and a timezone offset
     * for the provider's native timezone at the given time and date
     */
    _parseTime(time, date) {
        const timeText = `${date}T${time}`;

        return Time.parseTime(timeText, this._tz);
    }

    /**
     * Get absolute timestamp for "now" in ms and timezone offset in the
     * native timezone of the provider's native timezone @ "now"
     */
    _getTimestampAndTzOffsetNow() {
        let dateTime = GLib.DateTime.new_now(this._tz);

        return [dateTime.to_unix() * 1000, dateTime.get_utc_offset() / 1000];
    }

    /**
     * Parse a subset of ISO 8601 duration expressions.
     * Handle hour and minute parts
     */
    _parseDuration(duration) {
        let match = duration.match(ISO_8601_DURATION_REGEXP);

        if (match) {
            let [,,d,,h,,min] = match;

            return (d || 0) * 86400 + (h || 0) * 3600 + (min || 0) * 60;
        } else {
            Utils.debug('Unknown duration: ' + duration);

            return -1;
        }
    }

    _createLegs(legs) {
        let result = legs.map((leg, index, legs) => this._createLeg(leg, index, legs));

        if (this._canLegBeIgnored(result[0]))
            result.shift();

        if (this._canLegBeIgnored(result.last()))
            result.splice(-1);

        return result;
    }

    /* determines if a leg can ignored at the start or end, to catch the
     * case when the user probably meant to search for a trip from a transit
     * stop anyway
     */
    _canLegBeIgnored(leg) {
        if (!leg.isTransit) {
            /* check that the distance is below the threshold and also that
             * the duration is below 1 min, since the API in some occasions
             * apparently gives distance 0, even though a walking leg has
             * longer duration, and spans a distance in coordinates.
             */
            return leg.distance <= DISTANCE_THREASHOLD_TO_IGNORE &&
                   leg.duration <= 60;
        } else {
            return false;
        }
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
        let product = leg.Product?.[0];

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
        let duration = leg.duration ? this._parseDuration(leg.duration) : null;
        let intermediateStops = isTransit ? this._createIntermediateStops(leg) : null;

        /* if the route leg is classified as regional rail and the agency
         * is one of the heritage railways, use tourist rail to get the
         * steam train icon
         */
        if ((routeType === HVT.REGIONAL_RAIL_SERVICE ||
             routeType === HVT.SUBURBAN_RAILWAY_SERVICE ) &&
            TOURIST_TRAIN_AGENCIES.has(agencyName)) {
            routeType = HVT.TOURIST_RAILWAY_SERVICE;
        }

        return new Leg({ departure:            departure,
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
                         isTransit:            isTransit,
                         distance:             leg.dist,
                         duration:             duration,
                         agencyName:           agencyName,
                         agencyTimezoneOffset: tzOffset,
                         tripShortName:        route,
                         intermediateStops:    intermediateStops });
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
        let [departure, departureTzOffset] = [,];
        let [arrival, arrivalTzOffset] = [,];

        if (stop.depTime && stop.depDate)
            [departure, departureTzOffset] = this._parseTime(stop.depTime, stop.depDate);
        if (stop.arrTime && stop.arrDate)
            [arrival, arrivalTzOffset] = this._parseTime(stop.arrTime, stop.arrDate);

        if (!arrival)
            arrival = departure;
        if (!departure)
            departure = arrival;

        return new Stop({ name:                 stop.name,
                          arrival:              arrival,
                          departure:            departure,
                          agencyTimezoneOffset: departureTzOffset || arrivalTzOffset,
                          coordinate: [stop.lat, stop.lon] });
    }

    _getHVTCodeFromCatCode(code) {
        switch (parseInt(code)) {
            case CatCode.EXPRESS_TRAIN:
                return HVT.HIGH_SPEED_RAIL_SERVICE;
            case CatCode.REGIONAL_TRAIN:
                return HVT.REGIONAL_RAIL_SERVICE;
            case CatCode.EXPRESS_BUS:
                return HVT.EXPRESS_BUS_SERVICE;
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
            case CatCode.TAXI:
                return HVT.COMMUNAL_TAXI_SERVICE;
            default:
                Utils.debug('Unknown catCode: ' + code);
                return HVT.MISCELLANEOUS_SERVICE;
        }
    }

    _getQueryParams() {
        let points = this._query.filledPoints;
        let originLocation = points[0].place.location;
        let destLocation = points.last().place.location;
        let transitOptions = this._query.transitOptions;
        let params = { accessId:        this._accessId,
                       originCoordLat:  originLocation.latitude,
                       originCoordLong: originLocation.longitude,
                       destCoordLat:    destLocation.latitude,
                       destCoordLong:   destLocation.longitude,
                       passlist:        1,
                       format:          'json' };

        if (!transitOptions.showAllTransitTypes)
            params.products = this._getAllowedProductsForQuery();

        if (this._viaId)
            params.viaId = this._viaId;

        if (this._extendPrevious) {
            params.context = this._query.arriveBy ? this._scrB : this._scrF;
        } else  {
            if (this._query.arriveBy)
                params.searchForArrival = 1;

            if (this._query.time)
                params.time = this._query.time;

            if (this._query.date)
                params.date = this._query.date;
        }

        return params;
    }

    _getNearbyStopsQueryParams(lat, lon, num, radius) {
        let params = { accessId:        this._accessId,
                       originCoordLat:  lat,
                       originCoordLong: lon,
                       maxNo:           num,
                       r:               radius,
                       format:          'json' };

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
            case RouteType.BUS:
                return Products.BUS + Products.EXPRESS_BUS + Products.TAXI;
            case RouteType.TRAM:
                return Products.TRAM;
            case RouteType.TRAIN:
                return Products.EXPRESS_TRAIN + Products.LOCAL_TRAIN;
            case RouteType.SUBWAY:
                return Products.SUBWAY;
            case RouteType.FERRY:
                return Products.FERRY;
            default:
                return 0;
        }
    }
}
