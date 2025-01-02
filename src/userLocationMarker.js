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

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import Gsk from 'gi://Gsk';
import Shumate from 'gi://Shumate';

import {MapMarker} from './mapMarker.js';

const LOCATION_MARKER_SIZE = 32;
const LOCATION_MARKER_MARGIN = 4;
const WHITE = new Gdk.RGBA({ red: 1.0, green: 1.0, blue: 1.0, alpha: 1.0} );

export class AccuracyCircleMarker extends Shumate.Marker {

    constructor({place, ...params}) {
        super({
            ...params,
            latitude: place.location.latitude,
            longitude: place.location.longitude,
            can_focus: false,
            can_target: false
        });

        this._place = place;
    }

    refreshGeometry(mapView) {
        this.latitude = this._place.location.latitude;
        this.longitude = this._place.location.longitude;

        let zoom = mapView.map.viewport.zoom_level;
        let source = mapView.mapSource;
        let metersPerPixel = source.get_meters_per_pixel(zoom,
                                                         this.latitude,
                                                         this.longitude);
        let size = this._place.location.accuracy * 2 / metersPerPixel;
        let {x, y, width, height} = mapView.get_allocation();

        if (size > width || size > height)
            this.visible = false;
        else {
            this.set_size_request(size, size);
            this.visible = true;
            this.queue_draw();
        }
    }

    vfunc_snapshot(snapshot) {
        let {x, y, width, height} = this.get_allocation();
        let rect = new Graphene.Rect();

        rect.init(0, 0, width, height);

        let cr = snapshot.append_cairo(rect);

        cr.setOperator(Cairo.Operator.OVER);

        cr.setSourceRGBA(0, 0, 255, 0.1);
        cr.arc(width / 2, width / 2, width / 2, 0, Math.PI * 2);
        cr.fillPreserve();

        super.vfunc_snapshot(snapshot);
    }
}

GObject.registerClass(AccuracyCircleMarker);

export class UserLocationMarker extends MapMarker {

    constructor(params) {
        super(params);

        this._accuracyMarker = new AccuracyCircleMarker({ place: this.place });
        this.connect('notify::view-zoom-level',
                     () => this._accuracyMarker.refreshGeometry(this._mapView));
        this._mapView.connect('notify::default-width',
                     () => this._accuracyMarker.refreshGeometry(this._mapView));
        this._mapView.connect('notify::default-height',
                     () => this._accuracyMarker.refreshGeometry(this._mapView));
        this._accuracyMarker.refreshGeometry(this._mapView);

        this.place.connect('notify::location', () => this._updateLocation());

        this.connect('notify::visible', this._updateAccuracyCircle.bind(this));
        this._mapView.map.viewport.connect('notify::rotation',
                                           () => this._updateLocation());
        this._styleManager = Adw.StyleManager.get_default();
        this.set_size_request(LOCATION_MARKER_SIZE, LOCATION_MARKER_SIZE);
        this._pathBuilder = new Gsk.PathBuilder();
    }

    vfunc_map() {
        this._accentId = this._styleManager.connect('notify::accent-color-rgba', () => {
            this.queue_draw();
        });
        this.queue_draw();

        super.vfunc_map();
    }

    vfunc_unmap() {
        this._styleManager.disconnect(this._accentId);

        super.vfunc_unmap();
    }

    _hasBubble() {
        return true;
    }

    addToLayer(layer) {
        layer.add_marker(this._accuracyMarker);
        layer.add_marker(this);
    }

    _updateAccuracyCircle() {
        if (this.visible && this.place.location.accuracy > 0) {
            this._accuracyMarker.refreshGeometry(this._mapView);
        } else {
            this._accuracyMarker.visible = false;
        }
    }

    vfunc_snapshot(snapshot) {
        const accentColor = this._styleManager.accent_color_rgba;
        const center = new Graphene.Point();

        center.init(LOCATION_MARKER_SIZE / 2, LOCATION_MARKER_SIZE / 2);
        this._pathBuilder.add_circle(center, LOCATION_MARKER_SIZE / 2);
        snapshot.append_fill(this._pathBuilder.to_path(),
                             Gsk.FILL_RULE_EVEN_ODD, WHITE);
        this._pathBuilder.add_circle(center, LOCATION_MARKER_SIZE / 2 -
                                             LOCATION_MARKER_MARGIN);
        snapshot.append_fill(this._pathBuilder.to_path(),
                             Gsk.FILL_RULE_EVEN_ODD, accentColor);

        super.vfunc_snapshot(snapshot);
    }
}

GObject.registerClass(UserLocationMarker);
