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

const JsUnit = imports.jsUnit;

import * as Time from '../src/time.js';
import * as Translations from '../src/translations.js';

// sample with 3 components, one day-range, two single days, single time ranges
const SAMPLE1 = 'Mo-Fr 09:00-18:00; Sa 10:00-15:00; Su 12:00-15:00';
// sample with 2 components, one day-range, one two day set, one with 2 time intervals
const SAMPLE2 = 'Mo-Fr 09:00-12:00,13:00-18:00; Sa,Su 10:00-14:00';
// sample with sunrise to sunset
const SAMPLE3 = 'sunrise-sunset';
// sample 24/7 open
const SAMPLE4 = '24/7';
// sample explicit 24/7
const SAMPLE5 = 'Mo-Su 00:00-24:00';
/* sample with 3 components, one day-range, two single days, single time ranges
   one explictly closed
 */
const SAMPLE6 = 'Mo-Fr 09:00-18:00; Sa 10:00-15:00; Su off';
// sample with an extra space before one time interval, as seen in the wild
const SAMPLE7 = 'Mo-Fr 09:00-12:00,13:00-18:00; Sa,Su 10:00-14:00';
// sample with public holidays
const SAMPLE8 = 'Mo-Fr 09:00-12:00,13:00-18:00; Sa,Su 10:00-14:00; PH off';
// sample with school holidays
const SAMPLE9 = 'Mo-Fr 09:00-12:00,13:00-18:00; Sa,Su 10:00-14:00; SH off';

/* sample with 2 components, one day-range, one two day set,
 * one with 2 time intervals, with an extra space between time components
 */
const SAMPLE10 = 'Mo-Fr 09:00-12:00, 13:00-18:00; Sa,Su 10:00-14:00';

pkg.initGettext();
pkg.initFormat();

// mock to use 24-hour clock format
Time._setIs12HourFunction(() => { return false; });

let translated = Translations.translateOpeningHours(SAMPLE1);
JsUnit.assertEquals(3, translated.length);
JsUnit.assertEquals(2, translated[0].length);
JsUnit.assertEquals('Mon-Fri', translated[0][0]);
JsUnit.assertEquals('09:00-18:00', translated[0][1]);
JsUnit.assertEquals(2, translated[1].length);
JsUnit.assertEquals('Sat', translated[1][0]);
JsUnit.assertEquals('10:00-15:00', translated[1][1]);
JsUnit.assertEquals(2, translated[2].length);
JsUnit.assertEquals('Sun', translated[2][0]);
JsUnit.assertEquals('12:00-15:00', translated[2][1]);

translated = Translations.translateOpeningHours(SAMPLE2);
JsUnit.assertEquals(2, translated.length);
JsUnit.assertEquals(2, translated[0].length);
JsUnit.assertEquals('Mon-Fri', translated[0][0]);
JsUnit.assertEquals('09:00-12:00, 13:00-18:00', translated[0][1]);
JsUnit.assertEquals(2, translated[1].length);
JsUnit.assertEquals('Sat,Sun', translated[1][0]);
JsUnit.assertEquals('10:00-14:00', translated[1][1]);

translated = Translations.translateOpeningHours(SAMPLE3);
JsUnit.assertEquals(1, translated.length);
JsUnit.assertEquals(1, translated[0].length);
JsUnit.assertEquals('From sunrise to sunset', translated[0][0]);

translated = Translations.translateOpeningHours(SAMPLE4);
JsUnit.assertEquals(1, translated.length);
JsUnit.assertEquals(1, translated[0].length);
JsUnit.assertEquals('Around the clock', translated[0][0]);

translated = Translations.translateOpeningHours(SAMPLE5);
JsUnit.assertEquals(1, translated.length);
JsUnit.assertEquals(1, translated[0].length);
JsUnit.assertEquals('Around the clock', translated[0][0]);

translated = Translations.translateOpeningHours(SAMPLE6);
JsUnit.assertEquals(3, translated.length);
JsUnit.assertEquals(2, translated[0].length);
JsUnit.assertEquals('Mon-Fri', translated[0][0]);
JsUnit.assertEquals('09:00-18:00', translated[0][1]);
JsUnit.assertEquals(2, translated[1].length);
JsUnit.assertEquals('Sat', translated[1][0]);
JsUnit.assertEquals('10:00-15:00', translated[1][1]);
JsUnit.assertEquals(2, translated[2].length);
JsUnit.assertEquals('Sun', translated[2][0]);
JsUnit.assertEquals('not open', translated[2][1]);

translated = Translations.translateOpeningHours(SAMPLE7);
JsUnit.assertEquals(2, translated.length);
JsUnit.assertEquals(2, translated[0].length);
JsUnit.assertEquals('Mon-Fri', translated[0][0]);
JsUnit.assertEquals('09:00-12:00, 13:00-18:00', translated[0][1]);
JsUnit.assertEquals(2, translated[1].length);
JsUnit.assertEquals('Sat,Sun', translated[1][0]);
JsUnit.assertEquals('10:00-14:00', translated[1][1]);

translated = Translations.translateOpeningHours(SAMPLE8);
JsUnit.assertEquals(3, translated.length);
JsUnit.assertEquals(2, translated[0].length);
JsUnit.assertEquals('Mon-Fri', translated[0][0]);
JsUnit.assertEquals('09:00-12:00, 13:00-18:00', translated[0][1]);
JsUnit.assertEquals(2, translated[1].length);
JsUnit.assertEquals('Sat,Sun', translated[1][0]);
JsUnit.assertEquals('10:00-14:00', translated[1][1]);
JsUnit.assertEquals(2, translated[2].length);
JsUnit.assertEquals('Public holidays', translated[2][0]);
JsUnit.assertEquals('not open', translated[2][1]);

translated = Translations.translateOpeningHours(SAMPLE9);
JsUnit.assertEquals(3, translated.length);
JsUnit.assertEquals(2, translated[0].length);
JsUnit.assertEquals('Mon-Fri', translated[0][0]);
JsUnit.assertEquals('09:00-12:00, 13:00-18:00', translated[0][1]);
JsUnit.assertEquals(2, translated[1].length);
JsUnit.assertEquals('Sat,Sun', translated[1][0]);
JsUnit.assertEquals('10:00-14:00', translated[1][1]);
JsUnit.assertEquals(2, translated[2].length);
JsUnit.assertEquals('School holidays', translated[2][0]);
JsUnit.assertEquals('not open', translated[2][1]);

translated = Translations.translateOpeningHours(SAMPLE10);
JsUnit.assertEquals(2, translated.length);
JsUnit.assertEquals(2, translated[0].length);
JsUnit.assertEquals('Mon-Fri', translated[0][0]);
JsUnit.assertEquals('09:00-12:00, 13:00-18:00', translated[0][1]);
JsUnit.assertEquals(2, translated[1].length);
JsUnit.assertEquals('Sat,Sun', translated[1][0]);
JsUnit.assertEquals('10:00-14:00', translated[1][1]);

// mock to always use 12-hour clock format
Time._setIs12HourFunction(() => { return true; });

translated = Translations.translateOpeningHours(SAMPLE1);
JsUnit.assertEquals(3, translated.length);
JsUnit.assertEquals(2, translated[0].length);
JsUnit.assertEquals('Mon-Fri', translated[0][0]);
JsUnit.assertEquals(2, translated[1].length);
JsUnit.assertEquals('Sat', translated[1][0]);
JsUnit.assertEquals(2, translated[2].length);
JsUnit.assertEquals('Sun', translated[2][0]);

translated = Translations.translateOpeningHours(SAMPLE2);
JsUnit.assertEquals(2, translated.length);
JsUnit.assertEquals(2, translated[0].length);
JsUnit.assertEquals('Mon-Fri', translated[0][0]);
JsUnit.assertEquals(2, translated[1].length);
JsUnit.assertEquals('Sat,Sun', translated[1][0]);

translated = Translations.translateOpeningHours(SAMPLE3);
JsUnit.assertEquals(1, translated.length);
JsUnit.assertEquals(1, translated[0].length);
JsUnit.assertEquals('From sunrise to sunset', translated[0][0]);

translated = Translations.translateOpeningHours(SAMPLE4);
JsUnit.assertEquals(1, translated.length);
JsUnit.assertEquals(1, translated[0].length);
JsUnit.assertEquals('Around the clock', translated[0][0]);

translated = Translations.translateOpeningHours(SAMPLE5);
JsUnit.assertEquals(1, translated.length);
JsUnit.assertEquals(1, translated[0].length);
JsUnit.assertEquals('Around the clock', translated[0][0]);

translated = Translations.translateOpeningHours(SAMPLE6);
JsUnit.assertEquals(3, translated.length);
JsUnit.assertEquals(2, translated[0].length);
JsUnit.assertEquals('Mon-Fri', translated[0][0]);
JsUnit.assertEquals(2, translated[1].length);
JsUnit.assertEquals('Sat', translated[1][0]);
JsUnit.assertEquals(2, translated[2].length);
JsUnit.assertEquals('Sun', translated[2][0]);
JsUnit.assertEquals('not open', translated[2][1]);

translated = Translations.translateOpeningHours(SAMPLE7);
JsUnit.assertEquals(2, translated.length);
JsUnit.assertEquals(2, translated[0].length);
JsUnit.assertEquals('Mon-Fri', translated[0][0]);
JsUnit.assertEquals(2, translated[1].length);
JsUnit.assertEquals('Sat,Sun', translated[1][0]);

translated = Translations.translateOpeningHours(SAMPLE8);
JsUnit.assertEquals(3, translated.length);
JsUnit.assertEquals(2, translated[0].length);
JsUnit.assertEquals('Mon-Fri', translated[0][0]);
JsUnit.assertEquals(2, translated[1].length);
JsUnit.assertEquals('Sat,Sun', translated[1][0]);
JsUnit.assertEquals(2, translated[2].length);
JsUnit.assertEquals('Public holidays', translated[2][0]);
JsUnit.assertEquals('not open', translated[2][1]);

translated = Translations.translateOpeningHours(SAMPLE9);
JsUnit.assertEquals(3, translated.length);
JsUnit.assertEquals(2, translated[0].length);
JsUnit.assertEquals('Mon-Fri', translated[0][0]);
JsUnit.assertEquals(2, translated[1].length);
JsUnit.assertEquals('Sat,Sun', translated[1][0]);
JsUnit.assertEquals(2, translated[2].length);
JsUnit.assertEquals('School holidays', translated[2][0]);
JsUnit.assertEquals('not open', translated[2][1]);

translated = Translations.translateOpeningHours(SAMPLE10);
JsUnit.assertEquals(2, translated.length);
JsUnit.assertEquals(2, translated[0].length);
JsUnit.assertEquals('Mon-Fri', translated[0][0]);
JsUnit.assertEquals(2, translated[1].length);
JsUnit.assertEquals('Sat,Sun', translated[1][0]);

