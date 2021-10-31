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

const URIS = imports.uris;

const OSM_COORD_URL1 =
    'https://www.openstreetmap.org/?lat=39.9882&lon=-78.2409&zoom=14&layers=B000FTF';

function main() {
    parseAsObjectURLTest();
    parseAsCoordinateURLTest();
}

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
}

function _assertArrayEquals(arr1, arr2) {
    JsUnit.assertEquals(arr1.length, arr2.length);
    for (let i = 0; i < arr1.length; i++) {
        JsUnit.assertEquals(arr1[i], arr2[i]);
    }
}

