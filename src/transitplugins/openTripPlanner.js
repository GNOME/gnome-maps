/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2017 Marcus Lundblad
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

import gettext from 'gettext';

import GLib from 'gi://GLib';
import Shumate from 'gi://Shumate';
import Soup from 'gi://Soup';

import {Application} from '../application.js';
import * as EPAF from '../epaf.js';
import * as GraphHopperTransit from '../graphHopperTransit.js';
import {Query} from '../http.js';
import * as HVT from '../hvt.js';
import {Location} from '../location.js';
import {Place} from '../place.js';
import {TurnPoint} from '../route.js';
import {RouteQuery} from '../routeQuery.js';
import {Itinerary, Leg, RouteType, Stop} from '../transitPlan.js';
import * as Utils from '../utils.js';

const _ = gettext.gettext;

/**
 * This module implements the interface for communicating with an OpenTripPlanner
 * server instance.
 * The code is somewhat intricate since it supports instances of OpenTripPlanner
 * running both with and without OSM data to complement the transit timetable
 * data with turn-by-turn (walking) routing.
 *
 * There is two entry points for obtaining routes, one which is called by the
 * routing delegator when the query is being modified (fetchFirstResults()),
 * and the other being called when requesting additional results (later or
 * earlier alternatives depending on search criteria) (fetchMoreResults())
 * These call into an entry point function "_fatchRoute()".
 * "_fetchRoutes()" is called.
 * In the case where there is no OSM data (onlyTransitData is true), it
 * asynchronously calls "_fetchTransitStops()" to get closest transit stop for
 * each of the query point, this function will involve OpenTripPlanner calls to
 * find stops within a search circle around the coordinate and then calls out
 * to GraphHopper to find the actual walking distance and selects the closest
 * stop.
 * In the callback for the results of _fetchTransitStops() the actual call to
 * OpenTripPlanner is made.
 * The callback for "_fetchRoutes()" will in turn reformat the resulting
 * itineraries obtained from OpenTripPlanner into our internal format specified
 * in the TransitPlan module and calls "_recalculateItineraries()" which will
 * traverse these and do yet another recursive asyncrous pass over these results
 * to refine the results with actual walking routes obtained from GraphHopper,
 * since the results from our OpenTripPlanner instance with only transit data
 * will result in walking legs which use "as the crow flies" routes for walking.
 * It will also clean up the results by pruning out pointless transit legs, such
 * as taking transit very short distances when almost reaching the target.
 *
 * API docs for OpenTripPlanner can be found at: http://dev.opentripplanner.org/apidoc/1.0.0/
 */

/* minimum distance when an explicit walk route will be requested to supplement
 * the transit route
 */
const MIN_WALK_ROUTING_DISTANCE = 100;

/* minimum distance of a transit leg, below which we would replace the leg with
 * walking if the leg is the first or last
 */
const MIN_TRANSIT_LEG_DISTANCE = 300;

/* maximum walking distance for a potential replacement of a beginning or ending
 * transit leg */
const MAX_WALK_OPTIMIZATION_DISTANCE = 1000;

/* maximum distance difference for performing a replacement of a beginning or
 * ending transit leg with a walking leg
 */
const MAX_WALK_OPTIMIZATION_DISTANCE_DIFFERENCE = 500;

/* minimum acceptable time margin when recalculating walking legs in the middle
 * of an itinerary
 */
const MIN_INTERMEDIATE_WALKING_SLACK = 60;

/* maximum walking distance, filter out itineraries containing walking legs
 * with longer walking after being refined by GraphHopper
 */
const MAX_WALKING_DISTANCE = 2000;

// maximum radius to search for stops
const STOP_SEARCH_RADIUS = 2000;

// maximum number of transit stops to consider as candidates for start/end points
const NUM_STOPS_TO_TRY = 5;

// gap to use when fetching additional routes
const GAP_BEFORE_MORE_RESULTS = 120;

// list of trusted base URLs for known OTP instances
const KNOWN_BASE_URLS = ['https://planner.sncft.com.tn/otp',
                   'https://otpdjerba.herokuapp.com/otp',
                   'https://api.digitransit.fi/routing/v1/',
                   'https://www.metromobilite.fr/otp'];

const KNOWN_ROUTER_URLS = ['https://maps.trimet.org/otp_mod'];

export class OpenTripPlanner {

    constructor(params) {
        let onlyTransitDataEnv = GLib.getenv('OTP_ONLY_TRANSIT_DATA');
        let onlyTransitData =
            onlyTransitDataEnv ? onlyTransitDataEnv === 'true' :
            params?.onlyTransitData ?? false;

        this._session = new Soup.Session({ user_agent : 'gnome-maps/' + pkg.version });
        this._plan = Application.routingDelegator.transitRouter.plan;
        this._query = Application.routeQuery;
        this._baseUrl = GLib.getenv('OTP_BASE_URL') ?? params.baseUrl;
        this._router = params?.router ?? 'default';
        this._routerUrl = params?.routerUrl;
        this._onlyTransitData = onlyTransitData;
        this._extendPrevious = false;
        this._language = Utils.getLanguage();
        this._authHeader = GLib.getenv('OTP_AUTH_HEADER') ?? params.authHeader;
        this._authKey = GLib.getenv('OTP_AUTH_KEY') ?? params.authKey;

        if (!this._isValidParams(params))
            throw new Error('invalid parameters');

        if (!this._baseUrl && !this._routerUrl)
            throw new Error('must specify either baseUrl or routerUrl as an argument');

        if (this._baseUrl && this._routerUrl)
            throw new Error('can not specify both baseUrl and routerUrl as arguments');
    }

    cancelCurrentRequest() {
        //Do nothing.
    }

    _isValidParams(params) {
        if (params.onlyTransitData && typeof(params.onlyTransitData) !== 'boolean') {
            Utils.debug('invalid value for onlyTransitData');
            return false;
        }

        // refuse to use unknown URLs to OTP instances
        if (params.baseUrl && KNOWN_BASE_URLS.indexOf(params.baseUrl) === -1) {
            Utils.debug(`refusing unknown base URL ${params.baseUrl}`);
            return false;
        }

        if (params.routerUrl &&
            KNOWN_ROUTER_URLS.indexOf(params.routerUrl) === -1) {
            Utils.debug(`refusing unknown router URL ${params.routerUrl}`);
            return false;
        }

        return true;
    }

    get plan() {
        return this._plan;
    }

    get enabled() {
        return this._baseUrl !== null;
    }

    fetchFirstResults() {
        this._extendPrevious = false;
        this._fetchRoute();
    }

    fetchMoreResults() {
        this._extendPrevious = true;
        this._fetchRoute();
    }

    _getRouterUrl() {
        return this._routerUrl ? this._routerUrl :
                                 this._baseUrl + '/routers/' + this._router;
    }

    _getMode(routeType) {
        switch (routeType) {
        case RouteType.TRAM:
            return 'TRAM';
        case RouteType.TRAIN:
            return 'RAIL';
        case RouteType.SUBWAY:
            return 'SUBWAY';
        case RouteType.BUS:
            return 'BUS';
        case RouteType.FERRY:
            return 'FERRY';
        case HVT.AIR_SERVICE:
            return 'AIRPLANE';
        default:
            throw new Error('unhandled route type');
        }
    }

    _getModes(options) {
        let modes = options.transitTypes.map((transitType) => {
            return this._getMode(transitType);
        });

        /* should always include walk when setting explicit modes,
         * otherwise only routes ending close to a stop would work
         */
        modes.push('WALK');

        return modes.join(',');
    }

    _selectBestStopRecursive(stops, index, stopIndex, callback) {
        if (index < stops.length) {
            let points = this._query.filledPoints;
            let stop = stops[index];
            let stopPoint =
                GraphHopperTransit.createQueryPointForCoord([stop.lat, stop.lon]);

            if (stops[0].dist < 100) {
                /* if the stop is close enough to the intended point, just
                 * return the top most from the the original query */
                this._selectBestStopRecursive(stops, index + 1, stopIndex,
                                              callback);
            } else if (stopIndex === 0) {
                GraphHopperTransit.fetchWalkingRoute([points[0], stopPoint],
                                        (route) => {
                    /* if we couldn't find an exact walking route, go with the
                     * "as the crow flies" distance */
                    if (route)
                        stop.dist = route.distance;
                    this._selectBestStopRecursive(stops, index + 1, stopIndex,
                                                  callback);
                });
            } else if (stopIndex === points.length - 1) {
                GraphHopperTransit.fetchWalkingRoute([stopPoint, points.last()],
                                                     (route) => {
                    if (route)
                        stop.dist = route.distance;
                    this._selectBestStopRecursive(stops, index + 1, stopIndex,
                                                  callback);
                });
            } else {
                /* for intermediate stops just return the one geographically
                 * closest */
                this._selectBestStopRecursive(stops, index + 1, stopIndex,
                                              callback);
            }
        } else {
            /* re-sort stops by distance and select the closest after refining
             * distances */
            stops.sort(this._sortTransitStops);
            Utils.debug('refined stops: ');
            stops.forEach((stop) => Utils.debug(JSON.stringify(stop, '', 2)));
            callback(stops[0]);
        }
    }

    /* stopIndex here is the index of stop (i.e. starting point, intermediate
     * stop, final stop
     */
    _selectBestStop(stops, stopIndex, callback) {
        this._selectBestStopRecursive(stops, 0, stopIndex, callback);
    }

    _sortTransitStops(s1, s2) {
        return s1.dist > s2.dist;
    }

    _createMessage(uri) {
        let request = Soup.Message.new('GET', uri);

        request.request_headers.append('Accept', 'application/json');

        if (this._authHeader && this._authKey)
            request.request_headers.append(this._authHeader, this._authKey);

        return request;
    }

    _fetchRoutesForStop(stop, callback) {
        let query = new Query();
        let uri = this._getRouterUrl() + '/index/stops/' + stop.id + '/routes';
        let request = this._createMessage(uri);

        this._session.send_and_read_async(request, GLib.PRIOITY_DEFAULT, null,
                                          (source, res) => {
            if (request.get_status() !== Soup.Status.OK) {
                Utils.debug('Failed to get routes for stop');
                this._reset();
            } else {
                let buffer = this._session.send_and_read_finish(res).get_data();
                let routes = JSON.parse(Utils.getBufferText(buffer));

                Utils.debug('Routes for stop: ' + stop + ': ' + JSON.stringify(routes));
                callback(routes);
            }
        });
    }

    _routeMatchesSelectedModes(route) {
        let desiredTransitTypes = this._query.transitOptions.transitTypes;

        for (let i = 0; i < desiredTransitTypes.length; i++) {
            let type = desiredTransitTypes[i];

            if (type === RouteType.TRAM && route.mode === 'TRAM')
                return true;
            else if (type === RouteType.SUBWAY && route.mode === 'SUBWAY')
                return true;
            else if (type === RouteType.TRAIN && route.mode === 'RAIL')
                return true;
            else if (type === RouteType.BUS &&
                     (route.mode === 'BUS' || route.mode === 'TAXI'))
                return true;
            else if (type === RouteType.FERRY && route.mode === 'FERRY')
                return true;
        }

        return false;
    }

    _filterStopsRecursive(stops, index, filteredStops, callback) {
        if (index < stops.length) {
            let stop = stops[index];

            this._fetchRoutesForStop(stop, (routes) => {
                for (let i = 0; i < routes.length; i++) {
                    let route = routes[i];

                    if (this._routeMatchesSelectedModes(route)) {
                        filteredStops.push(stop);
                        break;
                    }
                }
                this._filterStopsRecursive(stops, index + 1, filteredStops,
                                           callback);
            });
        } else {
            callback(filteredStops);
        }
    }

    _filterStops(stops, callback) {
        this._filterStopsRecursive(stops, 0, [], callback);
    }

    _fetchTransitStopsRecursive(index, result, callback) {
        let points = this._query.filledPoints;

        if (index < points.length) {
            let point = points[index];
            let params = { lat: point.place.location.latitude,
                           lon: point.place.location.longitude,
                           radius: STOP_SEARCH_RADIUS };
            let query = new Query(params);
            let uri = this._getRouterUrl() + '/index/stops?' + query.toString();
            let request = this._createMessage(uri);

            this._session.send_and_read_async(request, GLib.PRIORITY_DEFAULT, null,
                                              (source, res) => {
                if (request.get_status() !== Soup.Status.OK) {
                    Utils.debug('Failed to get stop for search point ' + point);
                    this._reset();
                } else {
                    let buffer = this._session.send_and_read_finish(res).get_data();
                    let stops = JSON.parse(Utils.getBufferText(buffer));

                    if (stops.length === 0) {
                        Utils.debug('No suitable stop found from router');
                        callback(null);
                        return;
                    }

                    if (this._query.transitOptions.showAllTransitTypes) {
                        stops.sort(this._sortTransitStops);
                        stops = stops.splice(0, NUM_STOPS_TO_TRY);

                        Utils.debug('stops: ' + JSON.stringify(stops, '', 2));
                        this._selectBestStop(stops, index, (stop) => {
                            result.push(stop);
                            this._fetchTransitStopsRecursive(index + 1, result,
                                                             callback);
                        });
                    } else {
                        this._filterStops(stops, (filteredStops) => {
                            filteredStops.sort(this._sortTransitStops);
                            filteredStops = filteredStops.splice(0, NUM_STOPS_TO_TRY);

                            if (filteredStops.length === 0) {
                                Utils.debug('No suitable stop found using selected transit modes');
                                callback(null);
                                return;
                            }

                            this._selectBestStop(filteredStops, index, (stop) => {
                                result.push(stop);
                                this._fetchTransitStopsRecursive(index + 1,
                                                                 result, callback);
                            });
                        });
                    }
                }
            });
        } else {
            callback(result);
        }
    }

    _fetchTransitStops(callback) {
        this._fetchTransitStopsRecursive(0, [], callback);
    }

    // get a time suitably formatted for the OpenTripPlanner query param
    _formatTime(time, offset) {
        let utcTimeWithOffset = (time + offset) / 1000;
        let date = GLib.DateTime.new_from_unix_utc(utcTimeWithOffset);

        return date.format('%R');
    }

    // get a date suitably formatted for the OpenTripPlanner query param
    _formatDate(time, offset) {
        let utcTimeWithOffset = (time + offset) / 1000;
        let date = GLib.DateTime.new_from_unix_utc(utcTimeWithOffset);

        return date.format('%F');
    }

    _getPlaceParamFromLocation(location) {
        return location.latitude + ',' + location.longitude;
    }

    _addCommonParams(params) {
        params.numItineraries = 5;
        params.showIntermediateStops = true;
        params.locale = this._language;

        let time = this._query.time;
        let date = this._query.date;

        if (this._extendPrevious) {
            let itineraries = this.plan.itineraries;
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
            if (time) {
                params.time = time;
                /* it seems OTP doesn't like just setting a time, so if the query
                 * doesn't specify a date, go with today's date
                 */
                if (!date) {
                    let dateTime = GLib.DateTime.new_now_local();

                    params.date = dateTime.format('%F');
                }
            }

            if (date)
                params.date = date;
        }

        if (this._query.arriveBy)
            params.arriveBy = true;

        let options = this._query.transitOptions;
        if (options && !options.showAllTransitTypes)
            params.mode = this._getModes(options);
    }

    _createParamsWithLocations() {
        let points = this._query.filledPoints;
        let params = {
            fromPlace: this._getPlaceParamFromLocation(points[0].place.location),
            toPlace: this._getPlaceParamFromLocation(points[points.length - 1].place.location) };
        let intermediatePlaces = [];

        for (let i = 1; i < points.length - 1; i++) {
            let location = points[i].place.location;
            intermediatePlaces.push(this._getPlaceParamFromLocation(location));
        }
        if (intermediatePlaces)
            params.intermediatePlaces = intermediatePlaces;

        params.maxWalkDistance = 2500;
        this._addCommonParams(params);

        return params;
    }

    // create parameter map for the request, given query and options
    _createParamsWithStops(stops) {
        let params = { fromPlace: stops[0].id,
                       toPlace: stops.last().id };
        let intermediatePlaces = [];

        for (let i = 1; i < stops.length - 1; i++) {
            intermediatePlaces.push(stops[i].id);
        }
        if (intermediatePlaces.length > 0)
            params.intermediatePlaces = intermediatePlaces;

        /* set walking speed for transfers to a slightly lower value to
         * compensate for running OTP with only transit data, giving straight-
         * line walking paths
         */
        params.walkSpeed = 1.0;

        this._addCommonParams(params);

        return params;
    }

    _fetchPlan(url, callback) {
        let request = this._createMessage(url);

        this._session.send_and_read_async(request, GLib.PRIORITY_DEFAULT, null,
                                          (source, res) => {
            if (request.get_status() !== Soup.Status.OK) {
                Utils.debug('Failed to get route plan from router ' +
                            this._router + ' ' + request.reason_phrase);
                callback(null);
            } else {
                try {
                    let buffer = this._session.send_and_read_finish(res).get_data();
                    let result = JSON.parse(Utils.getBufferText(buffer));

                    callback(result);
                } catch (e) {
                    Utils.debug('Error parsing result: ' + e);
                    callback(null);
                }
            }
        });
    }

    _getPlanUrlFromParams(params) {
        let query = new Query(params);

        return this._getRouterUrl() + '/plan?' + query.toString();
    }

    _getPlanUrlWithStops(stops) {
        return this._getPlanUrlFromParams(this._createParamsWithStops(stops));
    }

    _getPlanUrlWithLocations() {
        return this._getPlanUrlFromParams(this._createParamsWithLocations());
    }

    _fetchRoutes(callback) {
        if (this._onlyTransitData) {
            this._fetchTransitStops((stops) => {
                let points = this._query.filledPoints;

                if (!stops) {
                    callback(null);
                    return;
                }

                /* if there's only a start and end stop (no intermediate stops)
                 * and those stops are identical, reject the routing, since this
                 * means there would be no point in transit, and OTP would give
                 * some bizarre option like boarding transit, go one stop and then
                 * transfer to go back the same route
                 */
                if (stops.length === 2 && stops[0].id === stops[1].id) {
                    callback(null);
                    return;
                }

                this._fetchPlan(this._getPlanUrlWithStops(stops), callback);
            });
        } else {
            this._fetchPlan(this._getPlanUrlWithLocations(), callback);
        }
    }

    _reset() {
        this._extendPrevious = false;
        if (this._query.latest)
            this._query.latest.place = null;
        else
            this.plan.reset();
    }

    /* Indicate that no routes where found, either shows the "No route found"
     * message, or in case of loading additional (later/earlier) results,
     * indicate no such where found, so that the sidebar can disable the
     * "load more" functionality as appropriate.
     */
    _noRouteFound() {
        if (this._extendPrevious) {
            this._extendPrevious = false;
            this.plan.noMoreResults();
        } else {
            this.plan.noRouteFound();
        }
    }

    _fetchRoute() {
        let points = this._query.filledPoints;

        this._fetchRoutes((route) => {
            if (route) {
                let itineraries = [];
                let plan = route.plan;

                Utils.debug('route: ' + JSON.stringify(route, null, 2));

                if (plan && plan.itineraries) {
                    itineraries =
                        itineraries.concat(
                            this._createItineraries(plan.itineraries));
                } else if (route.itineraries) {
                    itineraries =
                        itineraries.concat(
                            this._createItineraries(route.itineraries));
                }

                if (itineraries.length === 0) {
                    /* don't reset query points, unlike for turn-based
                     * routing, since options and timing might influence
                     * results */
                    this._noRouteFound();
                } else {
                    if (this._onlyTransitData)
                        this._recalculateItineraries(itineraries);
                    else
                        this._updateWithNewItineraries(itineraries);
                }
            } else {
                this._noRouteFound();
            }
        });
    }

    _isOnlyWalkingItinerary(itinerary) {
        return itinerary.legs.length === 1 && !itinerary.legs[0].transit;
    }

    _recalculateItineraries(itineraries) {
        // filter out itineraries with only walking
        let newItineraries = [];

        itineraries.forEach((itinerary) => {
            if (!this._isOnlyWalkingItinerary(itinerary))
                newItineraries.push(itinerary);
        });

        /* TODO: should we always calculate a walking itinerary to put at the
         * top if the total distance is below some threashhold?
         */
        this._recalculateItinerariesRecursive(newItineraries, 0);
    }

    _isItineraryRealistic(itinerary) {
        for (let i = 0; i < itinerary.legs.length; i++) {
            let leg = itinerary.legs[i];

            if (!leg.transit) {
                /* if a walking leg exceeds the maximum desired walking
                 * distance, or for a leg "in-between" two transit legs, if
                 * there's insufficient switch time
                 */
                if (leg.distance > MAX_WALKING_DISTANCE) {
                    return false;
                } else if (i >= 1 && i < itinerary.legs.length - 1) {
                    let previousLeg = itinerary.legs[i - 1];
                    let nextLeg = itinerary.legs[i + 1];

                    let availableTime =
                        (nextLeg.departure - previousLeg.arrival) / 1000;

                    if (availableTime <
                        leg.duration + MIN_INTERMEDIATE_WALKING_SLACK)
                        return false;
                }
            }
        }

        return true;
    }

    /**
     * Update plan with new itineraries, setting the new itineraries if it's
     * the first fetch for a query, or extending the existing ones if it's
     * a request to load more
     */
    _updateWithNewItineraries(itineraries) {
        this.plan.updateWithNewItineraries(itineraries, this._query.arriveBy,
                                           this._extendPrevious);
        this._extendPrevious = false;
    }

    _recalculateItinerariesRecursive(itineraries, index) {
        if (index < itineraries.length) {
            this._recalculateItinerary(itineraries[index], (itinerary) => {
                itineraries[index] = itinerary;
                this._recalculateItinerariesRecursive(itineraries, index + 1);
            });
        } else {
            /* filter out itineraries where there are intermediate walking legs
             * that are too narrow time-wise, this is necessary since running
             * OTP with only transit data can result in some over-optimistic
             * walking itinerary legs, since it will use "line-of-sight"
             * distances.
             * also filter out itineraries where recalculation process ended
             * up with just walking
             */
            let filteredItineraries = [];

            itineraries.forEach((itinerary) => {
                if (this._isItineraryRealistic(itinerary) &&
                    !this._isOnlyWalkingItinerary(itinerary))
                    filteredItineraries.push(itinerary);
            });

            if (filteredItineraries.length > 0) {
                filteredItineraries.forEach((itinerary) => itinerary.adjustTimings());
                this._updateWithNewItineraries(filteredItineraries);
            } else {
                this._noRouteFound();
            }
        }
    }

    _recalculateItinerary(itinerary, callback) {
        let from = this._query.filledPoints[0];
        let to = this._query.filledPoints.last();

        if (itinerary.legs.length === 1 && !itinerary.legs[0].transit) {
            /* special case, if there's just one leg of an itinerary, and that leg
             * leg is a non-transit (walking), recalculate the route in its entire
             * using walking
             */
            GraphHopperTransit.fetchWalkingRoute(this._query.filledPoints,
                                                 (route) => {
                let leg = GraphHopperTransit.createWalkingLeg(from, to,
                                                              from.place.name,
                                                              to.place.name,
                                                              route);
                let newItinerary =
                    new Itinerary({departure: itinerary.departure,
                                               duration: route.time / 1000,
                                               legs: [leg]});
                callback(newItinerary);
            });
        } else if (itinerary.legs.length === 1 && itinerary.legs[0].transit) {
            // special case if there is exactly one transit leg
            let leg = itinerary.legs[0];
            let startLeg = GraphHopperTransit.createQueryPointForCoord(leg.fromCoordinate);
            let endLeg = GraphHopperTransit.createQueryPointForCoord(leg.toCoordinate);
            let fromLoc = from.place.location;
            let startLoc = startLeg.place.location;
            let endLoc = endLeg.place.location;
            let toLoc = to.place.location;
            let startWalkDistance = fromLoc.get_distance_from(startLoc) * 1000;
            let endWalkDistance = endLoc.get_distance_from(toLoc) * 1000;

            if (startWalkDistance >= MIN_WALK_ROUTING_DISTANCE &&
                endWalkDistance >= MIN_WALK_ROUTING_DISTANCE) {
                /* add an extra walking leg to both the beginning and end of the
                 * itinerary
                 */
                GraphHopperTransit.fetchWalkingRoute([from, startLeg],
                                                     (firstRoute) => {
                    let firstLeg =
                        GraphHopperTransit.createWalkingLeg(from, startLeg,
                                                            from.place.name,
                                                            leg.from, firstRoute);
                    GraphHopperTransit.fetchWalkingRoute([endLeg, to],
                                                         (lastRoute) => {
                        let lastLeg =
                            GraphHopperTransit.createWalkingLeg(endLeg, to,
                                                                leg.to,
                                                                to.place.name,
                                                                lastRoute);
                        itinerary.legs.unshift(firstLeg);
                        itinerary.legs.push(lastLeg);
                        callback(itinerary);
                    });
                });
            } else if (endWalkDistance >= MIN_WALK_ROUTING_DISTANCE) {
                // add an extra walking leg to the end of the itinerary
                GraphHopperTransit.fetchWalkingRoute([endLeg, to],
                                                     (lastRoute) => {
                    let lastLeg =
                        GraphHopperTransit.createWalkingLeg(endLeg, to, leg.to,
                                                            to.place.name,
                                                            lastRoute);
                    itinerary.legs.push(lastLeg);
                    callback(itinerary);
                });
            } else {
                /* if only there's only a walking leg to be added to the start
                 * let the recursive routine dealing with multi-leg itineraries
                 * handle it
                 */
                this._recalculateItineraryRecursive(itinerary, 0, callback);
            }
        } else {
            /* replace walk legs with GraphHopper-generated paths (hence the
             * callback nature of this. Filter out unrealistic itineraries (having
             * walking segments not possible in reasonable time, due to our running
             * of OTP with only transit data).
             */
            this._recalculateItineraryRecursive(itinerary, 0, callback);
        }
    }

    _recalculateItineraryRecursive(itinerary, index, callback) {
        if (index < itinerary.legs.length) {
            let leg = itinerary.legs[index];
            if (index === 0) {
                let from = this._query.filledPoints[0];
                let startLeg =
                    GraphHopperTransit.createQueryPointForCoord(leg.fromCoordinate);
                let endLeg =
                    GraphHopperTransit.createQueryPointForCoord(leg.toCoordinate);
                let fromLoc = from.place.location;
                let startLegLoc = startLeg.place.location;
                let endLegLoc = endLeg.place.location;
                let distanceToEndLeg =
                    fromLoc.get_distance_from(endLegLoc) * 1000;
                let distanceToStartLeg =
                    fromLoc.get_distance_from(startLegLoc) * 1000;
                let nextLeg = itinerary.legs[index + 1];

                if (!leg.transit ||
                    ((leg.distance <= MIN_TRANSIT_LEG_DISTANCE ||
                     (distanceToEndLeg <= MAX_WALK_OPTIMIZATION_DISTANCE &&
                      distanceToEndLeg - distanceToStartLeg <=
                      MAX_WALK_OPTIMIZATION_DISTANCE_DIFFERENCE)) &&
                     itinerary.legs.length > 1)) {
                    /* if the first leg of the intinerary returned by OTP is a
                     * walking one, recalculate it with GH using the actual
                     * starting coordinate from the input query,
                     * also replace a transit leg at the start with walking if
                     * its distance is below a threashhold, to avoid suboptimal
                     * routes due to only running OTP with transit data,
                     * also optimize away cases where the routing would make one
                     * "pass by" a stop at the next step in the itinerary due to
                     * similar reasons
                     */
                    let to = GraphHopperTransit.createQueryPointForCoord(leg.toCoordinate);
                    let toName = leg.to;

                    /* if the next leg is a walking one, "fold" it into the one
                     * we create here */
                    if (nextLeg && !nextLeg.transit) {
                        to = GraphHopperTransit.createQueryPointForCoord(nextLeg.toCoordinate);
                        toName = nextLeg.to;
                        itinerary.legs.splice(index + 1, index + 1);
                    }

                    GraphHopperTransit.fetchWalkingRoute([from, to], (route) => {
                        let newLeg =
                            GraphHopperTransit.createWalkingLeg(from, to,
                                                                from.place.name,
                                                                toName, route);
                        itinerary.legs[index] = newLeg;
                        this._recalculateItineraryRecursive(itinerary, index + 1,
                                                            callback);
                    });
                } else {
                    /* introduce an additional walking leg calculated
                     * by GH in case the OTP starting point as far enough from
                     * the original starting point
                     */
                    let to = GraphHopperTransit.createQueryPointForCoord(leg.fromCoordinate);
                    let fromLoc = from.place.location;
                    let toLoc = to.place.location;
                    let distance = fromLoc.get_distance_from(toLoc) * 1000;

                    if (distance >= MIN_WALK_ROUTING_DISTANCE) {
                        GraphHopperTransit.fetchWalkingRoute([from, to],
                                                             (route) => {
                            let newLeg =
                                GraphHopperTransit.createWalkingLeg(from, to,
                                                                    from.place.name,
                                                                    leg.from,
                                                                    route);
                            itinerary.legs.unshift(newLeg);
                            /* now, next index will be two steps up, since we
                             * inserted a new leg
                             */
                            this._recalculateItineraryRecursive(itinerary,
                                                                index + 2,
                                                                callback);
                        });
                    } else {
                        this._recalculateItineraryRecursive(itinerary, index + 1,
                                                            callback);
                    }
                }
            } else if (index === itinerary.legs.length - 1) {
                let to = this._query.filledPoints.last();
                let startLeg =
                    GraphHopperTransit.createQueryPointForCoord(leg.fromCoordinate);
                let endLeg =
                    GraphHopperTransit.createQueryPointForCoord(leg.toCoordinate);
                let toLoc = to.place.location;
                let startLegLoc = startLeg.place.location;
                let endLegLoc = endLeg.place.location;
                let distanceFromEndLeg =
                    toLoc.get_distance_from(endLegLoc) * 1000;
                let distanceFromStartLeg =
                    toLoc.get_distance_from(startLegLoc) * 1000;
                let previousLeg = itinerary.legs[itinerary.legs.length - 2];

                if (!leg.transit ||
                    ((leg.distance <= MIN_TRANSIT_LEG_DISTANCE ||
                      (distanceFromStartLeg <= MAX_WALK_OPTIMIZATION_DISTANCE &&
                       distanceFromStartLeg - distanceFromEndLeg <=
                       MAX_WALK_OPTIMIZATION_DISTANCE_DIFFERENCE)) &&
                      itinerary.legs.length > 1)) {
                    /* if the final leg of the itinerary returned by OTP is a
                     * walking one, recalculate it with GH using the actual
                     * ending coordinate from the input query
                     * also replace a transit leg at the end with walking if
                     * its distance is below a threashhold, to avoid suboptimal
                     * routes due to only running OTP with transit data,
                     * also optimize away cases where the routing would make one
                     * "pass by" a stop at the previous step in the itinerary
                     * due to similar reasons
                     */
                    let finalTransitLeg;
                    let insertIndex;
                    if (leg.transit && previousLeg && !previousLeg.transit) {
                        /* if we optimize away the final transit leg, and the
                         * previous leg is a walking one, "fold" both into a
                         * single walking leg */
                        finalTransitLeg = previousLeg;
                        insertIndex = index -1;
                        itinerary.legs.pop();
                    } else {
                        finalTransitLeg = leg;
                        insertIndex = index;
                    }
                    let from =
                        GraphHopperTransit.createQueryPointForCoord(finalTransitLeg.fromCoordinate);
                    GraphHopperTransit.fetchWalkingRoute([from, to], (route) => {
                        let newLeg =
                            GraphHopperTransit.createWalkingLeg(from, to,
                                                   finalTransitLeg.from,
                                                   to.place.name, route);
                        itinerary.legs[insertIndex] = newLeg;
                        this._recalculateItineraryRecursive(itinerary,
                                                            insertIndex + 1,
                                                            callback);
                    });
                } else {
                    /* introduce an additional walking leg calculated by GH in
                     * case the OTP end point as far enough from the original
                     * end point
                     */
                    let from = GraphHopperTransit.createQueryPointForCoord(leg.toCoordinate);
                    let fromLoc = from.place.location;
                    let toLoc = to.place.location;
                    let distance = fromLoc.get_distance_from(toLoc) * 1000;

                    if (distance >= MIN_WALK_ROUTING_DISTANCE) {
                        GraphHopperTransit.fetchWalkingRoute([from, to],
                                                             (route) => {
                            let newLeg =
                                GraphHopperTransit.createWalkingLeg(from, to,
                                                leg.to, to.place.name, route);
                            itinerary.legs.push(newLeg);
                            /* now, next index will be two steps up, since we
                             * inserted a new leg
                             */
                            this._recalculateItineraryRecursive(itinerary,
                                                                 index + 2,
                                                                 callback);
                        });
                    } else {
                        this._recalculateItineraryRecursive(itinerary, index + 1,
                                                            callback);
                    }
                }
            } else {
                /* if an intermediate leg is a walking one, and it's distance is
                 * above the threashhold distance, calculate an exact route
                 */
                if (!leg.transit && leg.distance >= MIN_WALK_ROUTING_DISTANCE) {
                    let from = GraphHopperTransit.createQueryPointForCoord(leg.fromCoordinate);
                    let to = GraphHopperTransit.createQueryPointForCoord(leg.toCoordinate);

                    /* if the next leg is the final one of the itinerary,
                     * and it's shorter than the "optimize away" distance,
                     * create a walking leg all the way to the final destination
                     */
                    let nextLeg = itinerary.legs[index + 1];
                    if (index === itinerary.legs.length - 2 &&
                        nextLeg.distance <= MIN_TRANSIT_LEG_DISTANCE) {
                        to = this._query.filledPoints.last();
                        itinerary.legs.splice(index + 1, index + 1);
                    }

                    GraphHopperTransit.fetchWalkingRoute([from, to], (route) => {
                        let newLeg =
                            GraphHopperTransit.createWalkingLeg(from, to, leg.from,
                                                                leg.to, route);
                        itinerary.legs[index] = newLeg;
                        this._recalculateItineraryRecursive(itinerary,
                                                            index + 1,
                                                            callback);
                    });
                } else {
                    this._recalculateItineraryRecursive(itinerary, index + 1,
                                                        callback);
                }
            }
        } else {
            callback(itinerary);
        }
    }

    _createItineraries(itineraries) {
        return itineraries.map((itinerary) => this._createItinerary(itinerary));
    }

    _createItinerary(itinerary) {
        let legs = this._createLegs(itinerary.legs);
        return new Itinerary({ duration:  itinerary.duration,
                               transfers: itinerary.transfers,
                               departure: itinerary.startTime,
                               arrival:   itinerary.endTime,
                               legs:      legs});
    }

    _createLegs(legs) {
        return legs.map((leg, index, legs) => this._createLeg(leg, index, legs));
    }

    /* check if a string is a valid hex RGB string */
    _isValidHexColor(string) {
        if (string && string.length === 6) {
            let regex = /^[A-Fa-f0-9]/;

            return string.match(regex);
        }

        return false;
    }

    _createLeg(leg, index, legs) {
        let polyline = EPAF.decode(leg.legGeometry.points);
        let color = leg.routeColor && this._isValidHexColor(leg.routeColor) ?
                    leg.routeColor : null;
        let textColor = leg.routeTextColor && this._isValidHexColor(leg.routeTextColor) ?
                        leg.routeTextColor : null;
        let first = index === 0;
        let last = index === legs.length - 1;
        /* for walking legs in the beginning or end, use the name from the
         * query, so we get the names of the place the user searched for in
         * the results, when starting/ending at a transitstop, use the stop
         * name
         */
        let from =
            first && !leg.transitLeg ? this._query.filledPoints[0].place.name :
                                       leg.from.name;
        let to =
            last && !leg.transitLeg ? this._query.filledPoints.last().place.name :
                                      leg.to.name;

        let result = new Leg({ departure:            leg.from.departure,
                               arrival:              leg.to.arrival,
                               from:                 from,
                               to:                   to,
                               headsign:             leg.headsign,
                               fromCoordinate:       [leg.from.lat,
                                                      leg.from.lon],
                               toCoordinate:         [leg.to.lat,
                                                      leg.to.lon],
                               route:                leg.route,
                               routeType:            leg.routeType,
                               polyline:             polyline,
                               isTransit:            leg.transitLeg,
                               distance:             leg.distance,
                               duration:             leg.duration,
                               agencyName:           leg.agencyName,
                               agencyUrl:            leg.agencyUrl,
                               agencyTimezoneOffset: leg.agencyTimeZoneOffset,
                               color:                color,
                               textColor:            textColor,
                               tripShortName:        leg.tripShortName });

        if (leg.transitLeg && leg.intermediateStops)
            result.intermediateStops = this._createIntermediateStops(leg);
        else if (!this._onlyTransitData)
            result.walkingInstructions = this._createTurnpoints(leg, polyline);

        return result;
    }

    _createIntermediateStops(leg) {
        let stops = leg.intermediateStops;
        let intermediateStops =
            stops.map((stop) => this._createIntermediateStop(stop, leg));

        /* instroduce an extra stop at the end (in additional to the
         * intermediate stops we get from OTP
         */
        intermediateStops.push(new Stop({ name: leg.to.name,
                                          arrival: leg.to.arrival,
                                          agencyTimezoneOffset: leg.agencyTimeZoneOffset,
                                          coordinate: [leg.to.lat,
                                                       leg.to.lon] }));
        return intermediateStops;
    }

    _createIntermediateStop(stop, leg) {
        return new Stop({ name:       stop.name,
                          arrival:    stop.arrival,
                          departure:  stop.departure,
                          agencyTimezoneOffset: leg.agencyTimeZoneOffset,
                          coordinate: [stop.lat, stop.lon] });
    }

    /**
     * Create a turnpoints list on the same format we use with GraphHopper
     * from OpenTripPlanner walking steps
     */
    _createTurnpoints(leg, polyline) {
        if (leg.steps) {
            let steps = leg.steps;
            let startPoint = new TurnPoint({
                coordinate:  polyline[0],
                type:        TurnPoint.Type.START,
                distance:    0,
                instruction: _("Start!"),
                time:        0,
                turnAngle:   0
            });
            let turnpoints = [startPoint];
            steps.forEach((step) => {
                turnpoints.push(this._createTurnpoint(step));
            });

            let endPoint = new TurnPoint({
                coordinate: polyline.last(),
                type:       TurnPoint.Type.END,
                distance:   0,
                instruction:_("Arrive")
            });

            turnpoints.push(endPoint);

            return turnpoints;
        } else {
            return null;
        }
    }

    _createTurnpoint(step) {
        let coordinate = new Shumate.Coordinate({ latitude: step.lat,
                                                  longitude: step.lon });
        let turnpoint = new TurnPoint({
            coordinate: coordinate,
            type: this._getTurnpointType(step),
            distance: step.distance,
            instruction: this._getTurnpointInstruction(step)
        });

        return turnpoint;
    }

    _getTurnpointType(step) {
        switch (step.relativeDirection) {
            case 'DEPART':
            case 'CONTINUE':
                return TurnPoint.Type.CONTINUE;
            case 'LEFT':
                return TurnPoint.Type.LEFT;
            case 'SLIGHTLY_LEFT':
                return TurnPoint.Type.SLIGHT_LEFT;
            case 'HARD_LEFT':
                return TurnPoint.Type.SHARP_LEFT;
            case 'RIGHT':
                return TurnPoint.Type.RIGHT;
            case 'SLIGHTLY_RIGHT':
                return TurnPoint.Type.SLIGHT_RIGHT;
            case 'HARD_RIGHT':
                return TurnPoint.Type.SHARP_RIGHT;
            case 'CIRCLE_CLOCKWISE':
            case 'CIRCLE_COUNTERCLOCKWISE':
                return TurnPoint.Type.ROUNDABOUT;
            case 'ELEVATOR':
                return TurnPoint.Type.ELEVATOR;
            case 'UTURN_LEFT':
                return TurnPoint.Type.UTURN_LEFT;
            case 'UTURN_RIGHT':
                return TurnPoint.Type.UTURN_RIGHT;
            default:
                return null;
        }
    }

    _getTurnpointInstruction(step) {
        let street = !step.bogusName ? step.streetName : null;
        switch (step.relativeDirection) {
            case 'DEPART':
            case 'CONTINUE':
                if (street)
                    return _("Continue on %s").format(street);
                else
                    return _("Continue");
            case 'LEFT':
                if (street)
                    return _("Turn left on %s").format(street);
                else
                    return _("Turn left");
            case 'SLIGHTLY_LEFT':
                if (street)
                    return _("Turn slightly left on %s").format(street);
                else
                    return _("Turn slightly left");
            case 'HARD_LEFT':
                if (street)
                    return _("Turn sharp left on %s").format(street);
                else
                    return _("Turn sharp left");
            case 'RIGHT':
                if (street)
                    return _("Turn right on %s").format(street);
                else
                    return _("Turn right");
            case 'SLIGHTLY_RIGHT':
                if (street)
                    return _("Turn slightly right on %s").format(street);
                else
                    return _("Turn slightly right");
            case 'HARD_RIGHT':
                if (street)
                    return _("Turn sharp right on %s").format(street);
                else
                    return _("Turn sharp right");
            case 'CIRCLE_CLOCKWISE':
            case 'CIRCLE_COUNTERCLOCKWISE': {
                let exit = step.exit;

                if (exit)
                    return _("At the roundabout, take exit %s").format(exit);
                else if (street)
                    return _("At the roundabout, take exit to %s").format(street);
                else
                    return _("Take the roundabout");
            }
            case 'ELEVATOR': {
                if (street)
                    return _("Take the elevator and get off at %s").format(street);
                else
                    return _("Take the elevator");
            }
            case 'UTURN_LEFT':
                if (street)
                    return _("Make a left u-turn onto %s").format(street);
                else
                    return _("Make a left u-turn");
            case 'UTURN_RIGHT':
                if (street)
                    return _("Make a right u-turn onto %s").format(street);
                else
                    return _("Make a right u-turn");
            default:
                return '';
        }
    }
};
