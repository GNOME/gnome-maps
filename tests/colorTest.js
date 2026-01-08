/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2020 Marcus Lundblad
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

const JsUnit = imports.jsUnit;

import Gdk from 'gi://Gdk?version=4.0';

import * as Color from '../src/color.js';

function parseHex(hexColor) {
    const color = new Gdk.RGBA();

    color.parse(`#${hexColor}`);

    return color;
}

function relativeLuminanceTest() {
    JsUnit.assertEquals(0.0, Color.relativeLuminance(parseHex('000000')));
    JsUnit.assertEquals(1.0, Color.relativeLuminance(parseHex('ffffff')));
    JsUnit.assertEquals(0.2126, Color.relativeLuminance(parseHex('ff0000')));
    JsUnit.assertEquals(0.7152, Color.relativeLuminance(parseHex('00ff00')));
    JsUnit.assertEquals(0.0722, Color.relativeLuminance(parseHex('0000ff')));
    JsUnit.assertEquals(0.5855256725486612,
                        Color.relativeLuminance(parseHex('abcdef')));
}

function contrastRatioTest() {
    JsUnit.assertEquals(21.0, Color.contrastRatio(parseHex('000000'),
                                                  parseHex('ffffff')));
    JsUnit.assertEquals(21.0, Color.contrastRatio(parseHex('ffffff'),
                                                  parseHex('000000')));
    JsUnit.assertEquals(1.0, Color.contrastRatio(parseHex('ffffff'),
                                                 parseHex('ffffff')));
    JsUnit.assertEquals(1.0, Color.contrastRatio(parseHex('000000'),
                                                 parseHex('000000')));
}

function getContrastingForegroundColorTest() {
    JsUnit.assertTrue(parseHex('000000').equal(
                      Color.getContrastingForegroundColor(parseHex('ffffff'))));
    JsUnit.assertTrue(parseHex('ffffff').equal(
                      Color.getContrastingForegroundColor(parseHex('000000'))));
    JsUnit.assertTrue(parseHex('ffffff').equal(
                      Color.getContrastingForegroundColor(parseHex('000088'),
                                                          parseHex('000000'))));
    JsUnit.assertTrue(parseHex('dddddd').equal(
                      Color.getContrastingForegroundColor(parseHex('000088'),
                                                          parseHex('dddddd'))));
}

relativeLuminanceTest();
contrastRatioTest();
getContrastingForegroundColorTest();
