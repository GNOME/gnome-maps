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

import GObject from 'gi://GObject';

import {PrintLayout} from './printLayout.js';
import {Route} from './route.js';
import {TurnPoint} from './route.js';

const _NUM_MINIMAPS = 5;

/* All following constants are ratios of surface size to page size */
const _Instruction = {
    SCALE_X: 0.57,
    SCALE_Y: 0.07,
    SCALE_MARGIN: 0.01
};
const _MiniMapView = {
    SCALE_X: 0.4,
    SCALE_Y: 0.20,
    SCALE_MARGIN: 0.03,
    ZOOM_LEVEL: 18
};

export class LongPrintLayout extends PrintLayout {

    constructor({route, ...params}) {
        /* (Header + 3 maps) + instructions */
        let totalSurfaces = 4 + route.turnPoints.length;

        /* Plus via points */
        route.turnPoints.forEach((turnPoint) => {
            if (turnPoint.type === TurnPoint.Type.VIA)
                totalSurfaces++;
        });

        super({...params, totalSurfaces});

        this._route = route;
    }

    render() {
        super.render();

        let instructionWidth = _Instruction.SCALE_X * this._pageWidth;
        let instructionHeight = _Instruction.SCALE_Y * this._pageHeight;
        let instructionMargin = _Instruction.SCALE_MARGIN * this._pageHeight;

        let miniMapViewWidth = _MiniMapView.SCALE_X * this._pageWidth;
        let miniMapViewHeight = _MiniMapView.SCALE_Y * this._pageHeight;
        let miniMapViewMargin = _MiniMapView.SCALE_MARGIN * this._pageHeight;
        let miniMapViewZoomLevel = _MiniMapView.ZOOM_LEVEL;

        let dy = 0;
        let pointsLength = this._route.turnPoints.length;

        /* Fixed number of locations are plotted on minimaps which requires a
         * check on instructions bound. Later on this can be made dynamic
         * depending upon factors like total number of instructions, complexity
         * of neighbourhood areas, etc.
         *
         * We currently have maps besides the instructions for:
         *  - the start location
         *  - via points in the route
         *  - the end location
         *
         * We include _NUM_MINIMAPS instructions per map, and have the map
         * ensure the bounding box of those instructions.
         *
         * For the start location we include _NUM_MINIMAPS number of
         * instruction, if available,  from start.
         *
         * For via points we include _NUM_MINIMAPS / 2 number of instructions
         * before and _NUM_MINIMAPS / 2 number of instructions after the
         * via point.
         *
         * For the end location we include _NUM_MINIMAPS number of instructions
         * leading up to the end location.
         *
         */
        let first = 0;
        let last = Math.min(_NUM_MINIMAPS, pointsLength);
        let points = this._createTurnPointArray(first, last);
        this._drawMapView(miniMapViewWidth, miniMapViewHeight,
                          miniMapViewZoomLevel, points);

        /* x-cursor is increased temporarily for rendering instructions */
        let tmpX = this._cursorX;
        for (let i = 0; i < this._route.turnPoints.length; i++) {
            let turnPoint = this._route.turnPoints[i];

            dy = instructionHeight + instructionMargin;
            this._adjustPage(dy);
            this._cursorX = tmpX + miniMapViewWidth + miniMapViewMargin;
            this._drawInstruction(instructionWidth, instructionHeight,
                                  turnPoint);
            this._cursorY += dy;

            if (turnPoint.type === TurnPoint.Type.VIA) {
                let tmpY = this._cursorY;

                first = Math.max(0, (i + 1) - (_NUM_MINIMAPS / 2));
                last = Math.min((i + 1) + (_NUM_MINIMAPS / 2), pointsLength);
                points = this._createTurnPointArray(Math.floor(first),
                                                    Math.floor(last));
                this._cursorX = tmpX;
                this._cursorY = Math.max(0, this._cursorY - miniMapViewHeight);
                this._drawMapView(miniMapViewWidth, miniMapViewHeight,
                                  miniMapViewZoomLevel, points);
                this._cursorY = tmpY;
            }
        }
        this._cursorX = tmpX;

        first = Math.max(0, pointsLength - _NUM_MINIMAPS);
        last = pointsLength;
        points = this._createTurnPointArray(first, last);
        this._cursorY = Math.max(0, this._cursorY - miniMapViewHeight);
        this._drawMapView(miniMapViewWidth, miniMapViewHeight,
                          miniMapViewZoomLevel, points);
    }
}

GObject.registerClass(LongPrintLayout);
