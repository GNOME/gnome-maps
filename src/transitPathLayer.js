/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2024 Marcus Lundblad
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
 * Author: Marcus Lundblad <ml@dfupdate.se>
 */

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Shumate from 'gi://Shumate';

import * as Color from './color.js';
import * as TransitPlan from './transitPlan.js';

// line width for route lines
const LINE_WIDTH = 5;

/* length of filled parts of dashed lines used for walking legs of transit
 * itineraries
 */
const DASHED_ROUTE_LINE_FILLED_LENGTH = 5;

// length of gaps of dashed lines used for walking legs of transit itineraries
const DASHED_ROUTE_LINE_GAP_LENGTH = 5;

/* threashhold for route color luminance when we consider it more or less
 * as white, and draw an outline on the path, and vice versa for dark mode */
const OUTLINE_LUMINANCE_THREASHHOLD = 0.6;
const DARK_OUTLINE_LUMINANCE_THREASHHOLD = 0.2;

export class TransitPathLayer extends Shumate.PathLayer {
    constructor({ leg, ...params }) {
        super(params);

        this._leg = leg;
        this._styleManager = Adw.StyleManager.get_default();
    }

    vfunc_map() {
        this._darkId = this._styleManager.connect('notify::dark', () => {
            this._updateStyle();
        });
        this._updateStyle();

        super.vfunc_map();
    }

    vfunc_unmap() {
        this._styleManager.disconnect(this._darkId);

        super.vfunc_unmap();
    }

    _updateStyle() {
        const defaultColor =
            this._styleManager.dark ? TransitPlan.DEFAULT_DARK_ROUTE_COLOR :
                                      TransitPlan.DEFAULT_ROUTE_COLOR;
        const defaultTextColor =
            this._styleManager.dark ? TransitPlan.DEFAULT_DARK_ROUTE_TEXT_COLOR :
                                      TransitPlan.DEFAULT_ROUTE_TEXT_COLOR;
        const color = this._leg.color ?? defaultColor;
        const outlineColor =
            Color.getContrastingForegroundColor(color,
                                                this._leg.textColor ?? defaultTextColor);
        const luminance = Color.relativeLuminance(color);
        const hasOutline = this._styleManager.dark ?
                           luminance < DARK_OUTLINE_LUMINANCE_THREASHHOLD :
                           luminance > OUTLINE_LUMINANCE_THREASHHOLD;
        const lineWidth = LINE_WIDTH + (hasOutline ? 2 : 0);

        this.stroke_color = Color.parseColorAsRGBA(color);
        this.stroke_width = lineWidth;

        if (!this._leg.transit)
            this.set_dash([DASHED_ROUTE_LINE_FILLED_LENGTH,
                           DASHED_ROUTE_LINE_GAP_LENGTH]);

        if (hasOutline) {
            this.outline_width = 1;
            this.outline_color = Color.parseColorAsRGBA(outlineColor);
        } else {
            this.outline_width = 0;
        }
    }
}

GObject.registerClass(TransitPathLayer);
