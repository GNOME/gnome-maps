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

import * as Color from '../src/color.js';

function parseColorTest() {
    JsUnit.assertEquals(1.0, Color.parseColor('ff0000', 0));
    JsUnit.assertEquals(1.0, Color.parseColor('00ff00', 1));
    JsUnit.assertEquals(1.0, Color.parseColor('0000ff', 2));
    JsUnit.assertEquals(0.0, Color.parseColor('000000', 0));
    JsUnit.assertEquals(0.0, Color.parseColor('000000', 1));
    JsUnit.assertEquals(0.0, Color.parseColor('000000', 2));
    JsUnit.assertEquals(1.0/3.0, Color.parseColor('550000', 0));
    JsUnit.assertEquals(1.0, Color.parseColor(undefined, 0, 1.0));
    JsUnit.assertEquals(1.0, Color.parseColor(null, 0, 1.0));
    JsUnit.assertEquals(1.0, Color.parseColor('', 0, 1.0));
}

function relativeLuminanceTest() {
    JsUnit.assertEquals(0.0, Color.relativeLuminance('000000'));
    JsUnit.assertEquals(1.0, Color.relativeLuminance('ffffff'));
    JsUnit.assertEquals(0.2126, Color.relativeLuminance('ff0000'));
    JsUnit.assertEquals(0.7152, Color.relativeLuminance('00ff00'));
    JsUnit.assertEquals(0.0722, Color.relativeLuminance('0000ff'));
    JsUnit.assertEquals(0.5855256521034803, Color.relativeLuminance('abcdef'));
}

function contrastRatioTest() {
    JsUnit.assertEquals(21.0, Color.contrastRatio('000000', 'ffffff'));
    JsUnit.assertEquals(21.0, Color.contrastRatio('ffffff', '000000'));
    JsUnit.assertEquals(1.0, Color.contrastRatio('ffffff', 'ffffff'));
    JsUnit.assertEquals(1.0, Color.contrastRatio('000000', '000000'));
}

function getContrastingForegroundColorTest() {
    JsUnit.assertEquals('000000',
                        Color.getContrastingForegroundColor('ffffff'));
    JsUnit.assertEquals('ffffff',
                        Color.getContrastingForegroundColor('000000'));
    JsUnit.assertEquals('ffffff',
                        Color.getContrastingForegroundColor('000088', '000000'));
    JsUnit.assertEquals('dddddd',
                        Color.getContrastingForegroundColor('000088', 'dddddd'));
}

parseColorTest();
relativeLuminanceTest();
contrastRatioTest();
getContrastingForegroundColorTest();
