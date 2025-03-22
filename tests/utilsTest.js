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
import 'gi://GeocodeGlib?version=2.0';

import GeocodeGlib from 'gi://GeocodeGlib';

import * as Utils from '../src/utils.js';

const JsUnit = imports.jsUnit;

pkg.initFormat();

osmTypeToStringTest();
dashedToCamelCaseTest();
getAccuracyDescriptionTest();
prettyTimeTest();
prettyDistanceTest();
prettyPopulationTest();
normalizeStringTest();
validWebsiteTest();
validEmailTest();
firstToLocaleUpperCaseTest();
splitAtFirstTest();

function osmTypeToStringTest() {
    JsUnit.assertEquals('OSM type node', 'node',
                        Utils.osmTypeToString(GeocodeGlib.PlaceOsmType.NODE));
    JsUnit.assertEquals('OSM type way', 'way',
                        Utils.osmTypeToString(GeocodeGlib.PlaceOsmType.WAY));
    JsUnit.assertEquals('OSM type relation', 'relation',
                        Utils.osmTypeToString(GeocodeGlib.PlaceOsmType.RELATION));
}

function dashedToCamelCaseTest() {
    JsUnit.assertEquals('foo', Utils.dashedToCamelCase('foo'));
    JsUnit.assertEquals('fooBar', Utils.dashedToCamelCase('foo-bar'));
}

function getAccuracyDescriptionTest() {
    JsUnit.assertEquals('Unknown',
                        Utils.getAccuracyDescription(GeocodeGlib.LOCATION_ACCURACY_UNKNOWN));
    JsUnit.assertEquals('Exact', Utils.getAccuracyDescription(0));
    // for other distances, the same as prettyDistance()
    Utils._setOverrideMeasurementSystem('system');
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
    // tests with metric system
    Utils._setOverrideMeasurementSystem('metric');
    JsUnit.assertEquals('1 km', Utils.prettyDistance(1000, false));
    JsUnit.assertEquals('2.4 km', Utils.prettyDistance(2400, false));
    JsUnit.assertEquals('123 m', Utils.prettyDistance(123, false));
    JsUnit.assertEquals('1 km', Utils.prettyDistance(1001, false));
    JsUnit.assertEquals('1,001 m', Utils.prettyDistance(1001, true));

    // tests with imperial system
    Utils._setOverrideMeasurementSystem('imperial');
    JsUnit.assertEquals('1 mi', Utils.prettyDistance(1609, false));
    JsUnit.assertEquals('2.4 mi', Utils.prettyDistance(3900, false));
    JsUnit.assertEquals('0.3 mi', Utils.prettyDistance(440, false));
    JsUnit.assertEquals('1,000 ft', Utils.prettyDistance(304.8, false));
    JsUnit.assertEquals('1 mi', Utils.prettyDistance(1610, false));
    JsUnit.assertEquals('5,282 ft', Utils.prettyDistance(1610, true));
}

function prettyPopulationTest() {
    JsUnit.assertEquals('123,456', Utils.prettyPopulation(123456));
    JsUnit.assertEquals('1,234,567', Utils.prettyPopulation(1234567));
    JsUnit.assertEquals('200,000', Utils.prettyPopulation(200000));
    JsUnit.assertEquals('1M', Utils.prettyPopulation(1000000));
    JsUnit.assertEquals('2.1M', Utils.prettyPopulation(2100000));
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

function _assertPair(first, second, array) {
    JsUnit.assertEquals(2, array.length);
    JsUnit.assertEquals(first, array[0]);
    JsUnit.assertEquals(second, array[1]);
}

function splitAtFirstTest() {
    _assertPair('q', 'Query', Utils.splitAtFirst('q=Query', '='));
    _assertPair('q', 'Query=more', Utils.splitAtFirst('q=Query=more', '='));
    JsUnit.assertEquals(1, Utils.splitAtFirst('noseparator', '=').length);
}

