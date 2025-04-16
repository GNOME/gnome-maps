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

import 'gi://Gdk?version=4.0';
import 'gi://Gtk?version=4.0';
import 'gi://Soup?version=3.0';

const JsUnit = imports.jsUnit;

import * as URIS from '../src/uris.js';

const OSM_COORD_URL1 =
    'https://www.openstreetmap.org/?lat=39.9882&lon=-78.2409&zoom=14&layers=B000FTF';

function parseAsObjectURLTest() {
    _assertArrayEquals([], URIS.parseAsObjectURL('https://www.example.com'));
    _assertArrayEquals([], URIS.parseAsObjectURL('https://www.openstreet.org/'));
    _assertArrayEquals(['node', 1],
                       URIS.parseAsObjectURL('https://www.openstreetmap.org/node/1'));
    _assertArrayEquals(['way', 2],
                       URIS.parseAsObjectURL('https://www.openstreetmap.org/way/2'));
    _assertArrayEquals(['relation', 3],
                       URIS.parseAsObjectURL('https://www.openstreetmap.org/relation/3'));
    _assertArrayEquals([],
                       URIS.parseAsObjectURL('https://www.openstreetmap.org/foo/1'));
    _assertArrayEquals(['node', 4],
                       URIS.parseAsObjectURL('https://openstreetmap.org/node/4'));
    _assertArrayEquals(['node', 5],
                       URIS.parseAsObjectURL('http://www.openstreetmap.org/node/5'));
    _assertArrayEquals(['node', 6],
                       URIS.parseAsObjectURL('http://www.openstreetmap.org/node/6/'));
}

function parseAsCoordinateURLTest() {
    _assertArrayEquals([],
                       URIS.parseAsCoordinateURL('https://www.example.com'));
    _assertArrayEquals([],
                       URIS.parseAsCoordinateURL('https://www.openstreet.org/'));
    _assertArrayEquals([39.9882, -78.2409, 14],
                       URIS.parseAsCoordinateURL('https://www.openstreetmap.org/?lat=39.9882&lon=-78.2409&zoom=14&layers=B000FTF'));
    _assertArrayEquals([59.40538, 17.34894, 12],
                       URIS.parseAsCoordinateURL('https://www.openstreetmap.org/?#map=12/59.40538/17.34894'));
    _assertArrayEquals([59.3083, 18.0183, 16],
                       URIS.parseAsCoordinateURL('https://www.openstreetmap.org/#map=16/59.3083/18.0183'));
}

function parseAsGeoURITest() {
    _assertArrayEquals(['geo:37.88181,-122.18740'],
                       URIS.parseAsGeoURI('geo://37.88181,-122.18740'));
    _assertArrayEquals(['geo:37.88181,-122.18740'],
                       URIS.parseAsGeoURI('geo://37.88181,-122.18740'));
    _assertArrayEquals(['geo:37.88181,-122.18740', 18],
                       URIS.parseAsGeoURI('geo:37.88181,-122.18740?z=18'));
    _assertArrayEquals(['geo:0,0'],
                       URIS.parseAsGeoURI('geo:0,0?q=Query'));
    JsUnit.assertRaises('Propagates errors for malformed URIs',
                        () => URIS.parseAsGeoURI('not_a_valid_uri'));
}

function getUriParamTest() {
    JsUnit.assertEquals('Query', URIS.getUriParam('geo:0,0?q=Query', 'q'));
    JsUnit.assertNull(URIS.getUriParam('geo:12.3456,78.90', 'q'));
    JsUnit.assertEquals('', URIS.getUriParam('geo:12.3456,78.90?q=', 'q'));
}

function parseMapsURITest() {
    JsUnit.assertEquals('Query', URIS.parseMapsURI('maps:q=Query'));
    JsUnit.assertEquals('Search query', URIS.parseMapsURI('maps:q=Search%20query'));
    JsUnit.assertNull(URIS.parseMapsURI('maps:No%20query'));
    JsUnit.assertNull(URIS.parseMapsURI('not_a_valid_uri'));
    JsUnit.assertNull(URIS.parseMapsURI('maps:q=Foo%bar'));
}

function _assertArrayEquals(arr1, arr2) {
    JsUnit.assertEquals(arr1.length, arr2.length);
    for (let i = 0; i < arr1.length; i++) {
        JsUnit.assertEquals(arr1[i], arr2[i]);
    }
}

parseAsObjectURLTest();
parseAsCoordinateURLTest();
parseAsGeoURITest();
parseMapsURITest();
getUriParamTest();

