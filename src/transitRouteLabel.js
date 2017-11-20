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

const Cairo = imports.cairo;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const Color = imports.color;
const Utils = imports.utils;

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

var TransitRouteLabel = GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/transit-route-label.ui',
}, class TransitRouteLabel extends Gtk.Label {

    _init(params) {
        let leg = params.leg;
        let compact = params.compact;
        let print = params.print;

        delete params.leg;
        delete params.compact;
        delete params.print;
        super._init(params);

        this._setLabel(leg, compact, print);
        this.connect('draw', this._onDraw.bind(this));
    }

    _setLabel(leg, compact, print) {
        let color = leg.color;
        let textColor = leg.textColor;
        let label = leg.route;
        let usingDarkTheme = Utils.isUsingDarkThemeVariant() && !print;
        let usingHighContrastTheme = Utils.isUsingHighContrastTheme();

        textColor = Color.getContrastingForegroundColor(color, textColor);

        /* if using the high contrast theme and a label is set, fallback to
         * hight-contrasting colors, if no label, assume the route color is
         * more relevant and keep it also for high contrast
         */
        if (usingHighContrastTheme && label) {
            color = HIGH_CONTRAST_COLOR;
            textColor = HIGH_CONTRAST_TEXT_COLOR;
        }

        this._bgRed = Color.parseColor(color, 0);
        this._bgGreen = Color.parseColor(color, 1);
        this._bgBlue = Color.parseColor(color, 2);
        this._fgRed = Color.parseColor(textColor, 0);
        this._fgGreen = Color.parseColor(textColor, 1);
        this._fgBlue = Color.parseColor(textColor, 2);

        if ((!usingDarkTheme &&
             Color.relativeLuminance(color) > OUTLINE_LUMINANCE_THREASHHOLD) ||
            (usingDarkTheme &&
             Color.relativeLuminance(color) < DARK_OUTLINE_LUMINANCE_THREASHHOLD)) {
            this._hasOutline = true;
        }

        /* for compact (overview) mode, try to shorten the label if the route
         * name was more than 6 characters
         */
        if (compact && label.length > 6)
            label = leg.compactRoute;

        if (compact) {
            /* restrict number of characters shown in the label when compact mode
             * is requested
             */
            this.max_width_chars = 6;
        } else if (leg && !leg.headsign) {
            // if there is no trip headsign to display, allow more space
            this.max_width_chars = 25;
        }

        this.label = '<span foreground="#%s">%s</span>'.format(
                                        textColor,
                                        GLib.markup_escape_text(label, -1));
    }

    /* I didn't find any easy/obvious way to override widget background color
     * and getting rounded corner just using CSS styles, so doing a custom
     * Cairo drawing of a "roundrect"
     */
    _onDraw(widget, cr) {
        let width = widget.get_allocated_width();
        let height = widget.get_allocated_height();
        let radius = this._hasOutline ? 5 : 3;

        cr.newSubPath();
        cr.arc(width - radius, radius, radius, -Math.PI / 2, 0);
        cr.arc(width - radius, height - radius, radius, 0 , Math.PI / 2);
        cr.arc(radius, height - radius, radius, Math.PI / 2, Math.PI);
        cr.arc(radius, radius, radius, Math.PI, 3 * Math.PI / 2);
        cr.closePath();

        cr.setSourceRGB(this._bgRed, this._bgGreen, this._bgBlue);
        cr.fillPreserve();

        if (this._hasOutline) {
            cr.setSourceRGB(this._fgRed, this._fgGreen, this._fgBlue);
            cr.setLineWidth(1);
            cr.stroke();
        }

        return false;
    }
});
