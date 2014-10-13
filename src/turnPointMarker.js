/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2014 Dario Di Nucci
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
 * Author: Dario Di Nucci <linkin88mail@gmail.com>
 */

const Geocode = imports.gi.GeocodeGlib;

const Lang = imports.lang;

const Application = imports.application;
const MapMarker = imports.mapMarker;
const TurnPointBubble = imports.turnPointBubble;
const Utils = imports.utils;

const TurnPointMarker = new Lang.Class({
    Name: 'TurnPointMarker',
    Extends: MapMarker.MapMarker,

    get turnPoint() {
        return this._turnPoint;
    },

    get iconName() {
        return this._turnPoint.iconName;
    },

    _init: function(params) {
        this._turnPoint = params.turnPoint
        delete params.turnPoint;

        params.place = new Geocode.Place({
            location: new Geocode.Location({
                latitude: this._turnPoint.coordinate.get_latitude(),
                longitude: this._turnPoint.coordinate.get_longitude()
            })
        });

        this.parent(params);
    },

    get anchor() {
        return { x: Math.floor(this.width / 2) - 1,
                 y: Math.floor(this.height / 2) - 1 };
    },

    _createBubble: function() {
        return new TurnPointBubble.TurnPointBubble({ turnPoint: this.turnPoint,
                                                     place: this.place,
                                                     mapView: this._mapView });
    }
});

const DestinationMarker = new Lang.Class({
    Name: 'DestinationMarker',
    Extends: TurnPointMarker,

    _init: function(params) {
        this._queryPoint = params.queryPoint;
        delete params.queryPoint;

        this.parent(params);

        this.draggable = true;

        this.connect('drag-finish', (function() {
            this._onMarkerDrag();
        }).bind(this));

        this.add_actor(Utils.CreateActorFromIconName(this.iconName));
    },

    _onMarkerDrag: function() {
        let query = Application.routeService.query;
        let place = new Geocode.Place({
                        location: new Geocode.Location({ latitude: this.latitude.toFixed(5),
                                                         longitude: this.longitude.toFixed(5) }) });

        this._queryPoint.place = place;
    }
});
