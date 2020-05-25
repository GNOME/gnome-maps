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
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>.
 *
 * Author: Damián Nohales <damiannohales@gmail.com>
 */

const Champlain = imports.gi.Champlain;
const Clutter = imports.gi.Clutter;
const GObject = imports.gi.GObject;

const MapMarker = imports.mapMarker;
const UserLocationBubble = imports.userLocationBubble;

var AccuracyCircleMarker = GObject.registerClass(
class AccuracyCirleMarker extends Champlain.Point {

    _init(params) {
        this.place = params.place;
        delete params.place;

        params.color = new Clutter.Color({ red: 0,
                                           blue: 255,
                                           green: 0,
                                           alpha: 50 });
        params.latitude = this.place.location.latitude;
        params.longitude = this.place.location.longitude;
        params.reactive = false;

        super._init(params);
    }

    refreshGeometry(view) {
        this.latitude = this.place.location.latitude;
        this.longitude = this.place.location.longitude;

        let zoom = view.zoom_level;
        let source = view.map_source;
        let metersPerPixel = source.get_meters_per_pixel(zoom,
                                                         this.latitude,
                                                         this.longitude);
        let size = this.place.location.accuracy * 2 / metersPerPixel;

        if (size > view.width || size > view.height)
            this.hide();
        else {
            this.size = size;
            this.show();
        }
    }
});

var UserLocationMarker = GObject.registerClass(
class UserLocationMarker extends MapMarker.MapMarker {

    _init(params) {
        super._init(params);

        this._accuracyMarker = new AccuracyCircleMarker({ place: this.place });
        this.connect('notify::view-zoom-level',
                     () => this._accuracyMarker.refreshGeometry(this._view));
        this._view.connect('notify::width',
                     () => this._accuracyMarker.refreshGeometry(this._view));
        this._view.connect('notify::height',
                     () => this._accuracyMarker.refreshGeometry(this._view));
        this._accuracyMarker.refreshGeometry(this._view);

        this.place.connect('notify::location', () => this._updateLocation());
        this._updateLocation();

        this.connect('notify::visible', this._updateAccuracyCircle.bind(this));
    }

    get anchor() {
        return { x: Math.floor(this.width / 2),
                 y: Math.floor(this.height / 2) };
    }

    _createBubble() {
        return new UserLocationBubble.UserLocationBubble({ place: this.place,
                                                           mapView: this._mapView });
    }

    addToLayer(layer) {
        layer.add_marker(this._accuracyMarker);
        layer.add_marker(this);
    }

    _updateLocation() {
        if (this._actor) {
            this._actor.destroy();
            delete this._actor;
        }

        if (this.place.location.heading > -1) {
            this._actor = this._actorFromIconName('user-location-compass', 0);
            this._actor.set_pivot_point(0.5, 0.5);
            this._actor.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, this.place.location.heading);
        } else {
            this._actor = this._actorFromIconName('user-location', 0);
        }
        this.add_actor(this._actor);

        this._updateAccuracyCircle();
        if (this._bubble)
            this._bubble.updateLocation();
    }

    _updateAccuracyCircle() {
        if (this.visible && this.place.location.accuracy > 0) {
            this._accuracyMarker.refreshGeometry(this._view);
        } else {
            this._accuracyMarker.visible = false;
        }
    }
});
