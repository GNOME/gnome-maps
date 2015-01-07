/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2014 Damián Nohales
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
 * Author: Damián Nohales <damiannohales@gmail.com>
 */

const Champlain = imports.gi.Champlain;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;

const MapMarker = imports.mapMarker;
const UserLocationBubble = imports.userLocationBubble;
const Utils = imports.utils;

const AccuracyCircleMarker = new Lang.Class({
    Name: 'AccuracyCircleMarker',
    Extends: Champlain.Point,

    _init: function(params) {
        this.place = params.place;
        delete params.place;

        params.color = new Clutter.Color({ red: 0,
                                           blue: 255,
                                           green: 0,
                                           alpha: 50 });
        params.latitude = this.place.location.latitude;
        params.longitude = this.place.location.longitude;
        params.reactive = false;

        this.parent(params);
    },

    refreshGeometry: function(view) {
        let zoom = view.zoom_level;
        let source = view.map_source;
        let metersPerPixel = source.get_meters_per_pixel(zoom,
                                                         this.latitude,
                                                         this.longitude);
        let size = this.place.location.accuracy * 2 / metersPerPixel;

        if (size > view.width && size > view.height)
            this.hide();
        else {
            this.size = size;
            this.show();
        }
    }
});

const UserLocationMarker = new Lang.Class({
    Name: 'UserLocationMarker',
    Extends: MapMarker.MapMarker,

    _init: function(params) {
        this.parent(params);

        this.add_actor(Utils.CreateActorFromIconName('user-location', 0));

        if (this.place.location.accuracy > 0) {
            this._accuracyMarker = new AccuracyCircleMarker({ place: this.place });
            this._accuracyMarker.refreshGeometry(this._view);
            this._zoomLevelId = this._view.connect('notify::zoom-level',
                                                   this._accuracyMarker.refreshGeometry.bind(this._accuracyMarker));
            this.connect('destroy', (function() {
                this._view.disconnect(this._zoomLevelId);
            }).bind(this));
        }
    },

    get anchor() {
        return { x: Math.floor(this.width / 2),
                 y: Math.floor(this.height / 2) };
    },

    _createBubble: function() {
        return new UserLocationBubble.UserLocationBubble({ place: this.place,
                                                           mapView: this._mapView });
    },

    addToLayer: function(layer) {
        if (this._accuracyMarker)
            layer.add_marker(this._accuracyMarker);

        layer.add_marker(this);
    }
});
