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

const Lang = imports.lang;

const PrintLayout = imports.printLayout;

const _NUM_MINIMAPS = 5;

/* All following constants are ratios of surface size to page size */
const _Instruction = {
    SCALE_X: 0.57,
    SCALE_Y: 0.05,
    SCALE_MARGIN: 0.01
};
const _MiniMapView = {
    SCALE_X: 0.4,
    SCALE_Y: 0.20,
    SCALE_MARGIN: 0.03,
    ZOOM_LEVEL: 18
};

const LongPrintLayout = new Lang.Class({
    Name: 'LongPrintLayout',
    Extends: PrintLayout.PrintLayout,

    _init: function(params) {
        this._route = params.route;
        delete params.route;

        /* (Header + 3 maps) + instructions */
        let totalSurfaces = 4 + this._route.turnPoints.length;
        params.totalSurfaces = totalSurfaces;

        this.parent(params);
    },

    render: function() {
        this.parent();

        let instructionWidth = _Instruction.SCALE_X * this._pageWidth;
        let instructionHeight = _Instruction.SCALE_Y * this._pageHeight;
        let instructionMargin = _Instruction.SCALE_MARGIN * this._pageHeight;

        let miniMapViewWidth = _MiniMapView.SCALE_X * this._pageWidth;
        let miniMapViewHeight = _MiniMapView.SCALE_Y * this._pageHeight;
        let miniMapViewMargin = _MiniMapView.SCALE_MARGIN * this._pageHeight;
        let miniMapViewZoomLevel = _MiniMapView.ZOOM_LEVEL;

        let dy = 0;
        let turnPointsLength = this._route.turnPoints.length;

        /* Fixed number of locations are plotted on minimaps which requires a
         * check on instructions bound. Later on this can be made dynamic
         * depending upon factors like total number of instructions, complexity
         * of neighbourhood areas, etc.
         */
        let nthStartTurnPoints = Math.min(_NUM_MINIMAPS, turnPointsLength);
        let startTurnPoints = this._createTurnPointArray(0, nthStartTurnPoints);
        this._drawMapView(miniMapViewWidth, miniMapViewHeight,
                          miniMapViewZoomLevel, startTurnPoints);

        /* x-cursor is increased temporarily for rendering instructions */
        let tmpX = this._cursorX;
        this._route.turnPoints.forEach(function(turnPoint) {
            dy = instructionHeight + instructionMargin;
            this._adjustPage(dy);
            this._cursorX = tmpX + miniMapViewWidth + miniMapViewMargin;
            this._drawInstruction(instructionWidth, instructionHeight,
                                  turnPoint);
            this._cursorY += dy;
        }.bind(this));
        this._cursorX = tmpX;

        let firstEndTurnPoint = Math.max(0, turnPointsLength - _NUM_MINIMAPS);
        let endTurnPoints = this._createTurnPointArray(firstEndTurnPoint,
                                                     turnPointsLength);
        this._cursorY = Math.max(0, this._cursorY - miniMapViewHeight);
        this._drawMapView(miniMapViewWidth, miniMapViewHeight,
                          miniMapViewZoomLevel, endTurnPoints);
    }
});
