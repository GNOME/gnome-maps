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
 * Utilities to use GraphHopper to perform walking routes for use in
 * transit itineraries, for plugins not natively supporting turn-by-turn
 * routing for walking legs
 */

import Shumate from 'gi://Shumate';

import {Application} from './application.js';
import {Location} from './location.js';
import {Place} from './place.js';
import {RouteQuery, QueryPoint} from './routeQuery.js';
import {Leg} from './transitPlan.js';

/* Creates a new walking leg given start and end places, and a route
 * obtained from GraphHopper. If the route is undefined (which happens if
 * GraphHopper failed to obtain a walking route, approximate it with a
 * straight line. */
export function createWalkingLeg(from, to, fromName, toName, route) {
    let fromLocation = from.place.location;
    let toLocation = to.place.location;
    let fromCoordinate = [fromLocation.latitude, fromLocation.longitude];
    let toCoordinate = [toLocation.latitude, toLocation.longitude];
    let polyline = route ? route.path :
                           createStraightPolyline(fromLocation, toLocation);
    let distance = route ? route.distance :
                           fromLocation.get_distance_from(toLocation) * 1000;
    /* as an estimate for approximated straight-line walking legs,
     * assume a speed of 1 m/s to allow some extra time */
    let duration = route ? route.time / 1000 : distance;
    let walkingInstructions = route ? route.turnPoints : null;

    return new Leg({ fromCoordinate: fromCoordinate,
                     toCoordinate: toCoordinate,
                     from: fromName,
                     to: toName,
                     isTransit: false,
                     polyline: polyline,
                     duration: duration,
                     distance: distance,
                     walkingInstructions: walkingInstructions });
}

// create a straight-line "as the crow flies" polyline between two places
function createStraightPolyline(fromLoc, toLoc) {
    return [new Shumate.Coordinate({ latitude: fromLoc.latitude,
                                     longitude: fromLoc.longitude }),
            new Shumate.Coordinate({ latitude: toLoc.latitude,
                                     longitude: toLoc.longitude })];
}

var _walkingRoutes = [];

/* fetches walking route and stores the route for the given coordinate
 * pair to avoid requesting the same route over and over from GraphHopper
 */
export function fetchWalkingRoute(points, callback) {
    let index = points[0].place.location.latitude + ',' +
                points[0].place.location.longitude + ';' +
                points[1].place.location.latitude + ',' +
                points[1].place.location.longitude;
    let route = _walkingRoutes[index];

    if (!route) {
        Application.routingDelegator.graphHopper.fetchRouteAsync(points,
                                          RouteQuery.Transportation.PEDESTRIAN,
                                          (newRoute) => {
            _walkingRoutes[index] = newRoute;
            callback(newRoute);
        });
    } else {
        callback(route);
    }
}

// create a query point from a bare coordinate (lat, lon pair)
export function createQueryPointForCoord(coord) {
    let location = new Location({ latitude: coord[0],
                                  longitude: coord[1],
                                  accuracy: 0 });
    let place = new Place({ location: location });
    let point = new QueryPoint();

    point.place = place;
    return point;
}

/**
 * Refine itineraries with walking legs retrieved from GraphHopper.
 * Intended for use by transit plugins where the source API doesn't give
 * full walking turn-by-turn routing
 */
export function addWalkingToItineraries(itineraries, callback) {
    _addWalkingToItinerariesRecursive(itineraries, 0, callback);
}

function _addWalkingToItinerariesRecursive(itineraries, index, callback) {
    if (index === itineraries.length) {
        callback();
    } else {
        let itinerary = itineraries[index];

        _addWalkingToLegsRecursive(itinerary.legs, 0, () => {
            _addWalkingToItinerariesRecursive(itineraries, index + 1, callback);
        });
    }
}

function _addWalkingToLegsRecursive(legs, index, callback) {
    if (index === legs.length) {
        callback();
    } else {
        let leg = legs[index];

        if (!leg.transit) {
            let from = createQueryPointForCoord(leg.fromCoordinate);
            let to = createQueryPointForCoord(leg.toCoordinate);

            fetchWalkingRoute([from, to], (route) => {
                if (route) {
                    let duration = route.time / 1000;

                    /* for walking legs not in the start or end
                     * only replace with the retrieved one if it's not
                     * longer in duration that the previous (straight-line)
                     * one.
                     */
                    if (index === 0 || index === legs.length - 1 ||
                        duration <= leg.duration) {
                        leg.distance = route.distance;
                        leg.walkingInstructions = route.turnPoints;
                        leg.polyline = route.path;
                    }
                }

                _addWalkingToLegsRecursive(legs, index + 1, callback);
            });
        } else {
            _addWalkingToLegsRecursive(legs, index + 1, callback);
        }
    }
}
