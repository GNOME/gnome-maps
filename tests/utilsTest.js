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

const JsUnit = imports.jsUnit;

const Utils = imports.utils;

function main() {
    osmTypeToStringTest();
    dashedToCamelCaseTest();
    getAccuracyDescriptionTest();
    prettyTimeTest();
    prettyDistanceTest();
    normalizeStringTest();
    validWebsiteTest();
    validEmailTest();
    firstToLocaleUpperCaseTest();
}

function osmTypeToStringTest() {
    JsUnit.assertEquals('OSM type node', 'node',
                        Utils.osmTypeToString(Geocode.PlaceOsmType.NODE));
    JsUnit.assertEquals('OSM type way', 'way',
                        Utils.osmTypeToString(Geocode.PlaceOsmType.WAY));
    JsUnit.assertEquals('OSM type relation', 'relation',
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

function prettyTimeTest() {
    // tests with default locale C, as set above
    JsUnit.assertEquals('1 h', Utils.prettyTime(3600000));
    JsUnit.assertEquals('1 h 1 min', Utils.prettyTime(3660000));
    JsUnit.assertEquals('1 h', Utils.prettyTime(3600001));
    JsUnit.assertEquals('1 h 10 min', Utils.prettyTime(4200000));
    JsUnit.assertEquals('20 min', Utils.prettyTime(1200000));
    JsUnit.assertEquals('20 min', Utils.prettyTime(1201000));
    JsUnit.assertEquals('1 s', Utils.prettyTime(1000));
    JsUnit.assertEquals('1 s', Utils.prettyTime(1001));
}

function prettyDistanceTest() {
    // tests with metric system, using override mock function
    Utils.getMeasurementSystem = function() { return Utils.METRIC_SYSTEM; };
    JsUnit.assertEquals('1 km', Utils.prettyDistance(1000, false));
    JsUnit.assertEquals('2.4 km', Utils.prettyDistance(2400, false));
    JsUnit.assertEquals('123 m', Utils.prettyDistance(123, false));
    JsUnit.assertEquals('1 km', Utils.prettyDistance(1001, false));
    JsUnit.assertEquals('1001 m', Utils.prettyDistance(1001, true));

    // tests with imperial system, using override mock function
    Utils.getMeasurementSystem = function() { return Utils.IMPERIAL_SYSTEM; };
    JsUnit.assertEquals('1 mi', Utils.prettyDistance(1609, false));
    JsUnit.assertEquals('2.4 mi', Utils.prettyDistance(3900, false));
    JsUnit.assertEquals('0.3 mi', Utils.prettyDistance(440, false));
    JsUnit.assertEquals('1000 ft', Utils.prettyDistance(304.8, false));
    JsUnit.assertEquals('1 mi', Utils.prettyDistance(1610, false));
    JsUnit.assertEquals('5282 ft', Utils.prettyDistance(1610, true));
}

function normalizeStringTest() {
    JsUnit.assertEquals('foo', Utils.normalizeString('foo'));
    JsUnit.assertEquals('fooBar', Utils.normalizeString('fooBar'));
    JsUnit.assertEquals('aao', Utils.normalizeString('åäö'));
    JsUnit.assertEquals('aao', Utils.normalizeString('a\u030aa\u0308o\u0308'));
}

function validWebsiteTest() {
    JsUnit.assertEquals(true, Utils.isValidWebsite("https://gnome.org"));
    JsUnit.assertEquals(true, Utils.isValidWebsite("http://gnome.org"));
    JsUnit.assertEquals(false, Utils.isValidWebsite("ftp://gnome.org"));
    JsUnit.assertEquals(false, Utils.isValidWebsite("www.gnome.org"));
    JsUnit.assertEquals(false, Utils.isValidWebsite("https:gnome.org"));
}

function validEmailTest() {
    JsUnit.assertTrue(Utils.isValidEmail('mail@example.com'));
    JsUnit.assertTrue(Utils.isValidEmail('information.here@company.store'));
    JsUnit.assertTrue(Utils.isValidEmail('我買@屋企.香港'));
    JsUnit.assertFalse(Utils.isValidEmail('mailto:mail@example.com'));
    JsUnit.assertFalse(Utils.isValidEmail('mail@no-tld'));
}

function firstToLocaleUpperCaseTest() {
    JsUnit.assertEquals('Xxx', Utils.firstToLocaleUpperCase('xxx'));
    JsUnit.assertEquals('Xxx', Utils.firstToLocaleUpperCase('Xxx'));
    JsUnit.assertEquals('XXX', Utils.firstToLocaleUpperCase('XXX'));
    JsUnit.assertEquals('فارسی', Utils.firstToLocaleUpperCase('فارسی'));
    JsUnit.assertEquals('日本語', Utils.firstToLocaleUpperCase('日本語'));
}
