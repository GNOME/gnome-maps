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

pkg.require({ 'Gdk': '3.0',
              'Gtk': '3.0' });
pkg.initFormat();

const Geocode = imports.gi.GeocodeGlib;
const GLib = imports.gi.GLib;

// set default C locale for the tests before initing the Utils module
GLib.setenv('LANG', 'C', true);
GLib.setenv('LC_ALL', 'C', true);

const JsUnit = imports.jsUnit;

const Utils = imports.utils;

function main() {
    osmTypeToStringTest();
    dashedToCamelCaseTest();
    getAccuracyDescriptionTest();
}

function osmTypeToStringTest() {
    JsUnit.assertEquals('OSM type node', 'node',
                        Utils.osmTypeToString(Geocode.PlaceOsmType.NODE));
    JsUnit.assertEquals('OSM type way', 'way',
                        Utils.osmTypeToString(Geocode.PlaceOsmType.WAY));
    JsUnit.assertEquals('OSM type node', 'relation',
                        Utils.osmTypeToString(Geocode.PlaceOsmType.RELATION));
}

function dashedToCamelCaseTest() {
    JsUnit.assertEquals('foo', Utils.dashedToCamelCase('foo'));
    JsUnit.assertEquals('fooBar', Utils.dashedToCamelCase('foo-bar'));
}

function getAccuracyDescriptionTest() {
    JsUnit.assertEquals('Unknown',
                        Utils.getAccuracyDescription(Geocode.LOCATION_ACCURACY_UNKNOWN));
    JsUnit.assertEquals('Exact', Utils.getAccuracyDescription(0));
    // for other distances, the same as prettyDistance()
    JsUnit.assertEquals(Utils.prettyDistance(100),
                        Utils.getAccuracyDescription(100));
    JsUnit.assertEquals(Utils.prettyDistance(10000),
                        Utils.getAccuracyDescription(10000));
} 
