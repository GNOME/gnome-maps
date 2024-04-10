/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2017 Marcus Lundblad.
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
 * Author: Marcus Lundblad <ml@update.uu.se>
 */

import Adw from 'gi://Adw';
import Cairo from 'cairo';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import Gtk from 'gi://Gtk';

import * as Color from './color.js';
import * as Gfx from './gfx.js';
import * as TransitPlan from './transitPlan.js';
import * as Utils from './utils.js';

/* threashhold for route color luminance when we consider it more or less
 * as white, and draw an outline around the label
 */
const OUTLINE_LUMINANCE_THREASHHOLD = 0.9;
/* the threashhold when using a dark theme, when the color is darker draw an
 * outline around the label
 */
const DARK_OUTLINE_LUMINANCE_THREASHHOLD = 0.1;

// fallback high contrast colors
const HIGH_CONTRAST_COLOR = '000000';
const HIGH_CONTRAST_TEXT_COLOR = 'ffffff';

export class TransitRouteLabel extends Gtk.Label {

    constructor({leg, compact, ...params}) {
        super(params);

        this._leg = leg;
        this._compact = compact;
        this._styleManager = Adw.StyleManager.get_default();
        this._settings = this.get_settings();
    }

    vfunc_map() {
        this._darkId = this._styleManager.connect('notify::dark', () => {
            this._setLabel();
        });

        this._themeId = this._settings.connect('notify::gtk_theme_name', () => {
            this._setLabel();
        });

        this._setLabel();

        super.vfunc_map();
    }

    vfunc_unmap() {
        this._styleManager.disconnect(this._darkId);
        this._settings.disconnect(this._themeId);

        super.vfunc_unmap();
    }

    _setLabel() {
        const usingDarkTheme = this._styleManager.dark;
        let color = this._leg.color ?? (usingDarkTheme ?
                                        TransitPlan.DEFAULT_DARK_ROUTE_COLOR :
                                        TransitPlan.DEFAULT_ROUTE_COLOR);
        let textColor =
            this._leg.textColor ?? (usingDarkTheme ?
                             TransitPlan.DEFAULT_DARK_ROUTE_TEXT_COLOR :
                             TransitPlan.DEFAULT_ROUTE_TEXT_COLOR);
        let label = this._leg.route;

        const usingHighContrastTheme =
            this._settings.gtk_theme_name === 'HighContrast' ||
            this._settings.gtk_theme_name === 'HighContrastInverse';

        textColor = Color.getContrastingForegroundColor(color, textColor);

        /* if using the high contrast theme and a label is set, fallback to
         * hight-contrasting colors, if no label, assume the route color is
         * more relevant and keep it also for high contrast
         */
        if (usingHighContrastTheme && ((this._compact && this._leg.compactRoute) ||
                                       (!this._compact && label))) {
            color = usingDarkTheme ? HIGH_CONTRAST_TEXT_COLOR : HIGH_CONTRAST_COLOR;
            textColor = usingDarkTheme ? HIGH_CONTRAST_COLOR : HIGH_CONTRAST_TEXT_COLOR;
        }

        this._color = color;
        this._textColor = textColor;

        if ((!usingDarkTheme &&
             Color.relativeLuminance(color) > OUTLINE_LUMINANCE_THREASHHOLD) ||
            (usingDarkTheme &&
             Color.relativeLuminance(color) < DARK_OUTLINE_LUMINANCE_THREASHHOLD)) {
            this._hasOutline = true;
        }

        /* for compact (overview) mode, try to shorten the label if the route
         * name was more than 6 characters
         */
        if (this._compact && label.length > 6)
            label = this._leg.compactRoute;

        if (this._compact) {
            /* restrict number of characters shown in the label when compact mode
             * is requested
             */
            this.max_width_chars = 6;
        } else if (this._leg && !this._leg.headsign) {
            // if there is no trip headsign to display, allow more space
            this.max_width_chars = 25;
        }

        this.label = '<span foreground="#%s">%s</span>'.format(
                                        textColor,
                                        GLib.markup_escape_text(label, -1));

        this.queue_draw();
    }

    /* I didn't find any easy/obvious way to override widget background color
     * and getting rounded corner just using CSS styles, so doing a custom
     * Cairo drawing of a "roundrect"
     */
    vfunc_snapshot(snapshot) {
        let {x, y, width, height} = this.get_allocation();
        let rect = new Graphene.Rect();

        rect.init(0, 0, width, height);

        let cr = snapshot.append_cairo(rect);

        // clip off the badge, this seems to avoid some extra space at right/bottom with the CSS
        Gfx.drawColoredBagde(cr, this._color,
                             this._hasOutline ? this._textColor : null,
                             0, 0, width - 3, height - 3);
        super.vfunc_snapshot(snapshot);
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/transit-route-label.ui',
}, TransitRouteLabel);
