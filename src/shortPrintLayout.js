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

/* All following constants are ratios of surface size to page size */
const _Instruction = {
    SCALE_X: 1.0,
    SCALE_Y: 0.05,
    SCALE_MARGIN: 0.01
};

var ShortPrintLayout = new Lang.Class({
    Name: 'ShortPrintLayout',
    Extends: PrintLayout.PrintLayout,

    _init: function(params) {
        this._route = params.route;
        delete params.route;

        /* (Header +  map) + instructions */
        let totalSurfaces = 2 + this._route.turnPoints.length;
        params.totalSurfaces = totalSurfaces;

        this.parent(params);
    },

    render: function() {
        this.parent();

        let instructionWidth = _Instruction.SCALE_X * this._pageWidth;
        let instructionHeight = _Instruction.SCALE_Y * this._pageHeight;
        let instructionMargin = _Instruction.SCALE_MARGIN * this._pageHeight;
        let dy = 0;

        this._route.turnPoints.forEach((turnPoint) => {
            dy = instructionHeight + instructionMargin;
            this._adjustPage(dy);
            this._drawInstruction(instructionWidth, instructionHeight, turnPoint);
            this._cursorY += dy;
        });
    }
});
