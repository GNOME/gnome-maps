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
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import Gsk from 'gi://Gsk';
import Gtk from 'gi://Gtk';
import Pango from 'gi://Pango';

import * as Color from './color.js';
import * as TransitPlan from './transitPlan.js';

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

const MARGIN = 3;
const CORNER_RADIUS = 3;
const OUTLINE_WIDTH = 1;

const MAX_WIDTH = 256;
const MAX_WIDTH_COMPACT = 64;

const FONT_SIZE = 13;

export class TransitRouteLabel extends Gtk.Widget {

    constructor({leg, compact, ...params}) {
        super(params);

        this._leg = leg;
        this._compact = compact;
        this._styleManager = Adw.StyleManager.get_default();
        this._settings = this.get_settings();
        this._createLayout();
        this._pathBuilder = new Gsk.PathBuilder();

        const [textWidth, textHeight] = this._layout.get_pixel_size();

        // make the label at least as wide the height
        this.set_size_request(Math.max(textWidth, textHeight) + 2 * MARGIN,
                              textHeight + 2 * MARGIN);
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

    _createLayout() {
        const fontDescription = Pango.FontDescription.from_string('sans');
        const label = this._compact && this._leg.route.length > 6 ?
                      this._leg.compactRoute : this._leg.route;

        fontDescription.set_absolute_size(FONT_SIZE * Pango.SCALE);
        fontDescription.set_weight(Pango.Weight.MEDIUM);

        this._layout = Pango.Layout.new(this.get_pango_context());
        this._layout.set_text(label, -1);
        this._layout.set_width(Pango.units_from_double(this._compact ?
                                                       MAX_WIDTH_COMPACT :
                                                       MAX_WIDTH));
        this._layout.set_ellipsize(Pango.EllipsizeMode.END);
        this._layout.set_font_description(fontDescription);
        this._layout.set_auto_dir(false);
    }

    vfunc_snapshot(snapshot) {
        const width = this.get_width();
        const height = this.get_height();
        const bounds = new Graphene.Rect();

        bounds.init(0, 0, width, height);

        const usingDarkTheme = this._styleManager.dark;
        let color = this._leg.color ?? (usingDarkTheme ?
                                        TransitPlan.DEFAULT_DARK_ROUTE_COLOR :
                                        TransitPlan.DEFAULT_ROUTE_COLOR);
        let textColor =
            this._leg.textColor ?? (usingDarkTheme ?
                             TransitPlan.DEFAULT_DARK_ROUTE_TEXT_COLOR :
                             TransitPlan.DEFAULT_ROUTE_TEXT_COLOR);

        const usingHighContrastTheme =
            this._settings.gtk_theme_name === 'HighContrast' ||
            this._settings.gtk_theme_name === 'HighContrastInverse';

        textColor = Color.getContrastingForegroundColor(color, textColor);

        /* if using the high contrast theme and a label is set, fallback to
         * hight-contrasting colors, if no label, assume the route color is
         * more relevant and keep it also for high contrast
         */
        if (usingHighContrastTheme && ((this._compact && this._leg.compactRoute) ||
                                       (!this._compact && this._leg.route))) {
            color = usingDarkTheme ? HIGH_CONTRAST_TEXT_COLOR : HIGH_CONTRAST_COLOR;
            textColor = usingDarkTheme ? HIGH_CONTRAST_COLOR : HIGH_CONTRAST_TEXT_COLOR;
        }

        const hasOutline =
            (!usingDarkTheme &&
             Color.relativeLuminance(color) > OUTLINE_LUMINANCE_THREASHHOLD) ||
            (usingDarkTheme &&
             Color.relativeLuminance(color) < DARK_OUTLINE_LUMINANCE_THREASHHOLD);

        const roundRect = new Gsk.RoundedRect();

        roundRect.init_from_rect(bounds, CORNER_RADIUS);
        this._pathBuilder.add_rounded_rect(roundRect);
        snapshot.append_fill(this._pathBuilder.to_path(), Gsk.FILL_RULE_EVEN_ODD,
                             Color.parseColorAsRGBA(color));

        if (hasOutline) {
            roundRect.shrink(OUTLINE_WIDTH / 2, OUTLINE_WIDTH / 2,
                             OUTLINE_WIDTH / 2, OUTLINE_WIDTH / 2);
            this._pathBuilder.add_rounded_rect(roundRect);
            snapshot.append_stroke(this._pathBuilder.to_path(),
                                   new Gsk.Stroke(OUTLINE_WIDTH),
                                   Color.parseColorAsRGBA(textColor));
        }

        const [textWidth, textHeight] = this._layout.get_pixel_size();
        const textOrigin = new Graphene.Point({ x: (width - textWidth) / 2,
                                                y: (height - textHeight) / 2 });

        snapshot.translate(textOrigin);
        snapshot.append_layout(this._layout, Color.parseColorAsRGBA(textColor));

        super.vfunc_snapshot(snapshot);
    }
}

GObject.registerClass(TransitRouteLabel);
