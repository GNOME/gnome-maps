/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2023 James Westman
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
 * Author: James Westman <james@jwestman.net>
 */

import Shumate from "gi://Shumate";

const JsUnit = imports.jsUnit;

import { decode, encode } from "../src/epaf.js";

const TOLERANCE = 0.000001;

const TEST_CASES = [
    // From the Google Maps documentation at <https://developers.google.com/maps/documentation/utilities/polylinealgorithm>
    [
        "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
        [
            [38.5, -120.2],
            [40.7, -120.95],
            [43.252, -126.453],
        ],
    ],
    // Empty polyline
    ["", []],
    // Zeros
    ["??", [[0, 0]]],
];

encodeTest();
decodeTest();

function encodeTest() {
    for (const [expected, points] of TEST_CASES) {
        const encoded = encode(
            points.map(
                ([lat, lon]) =>
                    new Shumate.Coordinate({
                        latitude: lat,
                        longitude: lon,
                    })
            )
        );
        JsUnit.assertEquals(expected, encoded);
    }
}

function decodeTest() {
    for (const [encoded, expected] of TEST_CASES) {
        const decoded = decode(encoded).map((c) => [c.latitude, c.longitude]);
        for (let i = 0; i < expected.length; i++) {
            const [expectedLat, expectedLon] = expected[i];
            const [decodedLat, decodedLon] = decoded[i];
            JsUnit.assertTrue(Math.abs(expectedLat - decodedLat) < TOLERANCE);
            JsUnit.assertTrue(Math.abs(expectedLon - decodedLon) < TOLERANCE);
        }
    }
}
