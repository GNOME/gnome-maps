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

const Application = imports.application;
const RouteQuery = imports.routeQuery;
const TransitPlan = imports.transitPlan;

/* Creates a new walking leg given start and end places, and a route
 * obtained from GraphHopper. If the route is undefined (which happens if
 * GraphHopper failed to obtain a walking route, approximate it with a
 * straight line. */
function createWalkingLeg(from, to, fromName, toName, route) {
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
}

var _walkingRoutes = [];

/* fetches walking route and stores the route for the given coordinate
 * pair to avoid requesting the same route over and over from GraphHopper
 */
function fetchWalkingRoute(points, callback) {
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
