/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2020 Marcus Lundblad
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

const _ = imports.gettext.gettext;

const Maps = imports.gi.GnomeMaps;

const Application = imports.application;
const GraphHopperTransit = imports.graphHopperTransit;
const HVT = imports.hvt;
const TransitPlan = imports.transitPlan;
const Utils = imports.utils;

const NUM_CONSIDERED_STOPS = 10;

var GTFS = class GTFS {
    constructor(params) {
        // TODO: for now just read files from an unzipped GTFS file at path…
        this._gtfs = Maps.GTFS.new(params.name);
        this._query = Application.routeQuery;
        this._plan = Application.routingDelegator.transitRouter.plan;
        Utils.debug('end constructor');
    }

    fetchFirstResults() {
        let filledPoints = this._query.filledPoints;
        let startLat = filledPoints[0].place.location.latitude;
        let startLon = filledPoints[0].place.location.longitude;
        let endLat = filledPoints.last().place.location.latitude;
        let endLon = filledPoints.last().place.location.longitude;

        this._plan.progress(_("Creating database…"));
        this._gtfs.parse((success, error) => {
            this._plan.progress(null);
            if (success) {
                let types = this._getRouteTypesFromQuery();
                Utils.debug('parse done');
                let startStops =
                    types ?
                    this._gtfs.get_nearby_stops_with_route_types(startLat,
                                                                 startLon,
                                                                 2000, types) :
                            this._gtfs.get_nearby_stops(startLat, startLon, 2000);
                Utils.debug('got nearby start');
                let endStops =
                    types ?
                    this._gtfs.get_nearby_stops_with_route_types(endLat, endLon,
                                                                 2000, types) :
                    this._gtfs.get_nearby_stops(endLat, endLon, 2000);
                Utils.debug('got nearny end');

                this._refineStops(startStops, true, (result) => {
                    result.forEach((stop) => {
                        Utils.debug('stop: ' + stop.name + ", walking: " +
                                    stop.walkRoute.distance);
                    });
                });
            } else {
                this._plan.requestFailed();
            }
        });
    }

    fetchMoreResults() {

    }

    _getRouteTypesFromQuery() {
        if (this._query.transitOptions.showAllTransitTypes) {
            return null;
        } else {
            let types = [];

            this._query.transitOptions.transitTypes.forEach(type => {
                switch (type) {
                    case TransitPlan.RouteType.BUS:
                        types.push(TransitPlan.RouteType.BUS);
                        types.push(TransitPlan.RouteType.TROLLEYBUS);
                        types.push(HVT.COACH_SERVICE);
                        types.push(HVT.BUS_SERVICE);
                        types.push(HVT.TROLLEYBUS_SERVICE);
                        types.push(HVT.TAXI_SERVICE);
                        break;
                    case TransitPlan.RouteType.TRAM:
                        types.push(TransitPlan.RouteType.TRAM);
                        types.push(HVT.TRAM_SERVICE);
                        break;
                    case TransitPlan.RouteType.SUBWAY:
                        types.push(TransitPlan.RouteType.SUBWAY);
                        types.push(HVT.URBAN_RAILWAY_SERVICE);
                        types.push(HVT.SUBURBAN_RAILWAY_SERVICE);
                        types.push(HVT.METRO_SERVICE);
                        break;
                    case TransitPlan.RouteType.TRAIN:
                        types.push(TransitPlan.RouteType.TRAIN);
                        types.push(HVT.RAILWAY_SERVICE);
                        break;
                    case TransitPlan.RouteType.FERRY:
                        types.push(TransitPlan.RouteType.FERRY);
                        types.push(HVT.WATER_TRANSPORT_SERVICE);
                        break;
                    case HVT.AIR_SERVICE:
                        types.push(HVT.AIR_SERVICE);
                        break;
                }
            });

            return types;
        }

    }

    _refineStops(stops, isStart, callback) {
        this._refineStopsRecursive(stops, [], 0, isStart, callback);
    }

    _refineStopsRecursive(stops, result, index, isStart, callback) {
        if (index >= stops.length || index == NUM_CONSIDERED_STOPS) {
            callback(result);
        } else {
            let filledPoints = this._query.filledPoints;
            let stop = stops[index];
            let startPoint =
                isStart ?
                filledPoints[0] :
                GraphHopperTransit.createQueryPointForCoord([stop.lat, stop.lon]);
            let endPoint =
                isStart ?
                GraphHopperTransit.createQueryPointForCoord([stop.lat, stop.lon]) :
                filledPoints.last();

            GraphHopperTransit.fetchWalkingRoute([startPoint, endPoint],
                                                 (route) => {
                stop.walkRoute = route;
                result.push(stop);
                this._refineStopsRecursive(stops, result, index + 1, isStart, callback);
            });
        }
    }
}
