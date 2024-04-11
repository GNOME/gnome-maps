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

import Cairo from 'cairo';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';

import * as Color from './color.js';
import * as Gfx from './gfx.js';
import * as MapSource from './mapSource.js';
import {PrintLayout} from './printLayout.js';
import * as Transit from './transit.js';
import {TransitArrivalMarker} from './transitArrivalMarker.js';
import {TransitBoardMarker} from './transitBoardMarker.js';
import * as TransitPlan from './transitPlan.js';
import {TransitWalkMarker} from './transitWalkMarker.js';

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

const _ICON_SIZE = 24;

// luminance threashhold for drawing outline around route label badges
const OUTLINE_LUMINANCE_THREASHHOLD = 0.9;

export class TransitPrintLayout extends PrintLayout {

    constructor({itinerary, ...params}) {
        super({
            ...params,
            totalSurfaces: TransitPrintLayout._getNumberOfSurfaces(itinerary),
        });

        this._itinerary = itinerary;
    }

    static _getNumberOfSurfaces(itinerary) {
        // always one fixed surface for the title label
        let numSurfaces = 1;

        for (let leg of itinerary.legs) {
            numSurfaces++;
            // add a surface when a leg of the itinerary should have a map view
            // TODO: skip this now, as we don't have minimaps now..
            /*
            if (TransitPrintLayout._legHasMiniMap(leg))
                numSurfaces++;
            */
        }

        // always include the arrival row
        numSurfaces++;

        return numSurfaces;
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

        this._drawIcon(cr, leg.iconName, width, height, _ICON_SIZE);
        this._drawText(cr, fromText, this._rtl ? timeWidth : height, 0,
                       width - height - timeWidth, height / 2, Pango.Alignment.LEFT);

        if (leg.transit) {
            let color = leg.color ?? TransitPlan.DEFAULT_ROUTE_COLOR;
            let textColor = leg.textColor ?? TransitPlan.DEFAULT_ROUTE_TEXT_COLOR;
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

        this._drawIcon(cr, 'maps-point-end-symbolic', width, height, _ICON_SIZE);
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

    static _legHasMiniMap(leg) {
        return !leg.transit;
    }

    render() {
        let headerWidth = _Header.SCALE_X * this._pageWidth;
        let headerHeight = _Header.SCALE_Y * this._pageHeight;
        let headerMargin = _Header.SCALE_MARGIN * this._pageHeight;

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
            let instructionDy = instructionHeight + instructionMargin;

            dy = instructionDy;
            this._adjustPage(dy);
            this._drawInstruction(instructionWidth, instructionHeight, leg,
                                  i === 0);
            this._cursorY += instructionDy;
        }

        this._drawArrival(instructionWidth, instructionHeight);
    }
}

GObject.registerClass(TransitPrintLayout);
