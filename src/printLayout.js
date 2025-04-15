/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
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
 * Author: Amisha Singla <amishas157@gmail.com>
 */

import Cairo from 'cairo';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import Gtk from 'gi://Gtk';
import Pango from 'gi://Pango';
import PangoCairo from 'gi://PangoCairo';
import Shumate from 'gi://Shumate';

import {Application} from './application.js';
import {BoundingBox} from './boundingBox.js';
import * as Color from './color.js';
import {MapView} from './mapView.js';
import {TurnPointMarker} from './turnPointMarker.js';
import * as Utils from './utils.js';

const _STROKE_COLOR = new Gdk.RGBA({ red: 0,
                                     blue: 255,
                                     green: 0,
                                     alpha: 1.0 });
const _STROKE_WIDTH = 5.0;

const _ICON_COLOR = new Gdk.RGBA({ red: 0, green: 0, blue: 0, alpha: 1.0 });
const _ICON_SIZE = 24;

/* All following constants are ratios of surface size to page size */
const _Header = {
    SCALE_X: 0.9,
    SCALE_Y: 0.03,
    SCALE_MARGIN: 0.01
};
const _MapView = {
    SCALE_X: 1.0,
    SCALE_Y: 0.4,
    SCALE_MARGIN: 0.04
};

export class PrintLayout extends GObject.Object {

    constructor({pageWidth, pageHeight, totalSurfaces, mainWindow, ...params}) {
        super(params);

        this._pageWidth = pageWidth;
        this._pageHeight = pageHeight;
        this._totalSurfaces = totalSurfaces;
        this._mainWindow = mainWindow;
        this.numPages = 0;
        this.surfaceObjects = [];
        this._surfacesRendered = 0;
        this.renderFinished = false;
        this._initSignals();

        this._rtl = Gtk.get_locale_direction() === Gtk.TextDirection.RTL;
        // directional override character to force alignment of labels
        this._dirChar = this._rtl ? '\u200F' : '\u200E';
        this._fontDescription = Pango.FontDescription.from_string("sans");
    }

    render() {
        let headerWidth = _Header.SCALE_X * this._pageWidth;
        let headerHeight = _Header.SCALE_Y * this._pageHeight;
        let headerMargin = _Header.SCALE_MARGIN * this._pageHeight;

        let mapViewWidth = _MapView.SCALE_X * this._pageWidth;
        let mapViewHeight = _MapView.SCALE_Y * this._pageHeight;
        let mapViewMargin = _MapView.SCALE_MARGIN * this._pageHeight

        this._createNewPage();
        let dy = 0;

        /*
         * Before rendering each surface, page adjustment is done. It is checked if it
         * can be adjusted in current page, otherwise a new page is created
         */
        dy = headerHeight + headerMargin;
        this._adjustPage(dy);
        this._drawHeader(headerWidth, headerHeight);
        this._cursorY += dy;
    }

    _initSignals() {
        this.connect('render-complete', () => this.renderFinished = true);
    }

    _drawIcon(cr, iconName, width, height, size) {
        let display = Gdk.Display.get_default();
        let theme = Gtk.IconTheme.get_for_display(display);
        let iconPaintable = theme.lookup_icon(iconName, null, size, 1,
                                          Gtk.TextDirection.NONE, 0);
        let snapshot = Gtk.Snapshot.new();
        let rect = new Graphene.Rect();

        iconPaintable.snapshot_symbolic(snapshot, size, size, [_ICON_COLOR]);
        rect.init(0, 0, size, size);

        let node = snapshot.to_node();
        let renderer = this._mainWindow.get_native().get_renderer();

        let paintable = renderer.render_texture(node, rect);
        let pixbuf = Gdk.pixbuf_get_from_texture(paintable)

        Gdk.cairo_set_source_pixbuf(cr, pixbuf,
                                    this._rtl ?
                                    width - height + (height - size) / 2 :
                                    (height - size) / 2,
                                    (height - size) / 2);
        cr.paint();
    }

    _createTextLayout(cr, text, width, height, alignment) {
        let layout = PangoCairo.create_layout(cr);

        layout.set_text(this._dirChar + text, -1);
        layout.set_height(Pango.units_from_double(height));
        layout.set_width(Pango.units_from_double(width));
        layout.set_font_description(this._fontDescription);
        layout.set_alignment(alignment);
        layout.set_ellipsize(Pango.EllipsizeMode.END);

        return layout;
    }

    _drawText(cr, text, x, y, width, height, alignment) {
        this._drawTextWithColor(cr, text, x, y, width, height, '000000', alignment);
    }

    _drawTextWithColor(cr, text, x, y, width, height, color, alignment) {
        let layout = this._createTextLayout(cr, text, width, height, alignment);

        this._drawTextLayoutWithColor(cr, layout, x, y, width, height, color,
                                      alignment);
    }

    _drawTextLayoutWithColor(cr, layout, x, y, width, height, color, alignment) {
        let red = Color.parseColor(color, 0);
        let green = Color.parseColor(color, 1);
        let blue = Color.parseColor(color, 2);

        cr.moveTo(x, y);
        cr.setSourceRGB(red, green, blue);
        PangoCairo.show_layout(cr, layout);
    }

    _drawTextVerticallyCentered(cr, text, width, height, x, alignment) {
        this._drawTextVerticallyCenteredWithColor(cr, text, width, height, x,
                                                  '000000', alignment);
    }

    _drawTextVerticallyCenteredWithColor(cr, text, width, height, x, color,
                                         alignment) {
        let layout = this._createTextLayout(cr, text, width, height, alignment);
        let [pWidth, pHeight] = layout.get_pixel_size();
        let red = Color.parseColor(color, 0);
        let green = Color.parseColor(color, 1);
        let blue = Color.parseColor(color, 2);

        // place text centered
        cr.moveTo(x, (height - pHeight) / 2);
        cr.setSourceRGB(red, green, blue);
        PangoCairo.show_layout(cr, layout);
    }

    _drawInstruction(width, height, turnPoint) {
        let pageNum = this.numPages - 1;
        let x = this._cursorX;
        let y = this._cursorY;
        let surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, width, height);
        let cr = new Cairo.Context(surface);
        let iconName = turnPoint.iconName;

        if (iconName) {
            this._drawIcon(cr, iconName, width, height, _ICON_SIZE);
        }

        // draw the instruction text
        this._drawTextVerticallyCentered(cr, turnPoint.instruction,
                                         width - height * 3, height,
                                         this._rtl ? height * 2 : height,
                                         Pango.Alignment.LEFT);

        // draw the distance text
        if (turnPoint.distance > 0) {
            this._drawTextVerticallyCentered(cr,
                                             Utils.prettyDistance(turnPoint.distance),
                                             height * 2,
                                             height,
                                             this._rtl ? 0 : width - height * 2,
                                             Pango.Alignment.RIGHT);
        }

        this._addSurface(surface, x, y, pageNum);
    }

    _drawHeader(width, height) {
        let pageNum = this.numPages - 1;
        let x = this._cursorX;
        let y = this._cursorY;
        let surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, width, height);
        let cr = new Cairo.Context(surface);
        let layout = PangoCairo.create_layout(cr);
        let from = this._formatQueryPlaceName(0);
        let to = this._formatQueryPlaceName(-1);
        let header = _("From %s to %s").format(from, to);
        let desc = Pango.FontDescription.from_string("sans");

        layout.set_text(header, -1);
        layout.set_height(Pango.units_from_double(height));
        layout.set_width(Pango.units_from_double(width));
        layout.set_font_description(desc);
        layout.set_alignment(Pango.Alignment.CENTER);
        PangoCairo.layout_path(cr, layout);
        cr.setSourceRGB(0.0,0.0,0.0);
        cr.fill();

        this._addSurface(surface, x, y, pageNum);
    }

    _addSurface(surface, x, y, pageNum) {
        this.surfaceObjects[pageNum].push({ surface: surface, x: x, y: y });
        this._surfacesRendered++;
        if (this._surfacesRendered === this._totalSurfaces)
            this.emit('render-complete');
    }

    _adjustPage(dy) {
        if (this._cursorY + dy > this._pageHeight)
            this._createNewPage();
    }

    _createNewPage() {
        this.numPages++;
        this.surfaceObjects[this.numPages - 1] = [];
        this._cursorX = 0;
        this._cursorY = 0;
    }

    _formatQueryPlaceName(index) {
        let query = Application.routeQuery;
        if (index === -1)
            index = query.filledPoints.length - 1;
        let place = query.filledPoints[index].place;

        return place.name.length > 25 ? place.name.substr(0, 22) + '\u2026' :
                                        place.name;
    }
}

GObject.registerClass({
    Abstract: true,
    Signals: {
        'render-complete': { }
    }
}, PrintLayout);
