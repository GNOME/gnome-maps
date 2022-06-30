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
import * as MapSource from './mapSource.js';
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

    constructor(params) {
        let pageWidth = params.pageWidth;
        delete params.pageWidth;

        let pageHeight = params.pageHeight;
        delete params.pageHeight;

        let totalSurfaces = params.totalSurfaces;
        delete params.totalSurfaces;

        let mainWindow = params.mainWindow;
        delete params.mainWindow;

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

        // TODO: for now for now skip drawing the mini map
        /*
        dy = mapViewHeight + mapViewMargin;
        this._adjustPage(dy);
        let turnPointsLength = this._route.turnPoints.length;
        let allTurnPoints = this._createTurnPointArray(0, turnPointsLength);
        this._drawMapView(mapViewWidth, mapViewHeight, allTurnPoints);
        this._cursorY += dy;
        */
    }

    _initSignals() {
        this.connect('render-complete', () => this.renderFinished = true);
    }

    _createMarker(turnPoint) {
        return new TurnPointMarker({ turnPoint: turnPoint, queryPoint: {} });
    }

    _getZoomLevelFittingBBox(bbox, mapSource, width, height) {
        let goodSize = false;
        let zoomLevel = mapSource.max_zoom_level;

        do {

            let minX = mapSource.get_x(zoomLevel, bbox.left);
            let minY = mapSource.get_y(zoomLevel, bbox.bottom);
            let maxX = mapSource.get_x(zoomLevel, bbox.right);
            let maxY = mapSource.get_y(zoomLevel, bbox.top);

            if (minY - maxY <= height && maxX - minX <= width)
                goodSize = true;
            else
                zoomLevel--;

            if (zoomLevel <= mapSource.min_zoom_level) {
                zoomLevel = mapSource.min_zoom_level;
                goodSize = true;
            }
        } while (!goodSize);

        return zoomLevel;
    }

    _drawMapView(width, height, turnPoints) {
        let pageNum = this.numPages - 1;
        let x = this._cursorX;
        let y = this._cursorY;
        let mapSource = MapSource.createPrintSource();
        let locations = [];
        let markerLayer = new Shumate.MarkerLayer();

        turnPoints.forEach((turnPoint) => {
            locations.push(turnPoint.coordinate);
            if (turnPoint.isStop()) {
                markerLayer.add_marker(this._createMarker(turnPoint));
            }
        });

        let bbox = this._createBBox(locations);
        let zoomLevel =
            this._getZoomLevelFittingBBox(bbox, mapSource, width, height);

        let map = new Shumate.Map();
        let mapLayer = new Shumate.MapLayer({ map_source: mapSource,
                                              viewport:   map.viewport });

        map.viewport.zoom_level = zoomLevel;
        map.add_layer(mapLayer);

        let routeLayer = this._addRouteLayer(map, mapLayer);

        map.insert_layer_above(markerLayer, routeLayer);
        map.viewport.set_reference_map_source(mapSource);
        map.set_size_request(width, height);

        // TODO: how do we know when it's loaded?
        let surface = this._mapToSurface(map, width, height);
        if (surface)
            this._addSurface(surface, x, y, pageNum);
    }

    // TODO: this does not quite work...
    _mapToSurface(map, width, height) {
        let surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, width, height);
        let cr = new Cairo.Context(surface);
        let paintable = new Gtk.WidgetPaintable({ widget: map });
        let rect = new Graphene.Rect();

        rect.init(0, 0, width, height);

        let snapshot = Gtk.Snapshot.new();

        paintable.snapshot(snapshot, width, height);

        let node = snapshot.to_node();
        let renderer = this._mainWindow.get_native().get_renderer();
        let texture = renderer.render_texture(node, rect);
        let pixbuf = Gdk.pixbuf_get_from_texture(texture);

        Gdk.cairo_set_source_pixbuf(cr, pixbuf, 0, 0);
        cr.paint();

        return surface;
    }

    _createBBox(locations) {
        let bbox = this._route.createBBox(locations);

        return new BoundingBox({ top:    bbox.top,
                                 left:   bbox.left,
                                 bottom: bbox.bottom,
                                 right:  bbox.right });
    }

    _createTurnPointArray(startIndex, endIndex) {
        let turnPointArray = [];
        for (let i = startIndex; i < endIndex; i++) {
            turnPointArray.push(this._route.turnPoints[i]);
        }
        return turnPointArray;
    }

    _addRouteLayer(map, mapLayer) {
        let routeLayer = new Shumate.PathLayer({ stroke_width: _STROKE_WIDTH,
                                                 stroke_color: _STROKE_COLOR });
        map.insert_layer_above(routeLayer, mapLayer);
        this._route.path.forEach((node) => routeLayer.add_node(node));

        return routeLayer;
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
        let name;
        let place = query.filledPoints[index].place;
        if (place.name) {
            name = place.name;
            if (name.length > 25)
                name = name.substr(0, 22) + '\u2026';
        } else {
            let lat = place.location.latitude.toFixed(5);
            let lon = place.location.latitude.toFixed(5);
            name = '%s, %s'.format(lat, lon);
        }

        return name;
    }
}

GObject.registerClass({
    Abstract: true,
    Signals: {
        'render-complete': { }
    }
}, PrintLayout);
