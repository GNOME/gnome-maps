/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2025 Marcus Lundblad
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
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import Gsk from 'gi://Gsk';
import Gtk from 'gi://Gtk';

import * as Color from './color.js';
import {IconMarker} from './iconMarker.js';
import {Location} from './location.js';
import {Place} from './place.js';
import * as TransitPlan from './transitPlan.js';
import * as Utils from './utils.js';

const ICON_SIZE = 16;
const DEFAULT_MARKER_SIZE = 32;
const OUTLINE_WIDTH = 1;

/* threashhold for route color luminance when we consider it more or less
 * as white, and draw an outline around the label, and vice versa for dark mode
 */
const OUTLINE_LUMINANCE_THREASHHOLD = 0.6;
const DARK_OUTLINE_LUMINANCE_THREASHHOLD = 0.2;

export class CircleIconMarker extends IconMarker {

    constructor({ latitude, longitude, color, textColor, iconName,
                  markerSize = DEFAULT_MARKER_SIZE, ...params}) {
        const location = new Location({ latitude:  latitude,
                                        longitude: longitude });

        super({...params, place: new Place({ location: location })});

        this._color = color;
        this._textColor = textColor;
        this._iconName = iconName;
        this._markerSize = markerSize;
        this._styleManager = Adw.StyleManager.get_default();
        this._image.pixel_size = this._markerSize;
        this._pathBuilder = new Gsk.PathBuilder();
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
            const bgColor = this._color ??
                            (this._styleManager.dark ?
                             TransitPlan.DEFAULT_DARK_ROUTE_COLOR :
                             TransitPlan.DEFAULT_ROUTE_COLOR);
            const defaultTextColor =
                this._styleManager.dark ? TransitPlan.DEFAULT_DARK_ROUTE_TEXT_COLOR :
                                          TransitPlan.DEFAULT_ROUTE_TEXT_COLOR;
            const fgColor =
                Color.getContrastingForegroundColor(bgColor, this._textColor ??
                                                             defaultTextColor);
            const hasOutline =
                this._styleManager.dark ?
                Color.relativeLuminance(bgColor) < DARK_OUTLINE_LUMINANCE_THREASHHOLD :
                Color.relativeLuminance(bgColor) > OUTLINE_LUMINANCE_THREASHHOLD;
            const fgRGBA = Color.parseColorAsRGBA(fgColor);
            const bgRGBA = Color.parseColorAsRGBA(bgColor);
            const paintable = this._paintableFromIconName(this._iconName,
                                                          ICON_SIZE, fgRGBA);
            const snapshot = Gtk.Snapshot.new();
            const rect = new Graphene.Rect();
            const iconBounds = new Graphene.Rect();
            const center = new Graphene.Point({ x: this._markerSize / 2,
                                                y: this._markerSize / 2 });

            rect.init(0, 0, this._markerSize, this._markerSize);
            iconBounds.init((this._markerSize - ICON_SIZE) / 2,
                            (this._markerSize - ICON_SIZE) / 2,
                            ICON_SIZE, ICON_SIZE);

            this._pathBuilder.add_circle(center, this._markerSize / 2);
            snapshot.append_fill(this._pathBuilder.to_path(),
                                 Gsk.FILL_RULE_EVEN_ODD,
                                 bgRGBA);

            if (hasOutline) {
                this._pathBuilder.add_circle(center, this._markerSize / 2 -
                                                     OUTLINE_WIDTH / 2);
                snapshot.append_stroke(this._pathBuilder.to_path(),
                                       new Gsk.Stroke(OUTLINE_WIDTH),
                                       fgRGBA);
            }

            snapshot.append_texture(paintable, iconBounds);

            const node = snapshot.to_node();
            const renderer = this._mapView.get_native().get_renderer();

            return renderer.render_texture(node, rect);
        } catch (e) {
            Utils.debug('Failed to load image: %s'.format(e.message));
            return null;
        }
    }
}

GObject.registerClass(CircleIconMarker);
