/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2011, 2012, 2013 Red Hat, Inc.
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
 * Author: Zeeshan Ali (Khattak) <zeeshanak@gnome.org>
 */

const Clutter = imports.gi.Clutter;
const Champlain = imports.gi.Champlain;
const Geocode = imports.gi.GeocodeGlib;

const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Signals = imports.signals;

const Utils = imports.utils;
const Path = imports.path;
const _ = imports.gettext.gettext;

const MapLocation = new Lang.Class({
    Name: 'MapLocation',

    _init: function(geocodeLocation, mapView) {
        this._mapView = mapView;
        this._view = mapView.view;
        this.latitude = geocodeLocation.latitude;
        this.longitude = geocodeLocation.longitude;
        this.description = geocodeLocation.description;
        this.accuracy = geocodeLocation.accuracy;
    },

    goTo: function(animate) {
        log("Going to " + this.description);

        if (!animate) {
            this._view.center_on(this.latitude, this.longitude);
            this.zoomToFit();
            this.emit('gone-to');

            return;
        }

        /* Lets first ensure that both current and destination location are visible
         * before we start the animated journey towards destination itself. We do this
         * to create the zoom-out-then-zoom-in effect that many map implementations
         * do. This not only makes the go-to animation look a lot better visually but
         * also give user a good idea of where the destination is compared to current
         * location.
         */

        let id = this._view.connect("animation-completed", (function() {
            this._view.disconnect(id);

            id = this._view.connect("animation-completed::go-to", (function() {
                this._view.disconnect(id);
                this.zoomToFit();
                this.emit('gone-to');
            }).bind(this));

            this._view.go_to(this.latitude, this.longitude);
        }).bind(this));

        this._mapView.ensureVisible([this._getCurrentLocation(), this]);
    },

    show: function(layer) {
        let marker = new Champlain.Label({ text: this.description });
        marker.set_location(this.latitude, this.longitude);
        layer.add_marker(marker);
        log("Added marker at " + this.latitude + ", " + this.longitude);
    },

    showNGoTo: function(animate, layer) {
        this.show(layer);
        this.goTo(animate);
    },

    // Zoom to the maximal zoom-level that fits the accuracy circle
    zoomToFit: function() {
        let zoom;
        if (this.accuracy === Geocode.LOCATION_ACCURACY_UNKNOWN)
            zoom = 12; // Accuracy is usually city-level when unknown
        else if (this.accuracy <= Geocode.LOCATION_ACCURACY_STREET)
            zoom = 16;
        else if (this.accuracy <= Geocode.LOCATION_ACCURACY_CITY)
            zoom = 12;
        else if (this.accuracy <= Geocode.LOCATION_ACCURACY_REGION)
            zoom = 10;
        else if (this.accuracy <= Geocode.LOCATION_ACCURACY_COUNTRY)
            zoom = 6;
        else
            zoom = 3;
        this._view.set_zoom_level(zoom);
    },

    _getCurrentLocation: function() {
        return new Geocode.Location({
            latitude: this._view.get_center_latitude(),
            longitude: this._view.get_center_longitude()
        });
    }
});
Signals.addSignalMethods(MapLocation.prototype);
