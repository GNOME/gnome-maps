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

import Cairo from 'cairo';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Shumate from 'gi://Shumate';

import {Application} from './application.js';
import {MapWalker} from './mapWalker.js';
import * as Utils from './utils.js';

export class MapMarker extends Shumate.Marker {

    constructor({place, mapView, ...params}) {
        super({
            ...params,
            latitude: place.location.latitude,
            longitude: place.location.longitude,
            selectable: true,
        });

        this._place = place;
        this._mapView = mapView;

        if (this._mapView) {
            this._viewport = this._mapView.map.viewport;

            this._buttonPressGesture = new Gtk.GestureClick();
            this.add_controller(this._buttonPressGesture);
            this._buttonPressGesture.connect('pressed',
                                             (_, nPress) =>
                                             this._onMarkerSelected(nPress));

            // Some markers are draggable, we want to sync the marker location and
            // the location saved in the Place
            // These are not bindings because the place may have a different
            // location later
            this.connect('notify::latitude', () => {
                this.place.location.latitude = this.latitude;
            });
            this.connect('notify::longitude', () => {
                this.place.location.longitude = this.longitude;
            });

            this.place.connect('notify::location', this._onLocationChanged.bind(this));
        }
    }

    _onLocationChanged() {
        this.set_location(this.place.location.latitude, this.place.location.longitude);
    }

    get place() {
        return this._place;
    }

    get walker() {
        if (this._walker === undefined)
            this._walker = new MapWalker(this.place, this._mapView);

        return this._walker;
    }

    zoomToFit() {
        this.walker.zoomToFit();
    }

    goTo(animate) {
        Utils.once(this.walker, 'gone-to', () => this.emit('gone-to'));
        this.walker.goTo(animate);
    }

    _onMarkerSelected(nPress) {
        this._buttonPressGesture.set_state(Gtk.EventSequenceState.CLAIMED);
        if (nPress > 1) {
            const zoom = this._viewport.zoom_level;
            const maxZoom = this._viewport.max_zoom_level;

            if (zoom < maxZoom) {
                this._mapView.map.go_to_full_with_duration(this.latitude,
                                                           this.longitude,
                                                           maxZoom, 200);
            }
        } else {
            Application.application.mainWindow.showPlace(this._place);
        }
    }
}

GObject.registerClass({
    Abstract: true,
    Signals: {
        'gone-to': { }
    }
}, MapMarker);
