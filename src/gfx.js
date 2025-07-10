/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2019, Marcus Lundblad.
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

import * as Color from './color.js';

/**
 * Draws a colored badged with rounded corners and an optional outline.
 *
 * cr: A Cairo context to draw into
 * bgColor: The fill color to draw the background with, represented as
 *          a string with 8-bit HEX-encoded RGB values
 * outlineColor: The color to use for the outline, or null if no outline
 * x: pixel offset for x-coord of top-left corner of bounding box
 * y: pixel offset for y-coord of top-left corner of bounding box
 * width: The width to draw the badge
 * height: The height to draw the badge
 */
export function drawColoredBagde(cr, bgColor, outlineColor, x, y, width, height) {
    let bgRed = Color.parseColor(bgColor, 0);
    let bgGreen = Color.parseColor(bgColor, 1);
    let bgBlue = Color.parseColor(bgColor, 2);
    let radius = outlineColor ? 5 : 3;

    cr.newSubPath();
    cr.arc(width - radius + x, radius + y, radius, -Math.PI / 2, 0);
    cr.arc(width - radius + x, height - radius + y, radius, 0 , Math.PI / 2);
    cr.arc(radius + x, height - radius + y, radius, Math.PI / 2, Math.PI);
    cr.arc(radius + x, radius + y, radius, Math.PI, 3 * Math.PI / 2);
    cr.closePath();

    cr.setSourceRGB(bgRed, bgGreen, bgBlue);
    cr.fillPreserve();

    if (outlineColor) {
        let outlineRed = Color.parseColor(outlineColor, 0);
        let outlineGreen = Color.parseColor(outlineColor, 1);
        let outlineBlue = Color.parseColor(outlineColor, 2);

        cr.setSourceRGB(outlineRed, outlineGreen, outlineBlue);
        cr.setLineWidth(1);
        cr.stroke();
    }
}

/**
 * Render highway shields to an array of Gdk.Paintables for a place.
 *
 * place: A Place instance
 * maxNumShields: Maximum number of shields to render
 * scaleFactor: Scale factor to render the shields at
 */
export function drawShieldsForPlace(place, maxNumShields, scaleFactor) {
    const routes = place.routes;
    let numProcessed = 0;

    return routes.map(r => {
                        if (numProcessed >= maxNumShields)
                            return null;

                        const paintable = r.shield.draw(r.ref ?? '',
                                                        r.name ?? '',
                                                        '',
                                                        scaleFactor);

                        if (paintable) {
                            numProcessed++;

                            return paintable;
                        } else {
                            return null;
                        }
                      })
                 .filter(p => !!p);
}
