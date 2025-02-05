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

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import Gsk from 'gi://Gsk';
import Shumate from 'gi://Shumate';

import {MapMarker} from './mapMarker.js';

const LOCATION_MARKER_SIZE = 32;
const LOCATION_MARKER_MARGIN = 4;
const LOCATION_MARKER_SHADOW_RADIUS = 4;
const WHITE = new Gdk.RGBA({ red: 1.0, green: 1.0, blue: 1.0, alpha: 1.0 });
const SHADOW_COLOR = new Gdk.RGBA({ red: 0.0, green: 0.0, blue: 0.0, alpha: 0.05 });
const ACCURACY_CIRCLE_OPACITY = 0.075;
const ACCURACY_CIRCLE_OUTLINE_OPACITY = 0.225;
const ACCURACY_CIRCLE_MIN_RADIUS = 30; // min accuracy to show circle (in meters)

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
        this._styleManager = Adw.StyleManager.get_default();
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

    refreshGeometry(mapView) {
        const accuracy = this._place.location.accuracy;

        this.latitude = this._place.location.latitude;
        this.longitude = this._place.location.longitude;

        let zoom = mapView.map.viewport.zoom_level;
        let source = mapView.mapSource;
        let metersPerPixel = source.get_meters_per_pixel(zoom,
                                                         this.latitude,
                                                         this.longitude);
        let size = accuracy * 2 / metersPerPixel;
        let {x, y, width, height} = mapView.get_allocation();

        if (accuracy < ACCURACY_CIRCLE_MIN_RADIUS || size > width || size > height)
            this.visible = false;
        else {
            this.set_size_request(size, size);
            this.visible = true;
            this.queue_draw();
        }
    }

    vfunc_snapshot(snapshot) {
        const width = this.get_width();
        const height = this.get_height();
        const accentColor = this._styleManager.accent_color_rgba;
        const center = new Graphene.Point({ x: width / 2, y: height / 2 });

        this._pathBuilder.add_circle(center, width / 2);
        snapshot.append_fill(this._pathBuilder.to_path(),
                             Gsk.FILL_RULE_EVEN_ODD,
                             new Gdk.RGBA({ red:   accentColor.red,
                                            green: accentColor.green,
                                            blue:  accentColor.blue,
                                            alpha: ACCURACY_CIRCLE_OPACITY }));

        this._pathBuilder.add_circle(center, width / 2);
        snapshot.append_stroke(this._pathBuilder.to_path(),
                               new Gsk.Stroke(1),
                               new Gdk.RGBA({ red:   accentColor.red,
                                              green: accentColor.green,
                                              blue:  accentColor.blue,
                                              alpha: ACCURACY_CIRCLE_OUTLINE_OPACITY }));

        super.vfunc_snapshot(snapshot);
    }
}

GObject.registerClass(AccuracyCircleMarker);

class HeadingTorch extends Shumate.Marker {
    constructor({place, mapView, ...params}) {
        super({
            ...params,
            latitude: place.location.latitude,
            longitude: place.location.longitude,
            can_focus: false,
            can_target: false
        });

        this._place = place;
        this._mapView = mapView;
        this._styleManager = Adw.StyleManager.get_default();
        this._pathBuilder = new Gsk.PathBuilder();
        this._place.connect('notify::location', this.refresh.bind(this));
        this._mapView.map.viewport.connect('notify::rotation',
                                           this.refresh.bind(this));
        this.set_size_request(LOCATION_MARKER_SIZE * 2.5,
                              LOCATION_MARKER_SIZE * 2.5);
        this.refresh();
    }

    refresh() {
        if (this._place.location.heading === -1) {
            this.visible = false;
        } else {
            this.latitude = this._place.location.latitude;
            this.longitude = this._place.location.longitude;
            this.visible = true;
            this.queue_draw();
        }
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

    vfunc_snapshot(snapshot) {
        const accentColor = this._styleManager.accent_color_rgba;
        const r = this.get_width() / 2;
        const angle = this._place.location.heading +
                      this._mapView.map.viewport.rotation * 180 / Math.PI
        const center = new Graphene.Point({ x: r, y: r });
        const bounds = new Graphene.Rect();
        const gradientStart =
            new Gsk.ColorStop({ offset: 0,
                                color:  new Gdk.RGBA({ red:   accentColor.red,
                                                       green: accentColor.green,
                                                       blue:  accentColor.blue,
                                                       alpha: 0.5 }) });
        const gradientEnd =
            new Gsk.ColorStop({ offset: 1,
                                color:  new Gdk.RGBA({ red:   accentColor.red,
                                                       green: accentColor.green,
                                                       blue:  accentColor.blue,
                                                       alpha: 0.0 }) });

        bounds.init(-r, -r, 2 * r, 2 * r);

        this._pathBuilder.line_to(-r * Math.sqrt(2) / 2,
                                  -r * Math.sqrt(2) / 2);
        this._pathBuilder.arc_to(0, -r * Math.sqrt(2),
                                 r * Math.sqrt(2) / 2,
                                 -r * Math.sqrt(2) / 2);
        this._pathBuilder.line_to(0, 0);
        snapshot.translate(center);
        snapshot.rotate(angle);
        snapshot.push_fill(this._pathBuilder.to_path(), Gsk.FILL_RULE_EVEN_ODD);
        snapshot.append_radial_gradient(bounds, new Graphene.Point(), r, r, 0.4, 1,
                                        [gradientStart, gradientEnd]);
        snapshot.pop();

        super.vfunc_snapshot(snapshot);
    }
}

GObject.registerClass(HeadingTorch);

export class UserLocationMarker extends MapMarker {

    constructor(params) {
        super(params);

        this._accuracyMarker = new AccuracyCircleMarker({ place: this.place });
        this._headingTorch = new HeadingTorch({ place:   this.place,
                                                mapView: this._mapView });
        this.connect('notify::view-zoom-level',
                     () => this._accuracyMarker.refreshGeometry(this._mapView));
        this._mapView.connect('notify::default-width',
                     () => this._accuracyMarker.refreshGeometry(this._mapView));
        this._mapView.connect('notify::default-height',
                     () => this._accuracyMarker.refreshGeometry(this._mapView));
        this._accuracyMarker.refreshGeometry(this._mapView);

        this.place.connect('notify::location', () => this._updateLocation());

        this.connect('notify::visible', this._updateLocation.bind(this));

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
        layer.add_marker(this._headingTorch);
        layer.add_marker(this);
    }

    _updateLocation() {
        this._updateAccuracyCircle();
        this._updateHeadingTorch();
    }

    _updateHeadingTorch() {
        if (this.visible) {
            this._headingTorch.refresh();
        } else {
            this._headingTorch.visible = false;
        }
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
        const center = new Graphene.Point({ x: LOCATION_MARKER_SIZE / 2,
                                            y: LOCATION_MARKER_SIZE / 2 });
        const shadowBounds = new Graphene.Rect();

        shadowBounds.init(-LOCATION_MARKER_SHADOW_RADIUS,
                          -LOCATION_MARKER_SHADOW_RADIUS,
                          LOCATION_MARKER_SIZE + 2 * LOCATION_MARKER_SHADOW_RADIUS,
                          LOCATION_MARKER_SIZE + 2 * LOCATION_MARKER_SHADOW_RADIUS);

        // draw shadow
        shadowBounds.init(0, 0, LOCATION_MARKER_SIZE, LOCATION_MARKER_SIZE);
        const shadowOutline = new Gsk.RoundedRect();
        const corner = new Graphene.Size({ width:  LOCATION_MARKER_SIZE / 2,
                                           height: LOCATION_MARKER_SIZE / 2 });

        shadowOutline.init(shadowBounds, corner, corner, corner, corner);

        snapshot.append_outset_shadow(shadowOutline, SHADOW_COLOR, 0, 0,
                                      LOCATION_MARKER_SHADOW_RADIUS,
                                      LOCATION_MARKER_SHADOW_RADIUS);

        // draw outer white circle
        this._pathBuilder.add_circle(center, LOCATION_MARKER_SIZE / 2);
        snapshot.append_fill(this._pathBuilder.to_path(),
                             Gsk.FILL_RULE_EVEN_ODD, WHITE);

        // draw inner accent-colored circle
        this._pathBuilder.add_circle(center, LOCATION_MARKER_SIZE / 2 -
                                             LOCATION_MARKER_MARGIN);
        snapshot.append_fill(this._pathBuilder.to_path(),
                             Gsk.FILL_RULE_EVEN_ODD, accentColor);

        super.vfunc_snapshot(snapshot);
    }
}

GObject.registerClass(UserLocationMarker);
