/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2015 Jonas Danielsson
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
 * with GNOME Maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Jonas Danielsson <jonas@threetimestwo.org>
 */

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Shumate from 'gi://Shumate';

import {Place} from './place.js';
import {Route, TurnPoint} from './route.js';
import {RouteQuery} from './routeQuery.js';

// directional override markers
const _RLM = '\u200F';
const _LRM = '\u200E';

export class StoredRoute extends Place {

    constructor(params) {
        let route = params.route;
        delete params.route;

        let transportation = params.transportation;
        delete params.transportation;

        let places = params.places;
        delete params.places;

        let geoclue = params.geoclue;
        delete params.geoclue;

        super(params);

        this._transportation = transportation;
        this.route = new Route();
        this.route.update({ path: route.path,
                            turnPoints: route.turnPoints,
                            distance: route.distance,
                            time: route.time,
                            bbox: route.bbox });

        this._rtl = Gtk.get_locale_direction() === Gtk.TextDirection.RTL;

        this.places = places;
        let directionMarker = this._rtl ? _RLM : _LRM;
        let arrow = this._rtl ? '←' : '→';
        params.name = directionMarker + this.places[0].name + directionMarker +
                      arrow + directionMarker + this.places.last().name;

        this._containsCurrentLocation = false;

        let currentLocation = null;
        if (geoclue)
            currentLocation = geoclue.place;

        this.places.forEach((place) => {
            if (currentLocation && place === currentLocation)
                this._containsCurrentLocation = true;
        });
    }

    get viaString() {
        let directionMarker = this._rtl ? _RLM : _LRM;
        let arrow = this._rtl ? '←' : '→';
        return this.places.map(function(place) {
            return directionMarker + place.name;
        }).join(directionMarker + arrow);
    }

    get transportation() {
        return this._transportation;
    }

    get uniqueID() {
        return this._transportation + '-' + this.places.map(function(place) {
            return [place.osm_type, place.osm_id].join('-');
        }).join('-');
    }

    get containsCurrentLocation() {
        return this._containsCurrentLocation;
    }

    get containsNull() {
        let hasNull = false;

        for (let p = 0; p < this.places.length; p++) {
            if (!this.places[p].name) {
                hasNull = true;
                break;
            }
        }
        return hasNull;
    }

    _getIconName() {
        let transport = RouteQuery.Transportation;

        switch (this._transportation) {
            case transport.PEDESTRIAN: return 'route-pedestrian-symbolic';
            case transport.BIKE:       return 'route-bike-symbolic';
            case transport.CAR:        return 'route-car-symbolic';
            default:                   return 'route-button-symbolic';
        }
    }

    toJSON() {
        let turnPoints = this.route.turnPoints.map(function(turnPoint) {
            let coordinate = { latitude: turnPoint.coordinate.latitude,
                               longitude: turnPoint.coordinate.longitude };
            return { coordinate: coordinate,
                     type: turnPoint.type,
                     distance: turnPoint.distance,
                     instruction: turnPoint.instruction };
        });
        let bounding_box = { top: this.route.bbox.top,
                             bottom: this.route.bbox.bottom,
                             left: this.route.bbox.left,
                             right: this.route.bbox.right };

        let path = this.route.path.map(function(coordinate) {
            return { latitude: coordinate.latitude,
                     longitude: coordinate.longitude };
        });

        let route = { path: path,
                      turnPoints: turnPoints,
                      distance: this.route.distance,
                      time: this.route.time };

        let places = this.places.map(function(place) {
            return place.toJSON();
        });

        return { id: -1,
                 transportation: this._transportation,
                 route: route,
                 places: places };
    }

    static fromJSON(obj) {
        let props;
        let places = [];
        let route;
        let transportation = null;

        for (let key in obj) {
            let prop = obj[key];

            switch(key) {
            case 'transportation':
                transportation = prop;
                break;

            case 'route':
                route = new Route();
                prop.path = prop.path.map((coordinate) => {
                    let lat = coordinate.latitude;
                    let lon = coordinate.longitude;
                    return new Shumate.Coordinate({ latitude: lat,
                                                    longitude: lon });
                });
                prop.turnPoints = prop.turnPoints.map((turnPoint) => {
                    let lat = turnPoint.coordinate.latitude;
                    let lon = turnPoint.coordinate.longitude;

                    let coordinate = new Shumate.Coordinate({ latitude: lat,
                                                              longitude: lon });

                    return new TurnPoint({
                        coordinate: coordinate,
                        type: turnPoint.type,
                        distance: turnPoint.distance,
                        instruction: turnPoint.instruction
                    });
                });
                route.update(prop);
                break;

            case 'places':
                prop.forEach((p) => places.push(Place.fromJSON(p)));
                break;
            }
        }
        return new StoredRoute({ transportation: transportation,
                                 route: route,
                                 places: places });
    }
}

GObject.registerClass(StoredRoute);
