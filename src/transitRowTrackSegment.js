/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2025 Jalen Ng
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
 * Author: Jalen Ng <jalen.dev@pm.me>
 */


import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import Gsk from 'gi://Gsk';
import Gtk from 'gi://Gtk';

import * as Color from './color.js';
import * as TransitPlan from './transitPlan.js';

/* threshold for route color luminance when we consider it more or less
 * as white, and draw an outline around the label
 */
const OUTLINE_LUMINANCE_THRESHOLD = 0.9;
/* the threshold when using a dark theme, when the color is darker draw an
 * outline around the label
 */
const DARK_OUTLINE_LUMINANCE_THRESHOLD = 0.1;

// fallback high contrast colors
const HIGH_CONTRAST_COLOR =
    new Gdk.RGBA({ red: 0.0, green: 0.0, blue: 0.0, alpha: 1.0 });
const HIGH_CONTRAST_TEXT_COLOR =
    new Gdk.RGBA({ red: 1.0, green: 1.0, blue: 1.0, alpha: 1.0 });;

const WALK_LINE_WIDTH = 4;
const TRANSIT_LINE_WIDTH = 12;
const TRANSIT_STATION_WIDTH = 6;

export class TransitRowTrackSegment extends Gtk.Widget {

    constructor({ colors, isWalk, isHead, isTail, isStation, ...params }) {
        super(params);

        this._lineColor = colors?.line;
        this._stopColor = colors?.stop;
        this._isWalk = isWalk;
        this._isHead = isHead;
        this._isTail = isTail;
        this._isStation = isStation;

        this._styleManager = Adw.StyleManager.get_default();
        this._settings = this.get_settings();

        this._stroke = new Gsk.Stroke(this._isWalk
            ? WALK_LINE_WIDTH
            : TRANSIT_LINE_WIDTH);
        this._stroke.set_line_cap(Gsk.LineCap.ROUND);

        this._outlineStroke = new Gsk.Stroke(this._isWalk
            ? WALK_LINE_WIDTH + 2
            : TRANSIT_LINE_WIDTH + 2);
        this._outlineStroke.set_line_cap(Gsk.LineCap.ROUND);

        if (this._isWalk) {
            this._stroke.set_dash([0, WALK_LINE_WIDTH * 2]);
        }
    }

    vfunc_measure(orientation, for_size) {
        if (orientation === Gtk.Orientation.HORIZONTAL) {
            return [12, 16, -1, -1];
        } else {
            return [0, -1, -1, -1];
        }
    }

    vfunc_map() {
        this._darkId = this._styleManager.connect('notify::dark', () => {
            this.queue_draw();
        });

        this._themeId = this._settings.connect('notify::gtk_theme_name', () => {
            this.queue_draw();
        });

        this.queue_draw();

        super.vfunc_map();
    }

    vfunc_unmap() {
        this._styleManager.disconnect(this._darkId);
        this._settings.disconnect(this._themeId);

        super.vfunc_unmap();
    }

    vfunc_snapshot(snapshot) {
        const width = this.get_width();
        const height = this.get_height();

        const usingDarkTheme = this._styleManager.dark;
        let color = this._lineColor ?? (usingDarkTheme ?
            TransitPlan.DEFAULT_DARK_ROUTE_COLOR :
            TransitPlan.DEFAULT_ROUTE_COLOR);
        let fgColor =
            this._stopColor ?? (usingDarkTheme ?
                TransitPlan.DEFAULT_DARK_ROUTE_TEXT_COLOR :
                TransitPlan.DEFAULT_ROUTE_TEXT_COLOR);

        const usingHighContrastTheme =
            this._settings.gtk_theme_name === 'HighContrast' ||
            this._settings.gtk_theme_name === 'HighContrastInverse';

        fgColor = Color.getContrastingForegroundColor(color, fgColor);

        if (usingHighContrastTheme) {
            color = usingDarkTheme ? HIGH_CONTRAST_TEXT_COLOR : HIGH_CONTRAST_COLOR;
            fgColor = usingDarkTheme ? HIGH_CONTRAST_COLOR : HIGH_CONTRAST_TEXT_COLOR;
        }

        const hasOutline =
            (!usingDarkTheme &&
                Color.relativeLuminance(color) > OUTLINE_LUMINANCE_THRESHOLD) ||
            (usingDarkTheme &&
                Color.relativeLuminance(color) < DARK_OUTLINE_LUMINANCE_THRESHOLD);

        // Create clipping region
        const bounds = new Graphene.Rect();
        bounds.init(0, 0, width, height);
        snapshot.push_clip(bounds);

        // Get center point
        const cx = width / 2;
        const cy = height / 2;

        // Draw outline (a thicker line) first if needed
        if (hasOutline) {
            const outlinePathBuilder = new Gsk.PathBuilder();
            outlinePathBuilder.move_to(cx, this._isHead ? cy : 0);
            outlinePathBuilder.line_to(cx, this._isTail ? cy : height);
            snapshot.append_stroke(
                outlinePathBuilder.to_path(),
                this._outlineStroke,
                fgColor
            );
        }
        
        // Draw line
        const linePathBuilder = new Gsk.PathBuilder();
        linePathBuilder.move_to(cx, this._isHead ? cy : 0);
        linePathBuilder.line_to(cx, this._isTail ? cy : height);
        snapshot.append_stroke(
            linePathBuilder.to_path(),
            this._stroke,
            color
        );

        // Draw station
        if (!this._isWalk && this._isStation) {
            const stationPathBuilder = new Gsk.PathBuilder();
            const center = new Graphene.Point({
                x: cx,
                y: cy
            });
            stationPathBuilder.add_circle(center, TRANSIT_STATION_WIDTH / 2)
            snapshot.append_fill(
                stationPathBuilder.to_path(),
                Gsk.FILL_RULE_EVEN_ODD,
                fgColor
            );
        }

        snapshot.pop();

        super.vfunc_snapshot(snapshot);
    }
}

GObject.registerClass(TransitRowTrackSegment);
