/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2017 Marcus Lundblad
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
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as Color from './color.js';
import {Location} from './location.js';
import {MapMarker} from './mapMarker.js';
import {Place} from './place.js';
import * as TransitPlan from './transitPlan.js';
import * as Utils from './utils.js';

const ICON_SIZE = 12;
const MARKER_SIZE = 20;

/* threashhold for route color luminance when we consider it more or less
 * as white, and draw an outline around the label, and vice versa for dark mode
 */
const OUTLINE_LUMINANCE_THREASHHOLD = 0.9;
const DARK_OUTLINE_LUMINANCE_THREASHHOLD = 0.2;

export class TransitBoardMarker extends MapMarker {

    constructor({leg, ...params}) {
        const firstPoint = leg.polyline[0];
        const location = new Location({ latitude: firstPoint.latitude,
                                        longitude: firstPoint.longitude });

        super({...params, place: new Place({ location: location })});

        this._leg = leg;
        this._styleManager = Adw.StyleManager.get_default();
        this._image.pixel_size = MARKER_SIZE;
    }

    vfunc_map() {
         this._darkId = this._styleManager.connect('notify::dark', () => {
            this._image.paintable = this._createPaintable();
        });
        this._image.paintable = this._createPaintable();

        super.vfunc_map();
    }

    vfunc_unmap() {
        this._styleManager.disconnect(this._darkId);

        super.vfunc_unmap();
    }

    /* Creates a Gdk.Paintable for the given transit leg, showing the
     * corresponding transit type icon and rendered inside a circle using the
     * foreground color of the icon taken from the transit legs text color
     * attribute and background color taken from the transit legs color
     * attribute.
     * Also draw an outline in the same color as the icon in case the
     * background color above a threshold to improve readability against the
     * map background.
     */
    _createPaintable() {
        try {
            const bgColor = this._leg.color ??
                            (this._styleManager.dark ?
                             TransitPlan.DEFAULT_DARK_ROUTE_COLOR :
                             TransitPlan.DEFAULT_ROUTE_COLOR);
            const defaultTextColor =
                this._styleManager.dark ? TransitPlan.DEFAULT_DARK_ROUTE_TEXT_COLOR :
                                          TransitPlan.DEFAULT_ROUTE_TEXT_COLOR;
            const fgColor =
                Color.getContrastingForegroundColor(bgColor, this._leg.textColor ??
                                                             defaultTextColor);
            const hasOutline =
                this._styleManager.dark ?
                Color.relativeLuminance(bgColor) < DARK_OUTLINE_LUMINANCE_THREASHHOLD :
                Color.relativeLuminance(bgColor) > OUTLINE_LUMINANCE_THREASHHOLD;
            const bgRed = Color.parseColor(bgColor, 0);
            const bgGreen = Color.parseColor(bgColor, 1);
            const bgBlue = Color.parseColor(bgColor, 2);
            const fgRed = Color.parseColor(fgColor, 0);
            const fgGreen = Color.parseColor(fgColor, 1);
            const fgBlue = Color.parseColor(fgColor, 2);
            const fgRGBA = new Gdk.RGBA({ red: fgRed,
                                          green: fgGreen,
                                          blue: fgBlue,
                                          alpha: 1.0
                                         });
            const paintable = this._paintableFromIconName(this._leg.iconName,
                                                          ICON_SIZE, fgRGBA);

            const surface = new Cairo.ImageSurface(Cairo.Format.ARGB32,
                                                   MARKER_SIZE, MARKER_SIZE);
            const cr = new Cairo.Context(surface);
            const pixbuf = Gdk.pixbuf_get_from_texture(paintable);

            cr.setOperator(Cairo.Operator.CLEAR);
            cr.paint();
            cr.setOperator(Cairo.Operator.OVER);

            cr.setSourceRGB(bgRed, bgGreen, bgBlue);
            cr.arc(MARKER_SIZE / 2, MARKER_SIZE / 2, MARKER_SIZE / 2,
                   0, Math.PI * 2);
            cr.fillPreserve();

            Gdk.cairo_set_source_pixbuf(cr, pixbuf,
                                        (MARKER_SIZE - pixbuf.get_width()) / 2,
                                        (MARKER_SIZE - pixbuf.get_height()) / 2);
            cr.paint();

            if (hasOutline) {
                cr.setSourceRGB(fgRed, fgGreen, fgBlue);
                cr.setLineWidth(1);
                cr.stroke();
            }

            return Gdk.Texture.new_for_pixbuf(
                Gdk.pixbuf_get_from_surface(surface, 0, 0,
                                            MARKER_SIZE, MARKER_SIZE));
        } catch (e) {
            Utils.debug('Failed to load image: %s'.format(e.message));
            return null;
        }
    }
}

GObject.registerClass(TransitBoardMarker);
