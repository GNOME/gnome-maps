/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2026 Peter Bittner
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
 * Author: Peter Bittner <peter@painless.software>
 */

const JsUnit = imports.jsUnit;

import { generateMapStyle } from "../src/mapStyle/mapStyle.js";

pkg.initGettext();

const lightStyle = generateMapStyle({ colorScheme: 'light' });
const darkStyle = generateMapStyle({ colorScheme: 'dark' });

function backgroundColor(style) {
    const layer = style.layers.find((layer) => layer.id === 'background');

    JsUnit.assertNotUndefined(layer);

    return layer.paint['background-color'];
}

/* the color scheme is reflected in the style name */
JsUnit.assertEquals('GNOME Maps Light', lightStyle.name);
JsUnit.assertEquals('GNOME Maps Dark', darkStyle.name);

/* the map is actually rendered in different colors, and not accidentally
 * generated with the light colors for both schemes
 */
JsUnit.assertTrue(backgroundColor(lightStyle) !== backgroundColor(darkStyle));
JsUnit.assertTrue(JSON.stringify(lightStyle) !== JSON.stringify(darkStyle));

/* both schemes produce a usable style, with the same set of layers */
JsUnit.assertTrue(lightStyle.layers.length > 0);
JsUnit.assertEquals(lightStyle.layers.length, darkStyle.layers.length);

/* an unspecified color scheme falls back to light, as MapStyleConfig does */
JsUnit.assertEquals(lightStyle.name, generateMapStyle({}).name);
