/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2011, 2012, 2013 Red Hat, Inc.
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
 * Author: Zeeshan Ali (Khattak) <zeeshanak@gnome.org>
 *         Damián Nohales <damiannohales@gmail.com>
 */

const Champlain = imports.gi.Champlain;
const Clutter = imports.gi.Clutter;
const Geocode = imports.gi.GeocodeGlib;
const Lang = imports.lang;

const Location = imports.location;
const Utils = imports.utils;

const _MAX_DISTANCE = 19850; // half of Earth's circumference (km)
const _MIN_ANIMATION_DURATION = 2000; // msec
const _MAX_ANIMATION_DURATION = 5000; // msec

var MapWalker = new Lang.Class({
    Name: 'MapWalker',

    _init: function(place, mapView) {
        this.place = place;
        this._mapView = mapView;
        this._view = mapView.view;
        this._boundingBox = this._createBoundingBox(this.place);
    },

    _createBoundingBox: function(place) {
        if (place.bounding_box !== null) {
            return new Champlain.BoundingBox({ top: place.bounding_box.top,
                                               bottom: place.bounding_box.bottom,
                                               left: place.bounding_box.left,
                                               right: place.bounding_box.right });
        } else
            return null;
    },

    // Zoom to the maximal zoom-level that fits the place type
    zoomToFit: function() {
        let zoom;
        if (this._boundingBox !== null && this._boundingBox.is_valid()) {
            this._view.zoom_level = this._view.max_zoom_level;
            this._view.ensure_visible(this._boundingBox, false);
        } else {
            switch (this.place.place_type) {
            case Geocode.PlaceType.STREET:
                zoom = 16;
                break;

            case Geocode.PlaceType.TOWN:
                zoom = 11;
                break;

            case Geocode.PlaceType.COUNTRY:
                zoom = 6;
                break;

            default:
                zoom = this._view.max_zoom_level;
                break;
            }
            this._view.zoom_level = zoom;
            this._view.center_on(this.place.location.latitude,
                                 this.place.location.longitude);
        }
    },

    goTo: function(animate, linear) {
        Utils.debug('Going to ' + [this.place.name,
                    this.place.location.latitude,
                    this.place.location.longitude].join(' '));
        this._mapView.emit('going-to');

        if (!animate) {
            this._view.center_on(this.place.location.latitude,
                                 this.place.location.longitude);
            this.emit('gone-to');
            return;
        }

        let fromLocation = new Location.Location({ latitude: this._view.get_center_latitude(),
                                                   longitude: this._view.get_center_longitude() });
        this._updateGoToDuration(fromLocation);

        if (linear) {
            this._view.goto_animation_mode = Clutter.AnimationMode.LINEAR;
            Utils.once(this._view, 'animation-completed',
                       this.zoomToFit.bind(this));
            this._view.go_to(this.place.location.latitude,
                             this.place.location.longitude);
        } else {
            /* Lets first ensure that both current and destination location are visible
             * before we start the animated journey towards destination itself. We do this
             * to create the zoom-out-then-zoom-in effect that many map implementations
             * do. This not only makes the go-to animation look a lot better visually but
             * also give user a good idea of where the destination is compared to current
             * location.
             */
            this._view.goto_animation_mode = Clutter.AnimationMode.EASE_IN_CUBIC;
            this._ensureVisible(fromLocation);

            Utils.once(this._view, 'animation-completed', () => {
                this._view.goto_animation_mode = Clutter.AnimationMode.EASE_OUT_CUBIC;
                this._view.go_to(this.place.location.latitude,
                                 this.place.location.longitude);

                Utils.once(this._view, 'animation-completed::go-to', () => {
                    this.zoomToFit();
                    this._view.goto_animation_mode = Clutter.AnimationMode.EASE_IN_OUT_CUBIC;
                    this.emit('gone-to');
                });
            });
        }
    },

    _ensureVisible: function(fromLocation) {
        let visibleBox = null;

        if (this._boundingBox !== null && this._boundingBox.is_valid()) {
            visibleBox = this._boundingBox.copy();

            visibleBox.extend(fromLocation.latitude, fromLocation.longitude);
        } else {
            visibleBox = new Champlain.BoundingBox({ left:   180,
                                                     right: -180,
                                                     bottom:  90,
                                                     top:    -90 });

            [fromLocation, this.place.location].forEach((location) => {
                visibleBox.left   = Math.min(visibleBox.left,   location.longitude);
                visibleBox.right  = Math.max(visibleBox.right,  location.longitude);
                visibleBox.bottom = Math.min(visibleBox.bottom, location.latitude);
                visibleBox.top    = Math.max(visibleBox.top,    location.latitude);
            });
        }

        this._view.ensure_visible(visibleBox, true);
    },

    _boxCovers: function(coverBox) {
        if (this._boundingBox === null)
            return false;

        if (coverBox.left > this._boundingBox.left)
            return false;

        if (coverBox.right < this._boundingBox.right)
            return false;

        if (coverBox.top < this._boundingBox.top)
            return false;

        if (coverBox.bottom > this._boundingBox.bottom)
            return false;

        return true;
    },

    _updateGoToDuration: function(fromLocation) {
        let toLocation = this.place.location;

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
Utils.addSignalMethods(MapWalker.prototype);
