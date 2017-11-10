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

const Lang = imports.lang;

const Champlain = imports.gi.Champlain;
const GLib = imports.gi.GLib;
const Soup = imports.gi.Soup;

const Application = imports.application;
const EPAF = imports.epaf;
const HTTP = imports.http;
const Location = imports.location;
const Place = imports.place;
const RouteQuery = imports.routeQuery;
const Service = imports.service;
const TransitPlan = imports.transitPlan;
const Utils = imports.utils;

/**
 * This module implements the interface for communicating with an OpenTripPlanner
 * server instance.
 * The code is somwhat intricate, because it assumes running OpenTripPlanner with
 * only transit data and relies on calling out to GraphHopper to do turn-by-turn-
 * based routing for the walking portions, thus it's based on an asynchronous
 * recursive pattern. The reason for running OpenTripPlanner with only transit
 * data is that prior experiments has shown that OpenTripPlanner with full OSM
 * data doesn't scale well beyong single cities, and GraphHopper has already
 * given us good results before.
 *
 * There is two entry points for obtaining routes, one which is called by the
 * routing delegator when the query is being modified (fetchFirstResults()),
 * and the other being called when requesting additional results (later or
 * earlier alternatives depending on search criteria) (fetchMoreResults())
 * These call into an entry point function "_fatchRoute()" which first calls
 * out to the function "_fetchRouters()" which calls out to the server to update
 * the cached router list if needed (routers are the OpenTripPlanner terminology
 * for an isolated graph, routing can not occur between graphs).
 * In the callback from _fetchRouters, an array of suitable routers (covering
 * start and end coordinates for the desired route) is processed.
 * "_fetchRoutes()" is called, which will do asynchronous recursive call for
 * each router obtained earlier.
 * "_fetchRoutesForRouter()" is called on each router, which in turn
 * asyncronously calls "_fetchTransitStops()" to get closest transit stop for
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

/* timeout after which the routers data is considered stale and we will force
 * a reload (24 hours)
 */
const ROUTERS_TIMEOUT = 24 * 60 * 60 * 1000;

/* minimum distance when an explicit walk route will be requested to suppliment
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
 * whith longer walking after refined by GraphHopper
 */
const MAX_WALKING_DISTANCE = 2000;

// maximum radius to search for stops
const STOP_SEARCH_RADIUS = 2000;

// maximum number of transit stops to consider as candidates for start/end points
const NUM_STOPS_TO_TRY = 5;

// gap to use when fetching additional routes
const GAP_BEFORE_MORE_RESULTS = 120;

var OpenTripPlanner = new Lang.Class({
    Name: 'OpenTripPlanner',

    _init: function(params) {
        this._session = new Soup.Session();
        /* initially set routers as updated far back in the past to force
         * a download when first request
         */
        this._routersUpdatedTimestamp = 0;
        this._query = params.query;
        delete params.query;
        this._graphHopper = params.graphHopper;
        delete params.graphHopper;
        this._plan = new TransitPlan.Plan();
        this._baseUrl = this._getBaseUrl();
        this._walkingRoutes = [];
        this._extendPrevious = false;

        this.parent(params);
    },

    get plan() {
        return this._plan;
    },

    get enabled() {
        return this._baseUrl !== null;
    },

    fetchFirstResults: function() {
        this._extendPrevious = false;
        this._fetchRoute();
    },

    fetchMoreResults: function() {
        this._extendPrevious = true;
        this._fetchRoute();
    },

    _getBaseUrl: function() {
        let debugUrl = GLib.getenv('OTP_BASE_URL');

        if (debugUrl) {
            return debugUrl;
        } else {
            let otp = Service.getService().openTripPlanner

            if (otp && otp.baseUrl) {
                return otp.baseUrl;
            } else {
                Utils.debug('No OpenTripPlanner URL defined in service file');
                return null;
            }
        }
    },

    _getRouterUrl: function(router) {
        if (!router || router.length === 0)
            router = 'default';

        return this._baseUrl + '/routers/' + router;
    },

    _fetchRouters: function(callback) {
        let currentTime = (new Date()).getTime();

        if (currentTime - this._routersUpdatedTimestamp < ROUTERS_TIMEOUT) {
            callback(true);
        } else {
            let uri = new Soup.URI(this._baseUrl + '/routers');
            let request = new Soup.Message({ method: 'GET', uri: uri });

            request.request_headers.append('Accept', 'application/json');
            this._session.queue_message(request, (obj, message) => {
                if (message.status_code !== Soup.Status.OK) {
                    callback(false);
                    return;
                }

                try {
                    this._routers = JSON.parse(message.response_body.data);
                    this._routersUpdatedTimestamp = (new Date()).getTime();
                    callback(true);
                } catch (e) {
                    Utils.debug('Failed to parse router information');
                    callback(false);
                }
            });
        }
    },

    _getRoutersForPlace: function(place) {
        let routers = [];

        this._routers.routerInfo.forEach((routerInfo) => {
            /* TODO: only check bounding rectangle for now
             * should we try to do a finer-grained check using the bounding
             * polygon (if OTP gives one for the routers).
             * And should we add some margins to allow routing from just outside
             * a network (walking distance)?
             */
            if (place.location.latitude >= routerInfo.lowerLeftLatitude &&
                place.location.latitude <= routerInfo.upperRightLatitude &&
                place.location.longitude >= routerInfo.lowerLeftLongitude &&
                place.location.longitude <= routerInfo.upperRightLongitude)
                routers.push(routerInfo.routerId);
        });

        return routers;
    },

    /* Note: this is theoretically slow (O(n*m)), but we will have filtered
     * possible routers for the starting and ending query point, so they should
     * be short (in many cases just one element)
     */
    _routerIntersection: function(routers1, routers2) {
        return routers1.filter(function(n) {
            return routers2.indexOf(n) != -1;
        });
    },

    _getMode: function(routeType) {
        switch (routeType) {
        case TransitPlan.RouteType.TRAM:
            return 'TRAM';
        case TransitPlan.RouteType.TRAIN:
            return 'RAIL';
        case TransitPlan.RouteType.SUBWAY:
            return 'SUBWAY';
        case TransitPlan.RouteType.BUS:
            return 'BUS';
        case TransitPlan.RouteType.FERRY:
            return 'FERRY';
        default:
            throw new Error('unhandled route type');
        }
    },

    _getModes: function(options) {
        let modes = options.transitTypes.map((transitType) => {
            return this._getMode(transitType);
        });

        return modes.join(',');
    },

    _selectBestStopRecursive: function(stops, index, stopIndex, callback) {
        if (index < stops.length) {
            let points = this._query.filledPoints;
            let stop = stops[index];
            let stopPoint =
                this._createQueryPointForCoord([stop.lat, stop.lon]);

            if (stops[0].dist < 100) {
                /* if the stop is close enough to the intended point, just
                 * return the top most from the the original query */
                this._selectBestStopRecursive(stops, index + 1, stopIndex,
                                              callback);
            } else if (stopIndex === 0) {
                this._fetchWalkingRoute([points[0], stopPoint],
                                        (route) => {
                    /* if we couldn't find an exact walking route, go with the
                     * "as the crow flies" distance */
                    if (route)
                        stop.dist = route.distance;
                    this._selectBestStopRecursive(stops, index + 1, stopIndex,
                                                  callback);
                });
            } else if (stopIndex === points.length - 1) {
                this._fetchWalkingRoute([stopPoint, points.last()], (route) => {
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
    },

    /* stopIndex here is the index of stop (i.e. starting point, intermediate
     * stop, final stop
     */
    _selectBestStop: function(stops, stopIndex, callback) {
        this._selectBestStopRecursive(stops, 0, stopIndex, callback);
    },

    _sortTransitStops: function(s1, s2) {
        return s1.dist > s2.dist;
    },

    _fetchRoutesForStop: function(router, stop, callback) {
        let query = new HTTP.Query();
        let uri = new Soup.URI(this._getRouterUrl(router) +
                               '/index/stops/' + stop.id + '/routes');
        let request = new Soup.Message({ method: 'GET', uri: uri });

        request.request_headers.append('Accept', 'application/json');
        this._session.queue_message(request, (obj, message) => {
            if (message.status_code !== Soup.Status.OK) {
                Utils.debug('Failed to get routes for stop');
                this._reset();
            } else {
                let routes = JSON.parse(message.response_body.data);

                Utils.debug('Routes for stop: ' + stop + ': ' + JSON.stringify(routes));
                callback(routes);
            }
        });
    },

    _routeMatchesSelectedModes: function(route) {
        let desiredTransitTypes = this._query.transitOptions.transitTypes;

        for (let i = 0; i < desiredTransitTypes.length; i++) {
            let type = desiredTransitTypes[i];

            if (type === TransitPlan.RouteType.TRAM && route.mode === 'TRAM')
                return true;
            else if (type === TransitPlan.RouteType.SUBWAY && route.mode === 'SUBWAY')
                return true;
            else if (type === TransitPlan.RouteType.TRAIN && route.mode === 'RAIL')
                return true;
            else if (type === TransitPlan.RouteType.BUS &&
                     (route.mode === 'BUS' || route.mode === 'TAXI'))
                return true;
            else if (type === TransitPlan.RouteType.FERRY && route.mode === 'FERRY')
                return true;
        }

        return false;
    },

    _filterStopsRecursive: function(router, stops, index, filteredStops, callback) {
        if (index < stops.length) {
            let stop = stops[index];

            this._fetchRoutesForStop(router, stop, (routes) => {
                for (let i = 0; i < routes.length; i++) {
                    let route = routes[i];

                    if (this._routeMatchesSelectedModes(route)) {
                        filteredStops.push(stop);
                        break;
                    }
                }
                this._filterStopsRecursive(router, stops, index + 1,
                                           filteredStops, callback);
            });
        } else {
            callback(filteredStops);
        }
    },

    _filterStops: function(router, stops, callback) {
        this._filterStopsRecursive(router, stops, 0, [], callback);
    },

    _fetchTransitStopsRecursive: function(router, index, result, callback) {
        let points = this._query.filledPoints;

        if (index < points.length) {
            let point = points[index];
            let params = { lat: point.place.location.latitude,
                           lon: point.place.location.longitude,
                           radius: STOP_SEARCH_RADIUS };
            let query = new HTTP.Query(params);
            let uri = new Soup.URI(this._getRouterUrl(router) +
                                   '/index/stops?' + query.toString());
            let request = new Soup.Message({ method: 'GET', uri: uri });

            request.request_headers.append('Accept', 'application/json');
            this._session.queue_message(request, (obj, message) => {
                if (message.status_code !== Soup.Status.OK) {
                    Utils.debug('Failed to get stop for search point ' + point);
                    this._reset();
                } else {
                    let stops = JSON.parse(message.response_body.data);

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
                            this._fetchTransitStopsRecursive(router, index + 1,
                                                             result, callback);
                        });
                    } else {
                        this._filterStops(router, stops, (filteredStops) => {
                            filteredStops.sort(this._sortTransitStops);
                            filteredStops = filteredStops.splice(0, NUM_STOPS_TO_TRY);

                            if (filteredStops.length === 0) {
                                Utils.debug('No suitable stop found using selected transit modes');
                                callback(null);
                                return;
                            }

                            this._selectBestStop(filteredStops, index, (stop) => {
                                result.push(stop);
                                this._fetchTransitStopsRecursive(router, index + 1,
                                                                 result, callback);
                            });
                        });
                    }
                }
            });
        } else {
            callback(result);
        }
    },

    _fetchTransitStops: function(router, callback) {
        this._fetchTransitStopsRecursive(router, 0, [], callback);
    },

    // get a time suitably formatted for the OpenTripPlanner query param
    _formatTime: function(time, offset) {
        let utcTimeWithOffset = (time + offset) / 1000;
        let date = GLib.DateTime.new_from_unix_utc(utcTimeWithOffset);

        return date.format('%R');
    },

    // get a date suitably formatted for the OpenTripPlanner query param
    _formatDate: function(time, offset) {
        let utcTimeWithOffset = (time + offset) / 1000;
        let date = GLib.DateTime.new_from_unix_utc(utcTimeWithOffset);

        return date.format('%F');
    },

    // create parameter map for the request, given query and options
    _createParams: function(stops) {
        let params = { fromPlace: stops[0].id,
                       toPlace: stops.last().id };
        let intermediatePlaces = [];

        for (let i = 1; i < stops.length - 1; i++) {
            intermediatePlaces.push(stops[i].id);
        }
        if (intermediatePlaces.length > 0)
            params.intermediatePlaces = intermediatePlaces;

        params.numItineraries = 5;
        params.showIntermediateStops = true;
        /* set walking speed for transfers to a slightly lower value to
         * compensate for running OTP with only transit data, giving straight-
         * line walking paths
         */
        params.walkSpeed = 1.0;

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

        return params;
    },

    _fetchRoutesForRouter: function(router, callback) {
        this._fetchTransitStops(router, (stops) => {
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

            let params = this._createParams(stops);
            let query = new HTTP.Query(params);
            let uri = new Soup.URI(this._getRouterUrl(router) + '/plan?' +
                                   query.toString());
            let request = new Soup.Message({ method: 'GET', uri: uri });

            request.request_headers.append('Accept', 'application/json');
            this._session.queue_message(request, (obj, message) => {
                if (message.status_code !== Soup.Status.OK) {
                    Utils.debug('Failed to get route plan from router ' +
                                routers[index] + ' ' + message);
                    callback(null);
                } else {
                    callback(JSON.parse(message.response_body.data));
                }
            });
        });
    },

    _fetchRoutesRecursive: function(routers, index, result, callback) {
        if (index < routers.length) {
            let router = routers[index];

            this._fetchRoutesForRouter(router, (response) => {
                if (response) {
                    Utils.debug('plan: ' + JSON.stringify(response, '', 2));
                    result.push(response);
                }

                this._fetchRoutesRecursive(routers, index + 1, result, callback);
            });
        } else {
            callback(result);
        }
    },

    _fetchRoutes: function(routers, callback) {
        this._fetchRoutesRecursive(routers, 0, [], callback);
    },

    _reset: function() {
        this._extendPrevious = false;
        if (this._query.latest)
            this._query.latest.place = null;
        else
            this.plan.reset();
    },

    /* Indicate that no routes where found, either shows the "No route found"
     * notification, or in case of loading additional (later/earlier) results,
     * indicate no such where found, so that the sidebar can disable the
     * "load more" functionallity as appropriate.
     */
    _noRouteFound: function() {
        if (this._extendPrevious) {
            let message = this._query.arriveBy ?
                          _("No earlier alternatives found.") :
                          _("No later alternatives found.");
            Application.notificationManager.showMessage(message);
            this._extendPrevious = false;
            this.plan.noMoreResults();
        } else {
            Application.notificationManager.showMessage(_("No route found."));
            this._reset();
        }
    },

    _fetchRoute: function() {
        this._fetchRouters((success) => {
            if (success) {
                let points = this._query.filledPoints;
                let routers = this._getRoutersForPoints(points);

                if (routers.length > 0) {
                    this._fetchRoutes(routers, (routes) => {
                        let itineraries = [];
                        routes.forEach((plan) => {
                            if (plan.plan && plan.plan.itineraries) {
                                itineraries =
                                    itineraries.concat(
                                        this._createItineraries(plan.plan.itineraries));
                            }
                        });

                        if (itineraries.length === 0) {
                            /* don't reset query points, unlike for turn-based
                             * routing, since options and timeing might influence
                             * results */
                            this._noRouteFound();
                        } else {
                            this._recalculateItineraries(itineraries);
                        }
                    });

                } else {
                    Application.notificationManager.showMessage(_("No timetable data found for this route."));
                    this._reset();
                }
            } else {
                Application.notificationManager.showMessage(_("Route request failed."));
                this._reset();
            }
        });
    },

    _isOnlyWalkingItinerary: function(itinerary) {
        return itinerary.legs.length === 1 && !itinerary.legs[0].transit;
    },

    _recalculateItineraries: function(itineraries) {
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
    },

    _isItineraryRealistic: function(itinerary) {
        for (let i = 0; i < itinerary.legs.length; i++) {
            let leg = itinerary.legs[i];

            if (!leg.transit) {
                /* if a walking leg exceeds the maximum desired walking
                 * distance, or for a leg "in-between" two transit legs, if
                 * there's insufficent switch time
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
    },

    _recalculateItinerariesRecursive: function(itineraries, index) {
        if (index < itineraries.length) {
            this._recalculateItinerary(itineraries[index], (itinerary) => {
                itineraries[index] = itinerary;
                this._recalculateItinerariesRecursive(itineraries, index + 1);
            });
        } else {
            /* filter out itineraries where there are intermediate walking legs
             * that are too narrow time-wise, this is nessesary since running
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

                /* sort itineraries, by departure time ascending if querying
                 * by leaving time, by arrival time descending when querying
                 * by arriving time
                 */
                if (this._query.arriveBy)
                    filteredItineraries.sort(TransitPlan.sortItinerariesByArrivalDesc);
                else
                    filteredItineraries.sort(TransitPlan.sortItinerariesByDepartureAsc);

                let newItineraries = this._extendPrevious ?
                                     this.plan.itineraries.concat(filteredItineraries) :
                                     filteredItineraries;

                // reset the "load more results" flag
                this._extendPrevious = false;
                this.plan.update(newItineraries);
            } else {
                this._noRouteFound();
            }
        }
    },

    // create a straight-line "as the crow flies" polyline between two places
    _createStraightPolyline: function(fromLoc, toLoc) {
        return [new Champlain.Coordinate({ latitude: fromLoc.latitude,
                                           longitude: fromLoc.longitude }),
                new Champlain.Coordinate({ latitude: toLoc.latitude,
                                           longitude: toLoc.longitude })];
    },

    /* Creates a new walking leg given start and end places, and a route
     * obtained from GraphHopper. If the route is undefined (which happens if
     * GraphHopper failed to obtain a walking route, approximate it with a
     * straight line. */
    _createWalkingLeg: function(from, to, fromName, toName, route) {
        let fromLocation = from.place.location;
        let toLocation = to.place.location;
        let fromCoordinate = [fromLocation.latitude, fromLocation.longitude];
        let toCoordinate = [toLocation.latitude, toLocation.longitude];
        let polyline = route ? route.path :
                               this._createStraightPolyline(fromLocation, toLocation);
        let distance = route ? route.distance :
                               fromLocation.get_distance_from(toLocation) * 1000;
        /* as an estimate for approximated straight-line walking legs,
         * assume a speed of 1 m/s to allow some extra time */
        let duration = route ? route.time / 1000 : distance;
        let walkingInstructions = route ? route.turnPoints : null;

        return new TransitPlan.Leg({ fromCoordinate: fromCoordinate,
                                     toCoordinate: toCoordinate,
                                     from: fromName,
                                     to: toName,
                                     isTransit: false,
                                     polyline: polyline,
                                     duration: duration,
                                     distance: distance,
                                     walkingInstructions: walkingInstructions });
    },

    /* fetches walking route and stores the route for the given coordinate
     * pair to avoid requesting the same route over and over from GraphHopper
     */
    _fetchWalkingRoute: function(points, callback) {
        let index = points[0].place.location.latitude + ',' +
                    points[0].place.location.longitude + ';' +
                    points[1].place.location.latitude + ',' +
                    points[1].place.location.longitude;
        let route = this._walkingRoutes[index];

        if (!route) {
            this._graphHopper.fetchRouteAsync(points,
                                              RouteQuery.Transportation.PEDESTRIAN,
                                              (newRoute) => {
                this._walkingRoutes[index] = newRoute;
                callback(newRoute);
            });
        } else {
            callback(route);
        }
    },

    _recalculateItinerary: function(itinerary, callback) {
        let from = this._query.filledPoints[0];
        let to = this._query.filledPoints.last();

        if (itinerary.legs.length === 1 && !itinerary.legs[0].transit) {
            /* special case, if there's just one leg of an itinerary, and that leg
             * leg is a non-transit (walking), recalculate the route in its entire
             * using walking
             */
            this._fetchWalkingRoute(this._query.filledPoints, (route) => {
                let leg = this._createWalkingLeg(from, to, from.place.name,
                                                 to.place.name, route);
                let newItinerary =
                    new TransitPlan.Itinerary({departure: itinerary.departure,
                                               duration: route.time / 1000,
                                               legs: [leg]});
                callback(newItinerary);
            });
        } else if (itinerary.legs.length === 1 && itinerary.legs[0].transit) {
            // special case if there is extactly one transit leg
            let leg = itinerary.legs[0];
            let startLeg = this._createQueryPointForCoord(leg.fromCoordinate);
            let endLeg = this._createQueryPointForCoord(leg.toCoordinate);
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
                this._fetchWalkingRoute([from, startLeg], (firstRoute) => {
                    let firstLeg =
                        this._createWalkingLeg(from, startLeg, from.place.name,
                                               leg.from, firstRoute);
                    this._fetchWalkingRoute([endLeg, to], (lastRoute) => {
                        let lastLeg = this._createWalkingLeg(endLeg, to, leg.to,
                                                             to.place.name,
                                                             lastRoute);
                        itinerary.legs.unshift(firstLeg);
                        itinerary.legs.push(lastLeg);
                        callback(itinerary);
                    });
                });
            } else if (endWalkDistance >= MIN_WALK_ROUTING_DISTANCE) {
                // add an extra walking leg to the end of the itinerary
                this._fetchWalkingRoute([endLeg, to], (lastRoute) => {
                    let lastLeg =
                        this._createWalkingLeg(endLeg, to, leg.to,
                                               to.place.name, lastRoute);
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
    },

    _createQueryPointForCoord: function(coord) {
        let location = new Location.Location({ latitude: coord[0],
                                               longitude: coord[1],
                                               accuracy: 0 });
        let place = new Place.Place({ location: location });
        let point = new RouteQuery.QueryPoint();

        point.place = place;
        return point;
    },

    _recalculateItineraryRecursive: function(itinerary, index, callback) {
        if (index < itinerary.legs.length) {
            let leg = itinerary.legs[index];
            if (index === 0) {
                let from = this._query.filledPoints[0];
                let startLeg =
                    this._createQueryPointForCoord(leg.fromCoordinate);
                let endLeg =
                    this._createQueryPointForCoord(leg.toCoordinate);
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
                    let to = this._createQueryPointForCoord(leg.toCoordinate);
                    let toName = leg.to;

                    /* if the next leg is a walking one, "fold" it into the one
                     * we create here */
                    if (nextLeg && !nextLeg.transit) {
                        to = this._createQueryPointForCoord(nextLeg.toCoordinate);
                        toName = nextLeg.to;
                        itinerary.legs.splice(index + 1, index + 1);
                    }

                    this._fetchWalkingRoute([from, to], (route) => {
                        let newLeg =
                            this._createWalkingLeg(from, to, from.place.name,
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
                    let to = this._createQueryPointForCoord(leg.fromCoordinate);
                    let fromLoc = from.place.location;
                    let toLoc = to.place.location;
                    let distance = fromLoc.get_distance_from(toLoc) * 1000;

                    if (distance >= MIN_WALK_ROUTING_DISTANCE) {
                        this._fetchWalkingRoute([from, to], (route) => {
                            let newLeg =
                                this._createWalkingLeg(from, to, from.place.name,
                                                       leg.from, route);
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
                    this._createQueryPointForCoord(leg.fromCoordinate);
                let endLeg = this._createQueryPointForCoord(leg.toCoordinate);
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
                    let from = this._createQueryPointForCoord(finalTransitLeg.fromCoordinate);
                    this._fetchWalkingRoute([from, to], (route) => {
                        let newLeg =
                            this._createWalkingLeg(from, to,
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
                    let from = this._createQueryPointForCoord(leg.toCoordinate);
                    let fromLoc = from.place.location;
                    let toLoc = to.place.location;
                    let distance = fromLoc.get_distance_from(toLoc) * 1000;

                    if (distance >= MIN_WALK_ROUTING_DISTANCE) {
                        this._fetchWalkingRoute([from, to], (route) => {
                            let newLeg =
                                this._createWalkingLeg(from, to, leg.to,
                                                       to.place.name, route);
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
                    let from = this._createQueryPointForCoord(leg.fromCoordinate);
                    let to = this._createQueryPointForCoord(leg.toCoordinate);

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

                    this._fetchWalkingRoute([from, to], (route) => {
                        let newLeg = this._createWalkingLeg(from, to, leg.from,
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
    },

    _getRoutersForPoints: function(points) {
        let startRouters = this._getRoutersForPlace(points[0].place);
        let endRouters =
            this._getRoutersForPlace(points.last().place);

        let intersectingRouters =
            this._routerIntersection(startRouters, endRouters);

        return intersectingRouters;
    },

    _createItineraries: function(itineraries) {
        return itineraries.map((itinerary) => this._createItinerary(itinerary));
    },

    _createItinerary: function(itinerary) {
        let legs = this._createLegs(itinerary.legs);
        return new TransitPlan.Itinerary({ duration:  itinerary.duration,
                                           transfers: itinerary.transfers,
                                           departure: itinerary.startTime,
                                           arrival:   itinerary.endTime,
                                           legs:      legs});
    },

    _createLegs: function(legs) {
        return legs.map((leg) => this._createLeg(leg));
    },

    /* check if a string is a valid hex RGB string */
    _isValidHexColor: function(string) {
        if (string && string.length === 6) {
            let regex = /^[A-Fa-f0-9]/;

            return string.match(regex);
        }

        return false;
    },

    _createLeg: function(leg) {
        let polyline = EPAF.decode(leg.legGeometry.points);
        let intermediateStops =
            this._createIntermediateStops(leg);
        let color = leg.routeColor && this._isValidHexColor(leg.routeColor) ?
                    leg.routeColor : null;
        let textColor = leg.routeTextColor && this._isValidHexColor(leg.routeTextColor) ?
                        leg.routeTextColor : null;

        /* instroduce an extra stop at the end (in additional to the
         * intermediate stops we get from OTP
         */
        intermediateStops.push(new TransitPlan.Stop({ name: leg.to.name,
                                                      arrival: leg.to.arrival,
                                                      agencyTimezoneOffset: leg.agencyTimeZoneOffset,
                                                      coordinate: [leg.to.lat,
                                                                   leg.to.lon] }));

        return new TransitPlan.Leg({ departure:            leg.from.departure,
                                     arrival:              leg.to.arrival,
                                     from:                 leg.from.name,
                                     to:                   leg.to.name,
                                     headsign:             leg.headsign,
                                     intermediateStops:    intermediateStops,
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
    },

    _createIntermediateStops: function(leg) {
        let stops = leg.intermediateStops;
        return stops.map((stop) => this._createIntermediateStop(stop, leg));
    },

    _createIntermediateStop: function(stop, leg) {
        return new TransitPlan.Stop({ name:       stop.name,
                                      arrival:    stop.arrival,
                                      departure:  stop.departure,
                                      agencyTimezoneOffset: leg.agencyTimeZoneOffset,
                                      coordinate: [stop.lat, stop.lon] });
    }
});
