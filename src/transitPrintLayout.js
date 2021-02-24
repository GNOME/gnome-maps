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
const Champlain = imports.gi.Champlain;
const Clutter = imports.gi.Clutter;
const GObject = imports.gi.GObject;
const Pango = imports.gi.Pango;

const Color = imports.color;
const Gfx = imports.gfx;
const MapSource = imports.mapSource;
const PrintLayout = imports.printLayout;
const Transit = imports.transit;
const TransitArrivalMarker = imports.transitArrivalMarker;
const TransitBoardMarker = imports.transitBoardMarker;
const TransitWalkMarker = imports.transitWalkMarker;

// stroke color for walking paths
const _STROKE_COLOR = new Clutter.Color({ red: 0,
                                          blue: 0,
                                          green: 0,
                                          alpha: 255 });
const _STROKE_WIDTH = 5.0;

// All following constants are ratios of surface size to page size
const _Header = {
    SCALE_X: 0.9,
    SCALE_Y: 0.03,
    SCALE_MARGIN: 0.01
};
const _MapView = {
    SCALE_X: 1.0,
    SCALE_Y: 0.4,
    SCALE_MARGIN: 0.04,
    ZOOM_LEVEL: 18
};
const _Instruction = {
    SCALE_X: 0.9,
    SCALE_Y: 0.1,
    SCALE_MARGIN: 0.01
};

// luminance threashhold for drawing outline around route label badges
const OUTLINE_LUMINANCE_THREASHHOLD = 0.9;

var TransitPrintLayout = GObject.registerClass(
class TransitPrintLayout extends PrintLayout.PrintLayout {

    _init(params) {
        this._itinerary = params.itinerary;
        delete params.itinerary;

        params.totalSurfaces = this._getNumberOfSurfaces();

        super._init(params);
    }

    _getNumberOfSurfaces() {
        // always one fixed surface for the title label
        let numSurfaces = 1;

        for (let i = 0; i < this._itinerary.legs.length; i++) {
            numSurfaces++;
            // add a surface when a leg of the itinerary should have a map view
            if (this._legHasMiniMap(i))
                numSurfaces++;
        }

        // always include the arrival row
        numSurfaces++;

        return numSurfaces;
    }

    _drawMapView(width, height, zoomLevel, index) {
        let pageNum = this.numPages - 1;
        let x = this._cursorX;
        let y = this._cursorY;
        let mapSource = MapSource.createPrintSource();
        let markerLayer = new Champlain.MarkerLayer();
        let view = new Champlain.View({ width: width,
                                        height: height,
                                        zoom_level: zoomLevel });
        let leg = this._itinerary.legs[index];
        let nextLeg = this._itinerary.legs[index + 1];
        let previousLeg = index === 0 ? null : this._itinerary.legs[index - 1];

        view.set_map_source(mapSource);
        /* we want to add the path layer before the marker layer, so that
         * boarding marker are drawn about the walk dash lines
         */
        this._addRouteLayer(view, index);
        view.add_layer(markerLayer);

        markerLayer.add_marker(this._createStartMarker(leg, previousLeg));
        if (nextLeg)
            markerLayer.add_marker(this._createBoardMarker(nextLeg));
        else
            markerLayer.add_marker(this._createArrivalMarker(leg));

        /* in some cases, we seem to get get zero distance walking instructions
         * within station complexes, don't try to show a bounding box for low
         * distances, instead center on the spot
         */
        if (leg.distance < 10)
            view.center_on(leg.fromCoordinate[0], leg.fromCoordinate[1]);
        else
            view.ensure_visible(this._createBBox(leg), false);
        if (view.state !== Champlain.State.DONE) {
            let notifyId = view.connect('notify::state', () => {
                if (view.state === Champlain.State.DONE) {
                    view.disconnect(notifyId);
                    let surface = view.to_surface(true);
                    if (surface)
                        this._addSurface(surface, x, y, pageNum);
                }
            });
        } else {
            let surface = view.to_surface(true);
            if (surface)
                this._addSurface(surface, x, y, pageNum);
        }
    }

    _createBBox(leg) {
        return Champlain.BoundingBox({ top:    leg.bbox.top,
                                       left:   leg.bbox.left,
                                       bottom: leg.bbox.bottom,
                                       right:  leg.bbox.right });
    }

    _createStartMarker(leg, previousLeg) {
        return new TransitWalkMarker.TransitWalkMarker({ leg: leg,
                                                         previousLeg: previousLeg });
    }

    _createBoardMarker(leg) {
        return new TransitBoardMarker.TransitBoardMarker({ leg: leg });
    }

    _createArrivalMarker(leg) {
        return new TransitArrivalMarker.TransitArrivalMarker({ leg: leg });
    }

    _addRouteLayer(view, index) {
        let routeLayer = new Champlain.PathLayer({ stroke_width: _STROKE_WIDTH,
                                                   stroke_color: _STROKE_COLOR });
        let leg = this._itinerary.legs[index];

        routeLayer.set_dash([5, 5]);
        view.add_layer(routeLayer);

        /* if this is a walking leg and not at the start, "stitch" it
         * together with the end point of the previous leg, as the walk
         * route might not reach all the way
         */
        if (index > 0 && !leg.transit) {
            let previousLeg = this._itinerary.legs[index - 1];
            let lastPoint =
                previousLeg.polyline[previousLeg.polyline.length - 1];

            routeLayer.add_node(lastPoint);
        }

        leg.polyline.forEach((node) => routeLayer.add_node(node));

        /* like above, "stitch" the route segment with the next one if it's
         * a walking leg, and not the last one
         */
        if (index < this._itinerary.legs.length - 1 && !leg.transit) {
            let nextLeg = this._itinerary.legs[index + 1];
            let firstPoint = nextLeg.polyline[0];

            routeLayer.add_node(firstPoint);
        }
    }

    _drawInstruction(width, height, leg, start) {
        let pageNum = this.numPages - 1;
        let x = this._cursorX;
        let y = this._cursorY;
        let surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, width, height);
        let cr = new Cairo.Context(surface);
        let timeWidth = !leg.transit && start ? height : height * 2;
        let fromText = Transit.getFromLabel(leg, start);
        let routeWidth = 0;

        this._drawIcon(cr, leg.iconName, width, height);
        this._drawText(cr, fromText, this._rtl ? timeWidth : height, 0,
                       width - height - timeWidth, height / 2, Pango.Alignment.LEFT);

        if (leg.transit) {
            let color = leg.color;
            let textColor = leg.textColor;
            let hasOutline = Color.relativeLuminance(color) > OUTLINE_LUMINANCE_THREASHHOLD;
            let routeText =
                this._createTextLayout(cr, leg.route, width - height - timeWidth,
                                       height / 2,
                                       this._rtl ? Pango.Alignment.RIGHT :
                                                   Pango.Alignment.LEFT);
            let [pWidth, pHeight] = routeText.get_pixel_size();
            let routePadding = 3;
            let routeHeight = pHeight + routePadding * 2;
            routeWidth = Math.max(pWidth, pHeight) + routePadding * 2;
            let routeX = this._rtl ? width - height - routeWidth - 1 : height;
            let routeY = height / 2 + ((height / 2) - routeHeight) / 2;


            textColor = Color.getContrastingForegroundColor(color, textColor);
            Gfx.drawColoredBagde(cr, color, hasOutline ? textColor : null,
                                 routeX, routeY, routeWidth, routeHeight);
            this._drawTextLayoutWithColor(cr, routeText,
                                          routeX + routePadding +
                                          (routeWidth - pWidth -
                                           routePadding * 2) / 2,
                                          routeY + routePadding,
                                          routeWidth - routePadding * 2,
                                          routeHeight - routePadding * 2,
                                          textColor, Pango.Alignment.LEFT);

            // introduce some additional padding before the headsign label
            routeWidth += routePadding;
        }

        let headsign = Transit.getHeadsignLabel(leg);

        if (headsign) {
            let headsignLayout = this._createTextLayout(cr, headsign,
                                                        width - height - timeWidth - routeWidth,
                                                        height / 2,
                                                        Pango.Alignment.LEFT);
            let [pWidth, pHeight] = headsignLayout.get_pixel_size();
            this._drawTextLayoutWithColor(cr, headsignLayout,
                                          this._rtl ? timeWidth : height + routeWidth,
                                          height / 2 + (height / 2 - pHeight) / 2,
                                          width - height - timeWidth - routeWidth,
                                          height / 2, '888888',
                                          Pango.Alignment.LEFT);
        }
        this._drawTextVerticallyCentered(cr, leg.prettyPrintTime({ isStart: start }),
                                         timeWidth, height,
                                         this._rtl ? 0 : width - timeWidth - 1,
                                         Pango.Alignment.RIGHT);

        this._addSurface(surface, x, y, pageNum);
    }

    _drawArrival(width, height) {
        let pageNum = this.numPages - 1;
        let x = this._cursorX;
        let y = this._cursorY;
        let surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, width, height);
        let cr = new Cairo.Context(surface);
        let lastLeg = this._itinerary.legs[this._itinerary.legs.length - 1];

        this._drawIcon(cr, 'maps-point-end-symbolic', width, height);
        // draw the arrival text
        this._drawTextVerticallyCentered(cr, Transit.getArrivalLabel(lastLeg),
                                         width - height * 3,
                                         height, this._rtl ? height * 2 : height,
                                         Pango.Alignment.LEFT);
        // draw arrival time
        this._drawTextVerticallyCentered(cr, lastLeg.prettyPrintArrivalTime(),
                                         height, height,
                                         this._rtl ? 0 : width - height - 1,
                                         Pango.Alignment.RIGHT);

        this._addSurface(surface, x, y, pageNum);
    }

    _legHasMiniMap(index) {
        let leg = this._itinerary.legs[index];
        return !leg.transit;
    }

    render() {
        let headerWidth = _Header.SCALE_X * this._pageWidth;
        let headerHeight = _Header.SCALE_Y * this._pageHeight;
        let headerMargin = _Header.SCALE_MARGIN * this._pageHeight;

        let mapViewWidth = _MapView.SCALE_X * this._pageWidth;
        let mapViewHeight = _MapView.SCALE_Y * this._pageHeight;
        let mapViewMargin = _MapView.SCALE_MARGIN * this._pageHeight;
        let mapViewZoomLevel = _MapView.ZOOM_LEVEL;

        let instructionWidth = _Instruction.SCALE_X * this._pageWidth;
        let instructionHeight = _Instruction.SCALE_Y * this._pageHeight;
        let instructionMargin = _Instruction.SCALE_MARGIN * this._pageHeight;

        let dy = headerHeight + headerMargin;

        this._createNewPage();
        this._adjustPage(dy);
        this._drawHeader(headerWidth, headerHeight);
        this._cursorY += dy;

        for (let i = 0; i < this._itinerary.legs.length; i++) {
            let leg = this._itinerary.legs[i];
            let hasMap = this._legHasMiniMap(i);
            let instructionDy = instructionHeight + instructionMargin;
            let mapDy = hasMap ? mapViewHeight + mapViewMargin : 0;

            dy = instructionDy + mapDy;
            this._adjustPage(dy);
            this._drawInstruction(instructionWidth, instructionHeight, leg,
                                  i === 0);
            this._cursorY += instructionDy;

            if (hasMap) {
                let nextLeg = i < this._itinerary.legs.length - 1 ?
                              this._itinerary.legs[i + 1] : null;
                this._drawMapView(mapViewWidth, mapViewHeight, mapViewZoomLevel, i);
                this._cursorY += mapDy;
            }
        }

        this._drawArrival(instructionWidth, instructionHeight);
    }
});
