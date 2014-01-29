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

const _MAX_DISTANCE = 19850; // half of Earth's curcumference (km)
const _MIN_ANIMATION_DURATION = 2000; // msec
const _MAX_ANIMATION_DURATION = 5000; // msec

// A map location object with an added accuracy.
const MapLocation = new Lang.Class({
    Name: 'MapLocation',

    _init: function(place, mapView) {
        this._mapView = mapView;
        this._view = mapView.view;
        this.latitude = place.location.latitude;
        this.longitude = place.location.longitude;
        this.description = place.location.description;
        this.accuracy = place.location.accuracy;
        this.type = place.place_type;
    },

    // Go to this location from the current location on the map, optionally
    // with an animation
    // TODO: break this out somewhere, this is useful in other cases as well.
    goTo: function(animate) {
        Utils.debug("Going to " + this.description);

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

        this._view.goto_animation_mode = Clutter.AnimationMode.EASE_IN_CUBIC;

        let fromLocation = new Geocode.Location({
            latitude: this._view.get_center_latitude(),
            longitude: this._view.get_center_longitude()
        });
        this._updateGoToDuration(fromLocation);

        Utils.once(this._view, "animation-completed", (function() {
            Utils.once(this._view, "animation-completed::go-to", (function() {
                this.zoomToFit();
                this._view.goto_animation_mode = Clutter.AnimationMode.EASE_IN_OUT_CUBIC;
                this.emit('gone-to');
            }).bind(this));

            this._view.goto_animation_mode = Clutter.AnimationMode.EASE_OUT_CUBIC;
            this._view.go_to(this.latitude, this.longitude);
        }).bind(this));

        this._mapView.ensureVisible([fromLocation, this]);
    },

    show: function(layer) {
        let marker = new Champlain.Label({ text: this.description });
        marker.set_location(this.latitude, this.longitude);
        layer.add_marker(marker);
        Utils.debug("Added marker at " + this.latitude + ", " + this.longitude);
    },

    showNGoTo: function(animate, layer) {
        this.show(layer);
        this.goTo(animate);
    },

    // Zoom to the maximal zoom-level that fits the place type
    zoomToFit: function() {
        let zoom;

        switch (this.placeType) {
        case Geocode.PlaceType.STREET:
            zoom = 16;
            break;

        case Geocode.PlaceType.CITY:
            zoom = 11;
            break;

        case Geocode.PlaceType.REGION:
            zoom = 10;
            break;

        case Geocode.PlaceType.COUNTRY:
            zoom = 6;
            break;

        default:
            zoom = 11;
            break;
        }
        this._view.set_zoom_level(zoom);
    },

    getAccuracyDescription: function() {
        switch(this.accuracy) {
        case Geocode.LOCATION_ACCURACY_UNKNOWN:
            /* Translators: Accuracy of user location information */
            return _("Unknown");
        case 0:
            /* Translators: Accuracy of user location information */
            return _("Exact");
        default:
            let area =  Math.PI * Math.pow(this.accuracy / 1000, 2);
            log (this.accuracy + " => " + area);
            if (area >= 1)
                area = Math.floor(area);
            else
                area = Math.floor(area * 10) / 10;

            return area.toString() + _(" km²");
        }
    },

    _updateGoToDuration: function(fromLocation) {
        let toLocation = new Geocode.Location({
            latitude: this.latitude,
            longitude: this.longitude
        });

        let distance = fromLocation.get_distance_from(toLocation);
        let duration = (distance / _MAX_DISTANCE) * _MAX_ANIMATION_DURATION;

        // Clamp duration
        duration = Math.max(_MIN_ANIMATION_DURATION,
                            Math.min(duration, _MAX_ANIMATION_DURATION));

        // We divide by two because Champlain treats both go_to and
        // ensure_visible as 'goto' journeys with its own duration.
        this._view.goto_animation_duration = duration / 2;
    }
});
Utils.addSignalMethods(MapLocation.prototype);
