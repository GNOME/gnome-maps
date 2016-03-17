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
const Location = imports.location;
const MapMarker = imports.mapMarker;
const Place = imports.place;
const Utils = imports.utils;

const TurnPointMarker = new Lang.Class({
    Name: 'TurnPointMarker',
    Extends: MapMarker.MapMarker,

    _init: function(params) {
        this._queryPoint = params.queryPoint;
        delete params.queryPoint;

        this._turnPoint = params.turnPoint;
        delete params.turnPoint;

        params.place = new Place.Place({
            location: new Location.Location({
                latitude: this._turnPoint.coordinate.get_latitude(),
                longitude: this._turnPoint.coordinate.get_longitude()
            })
        });
        this.parent(params);

        let actor;
        if (this._queryPoint) {
            this.draggable = true;
            this.connect('drag-finish', (function() {
                this._onMarkerDrag();
            }).bind(this));
            actor = this._actorFromIconName(this._turnPoint.iconName, 0);
        } else {
            // A GNOMEish blue color
            let color = new Gdk.RGBA({ red: 33   / 255,
                                       green: 93 / 255,
                                       blue: 156 / 255,
                                       alpha: 255 });
            actor = this._actorFromIconName('maps-point-end-symbolic',
                                            0,
                                            color);
        }
        this.add_actor(actor);
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

        Utils.once(view, 'animation-completed', (function() {
            view.zoom_level = turnPointZoomLevel;
            view.center_on(this.latitude,
                           this.longitude);
        }).bind(this));

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
