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
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>.
 *
 * Author: Dario Di Nucci <linkin88mail@gmail.com>
 */

const Clutter = imports.gi.Clutter;
const Gdk = imports.gi.Gdk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

const Application = imports.application;
const Color = imports.color;
const Location = imports.location;
const MapMarker = imports.mapMarker;
const Place = imports.place;
const Utils = imports.utils;

var TurnPointMarker = new Lang.Class({
    Name: 'TurnPointMarker',
    Extends: MapMarker.MapMarker,

    _init: function(params) {
        this._queryPoint = params.queryPoint;
        delete params.queryPoint;

        this._turnPoint = params.turnPoint;
        delete params.turnPoint;

        this._transitStop = params.transitStop;
        delete params.transitStop;

        this._transitLeg = params.transitLeg;
        delete params.transitLeg;

        let latitude;
        let longitude;

        if (this._turnPoint) {
            latitude = this._turnPoint.coordinate.get_latitude();
            longitude = this._turnPoint.coordinate.get_longitude();
        } else {
            latitude = this._transitStop.coordinate[0];
            longitude = this._transitStop.coordinate[1];
        }

        params.place = new Place.Place({
            location: new Location.Location({ latitude: latitude,
                                              longitude: longitude }) });
        this.parent(params);

        let actor;
        if (this._queryPoint) {
            this.draggable = true;
            this.connect('drag-finish', () => this._onMarkerDrag());
            actor = this._actorFromIconName(this._turnPoint.iconName, 0);
        } else {
            let color = this._getColor();
            actor = this._actorFromIconName('maps-point-end-symbolic',
                                            0,
                                            color);
        }
        this.add_actor(actor);
    },

    _getColor: function() {
        /* Use the route color from the transit leg when representing part of
         * a transit trip, otherwise let the fallback functionallity of the
         * utility function use a GNOMEish blue color for turn-by-turn routing.
         */
        let color = this._transitLeg ? this._transitLeg.color : null;

        return new Gdk.RGBA({ red: Color.parseColor(color, 0, 33 / 255),
                              green: Color.parseColor(color, 1, 93 / 255),
                              blue: Color.parseColor(color, 2, 155 / 255),
                              alpha: 255 });
    },

    get anchor() {
        return { x: Math.floor(this.width / 2) - 1,
                 y: Math.floor(this.height / 2) - 1 };
    },

    goTo: function() {
        let view = this._mapView.view;
        let turnPointZoomLevel = 15;

        view.goto_animation_mode = Clutter.AnimationMode.LINEAR;
        view.goto_duration = 0;

        Utils.once(view, 'animation-completed', () => {
            view.zoom_level = turnPointZoomLevel;
            view.center_on(this.latitude,
                           this.longitude);
        });

        view.go_to(this.latitude, this.longitude);
    },

    _onMarkerDrag: function() {
        let query = Application.routeQuery;
        let place = new Place.Place({
            location: new Location.Location({ latitude: this.latitude.toFixed(5),
                                              longitude: this.longitude.toFixed(5) }) });

        this._queryPoint.place = place;
    }
});
