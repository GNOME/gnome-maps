/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2017, Marcus Lundblad
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

import Gdk from 'gi://Gdk';

/* Minimum contrast ratio for foreground/background color for i.e. route labels */
const MIN_CONTRAST_RATIO = 2.0;

const WHITE = new Gdk.RGBA({ red: 1.0, green: 1.0, blue: 1.0, alpha: 1.0 });
const BLACK = new Gdk.RGBA({ red: 0.0, green: 0.0, blue: 0.0, alpha: 1.0 });

/**
 * Returns the relative luminance (0.0 - 1.0) of a Gdk.RGBA value according to the W3C WCAG definition:
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
export function relativeLuminance(color) {
    let rsRGB = color.red;
    let gsRGB = color.green;
    let bsRGB = color.blue;
    let r = rsRGB <= 0.03928 ?
            rsRGB / 12.92 : Math.pow(((rsRGB + 0.055) / 1.055), 2.4);
    let g = gsRGB <= 0.03928 ?
            gsRGB / 12.92 : Math.pow(((gsRGB + 0.055) / 1.055), 2.4);
    let b = bsRGB <= 0.03928 ?
            bsRGB / 12.92 : Math.pow(((bsRGB + 0.055) / 1.055), 2.4);

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Returns the contrast ratio between two colors, expressed in HTML notation
 * (i.e. ffffff for white) according to the W3C WCAG definition:
 * https://www.w3.org/WAI/GL/wiki/Contrast_ratio
 */
export function contrastRatio(color1, color2) {
    let lc1 = relativeLuminance(color1);
    let lc2 = relativeLuminance(color2);
    /* order by luminance, lighter before darker */
    let l1 = Math.max(lc1, lc2);
    let l2 = Math.min(lc1, lc2);

    return (l1 + 0.05) / (l2 + 0.05);
}

/**
 * Finds a suitable foreground (text) color for a given background color.
 * If the desiredForegroundColor argument is defined, return this color if it
 * has enough contrast against the background, otherwise (or if that argument
 * is undefined), return the one of black or white giving the highest contrast
 */
export function getContrastingForegroundColor(backgroundColor,
                                       desiredForegroundColor) {
    if (!desiredForegroundColor ||
        (contrastRatio(backgroundColor, desiredForegroundColor) <
         MIN_CONTRAST_RATIO)) {
        let contrastAgainstWhite = contrastRatio(backgroundColor, WHITE);
        let contrastAgainstBlack = contrastRatio(backgroundColor, BLACK);

        if (contrastAgainstWhite > contrastAgainstBlack)
            return WHITE;
        else
            return BLACK;
    } else {
        return desiredForegroundColor;
    }
}
