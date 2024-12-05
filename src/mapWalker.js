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

import GObject from 'gi://GObject';

import {BoundingBox} from './boundingBox.js';
import {Location} from './location.js';
import * as PlaceZoom from './placeZoom.js';
import * as Utils from './utils.js';

const _MAX_DISTANCE = 19850; // half of Earth's circumference (km)
const _MIN_ANIMATION_DURATION = 2000; // msec
const _MAX_ANIMATION_DURATION = 5000; // msec

// default zoom level when no place-specific zoom level is defined for a place
const DEFAULT_ZOOM_LEVEL = 18;

export class MapWalker extends GObject.Object {

    constructor(place, mapView) {
        super();
        this.place = place;
        this._mapView = mapView;
        this._viewport = mapView.map.viewport;
        this._boundingBox = this._createBoundingBox(this.place);
    }

    _createBoundingBox(place) {
        if (place.boundingBox !== null) {
            return new BoundingBox({ top: place.boundingBox.top,
                                     bottom: place.boundingBox.bottom,
                                     left: place.boundingBox.left,
                                     right: place.boundingBox.right });
        } else {
            return null;
        }
    }

    _getZoomLevel() {
        let zoom;

        if (this.place.initialZoom) {
            zoom = this.place.initialZoom;
        } else {
            zoom = PlaceZoom.getZoomLevelForPlace(this.place) ??
                   Math.min(DEFAULT_ZOOM_LEVEL, this._viewport.max_zoom_level);

            /* If the place has a bounding box, use the lower of the default
             * zoom level based on the place's type and the zoom level needed
             * fit the bounding box. This way we ensure the bounding box will
             * be all visible and we also have an appropriate amount
             * of context for the place
             */
            if (this._boundingBox !== null && this._boundingBox.isValid()) {
                let bboxZoom =
                    this._mapView.getZoomLevelFittingBBox(this._boundingBox);

                zoom = Math.min(zoom, bboxZoom);
            }
        }

        return zoom;
    }

    // Zoom to the maximal zoom-level that fits the place type
    zoomToFit() {
        let zoom = this._getZoomLevel();

        this._mapView.map.go_to_full_with_duration(this.place.location.latitude,
                                     this.place.location.longitude,
                                     zoom,
                                     500);
    }

    goTo(animate, linear) {
        let zoom = this._getZoomLevel();
        Utils.debug('Going to ' + [this.place.name,
                    this.place.location.latitude,
                    this.place.location.longitude].join(' '));
        this._mapView.emit('going-to');

        if (!animate) {
            this._mapView.map.center_on(this.place.location.latitude,
                                        this.place.location.longitude);
            this._mapView.map.viewport.zoom_level = zoom;
            this.emit('gone-to');
            return;
        } else {
            this._mapView.map.go_to_full(this.place.location.latitude,
                                         this.place.location.longitude,
                                         zoom);
            Utils.once(this._mapView.map, 'animation-completed::go-to',
                       () => this.emit('gone-to'));
        }
    }

    _ensureVisible(fromLocation) {
        let visibleBox = null;

        if (this._boundingBox !== null && this._boundingBox.isValid()) {
            visibleBox = this._boundingBox.copy();

            visibleBox.extend(fromLocation.latitude, fromLocation.longitude);
        } else {
            visibleBox = new BoundingBox({ left:   180,
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

        let [lon, lat] = visibleBox.getCenter();

        this._view.zoom_level = this._mapView.getZoomLevelFittingBBox(visibleBox);
        this._view.go_to(lat, lon);
    }

    _boxCovers(coverBox) {
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
    }
}

GObject.registerClass({
    Signals: {
        'gone-to': { }
    }
}, MapWalker);
