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

import GLib from 'gi://GLib';

import * as Time from '../src/time.js';

function compare12HourTime(format, hoursMinutes, AMPM) {
    JsUnit.assertTrue(format.includes(hoursMinutes));
    JsUnit.assertTrue(format.endsWith(AMPM));
}

function formatTimeWithTZOffsetTest() {
    // mock to always use 24 hour format
    Time._setIs12HourFunction(() => { return false; });

    JsUnit.assertEquals('22:54',
                        Time.formatTimeWithTZOffset(1607982864000, 3600000));
    JsUnit.assertEquals('21:54',
                        Time.formatTimeWithTZOffset(1607982864000, 0));

    // mock to always use 12 hour format
    Time._setIs12HourFunction(() => { return true; });

    compare12HourTime(Time.formatTimeWithTZOffset(1607982864000, 3600000),
                      '10:54', 'PM');
}

function formatTimeFromHoursAndMinsTest() {
    // mock to always use 24 hour format
    Time._setIs12HourFunction(() => { return false; });

    JsUnit.assertEquals('12:34', Time.formatTimeFromHoursAndMins(12, 34));
    JsUnit.assertEquals('00:00', Time.formatTimeFromHoursAndMins(24, 0));
    JsUnit.assertEquals('12:01', Time.formatTimeFromHoursAndMins(12, 1));

    // mock to always use 12 hour format
    Time._setIs12HourFunction(() => { return true; });

    compare12HourTime(Time.formatTimeFromHoursAndMins(12, 34), '12:34', 'PM');
    compare12HourTime(Time.formatTimeFromHoursAndMins(24, 0), '12:00', 'AM');
    compare12HourTime(Time.formatTimeFromHoursAndMins(12, 1), '12:01', 'PM');
}

function parseTimeTest(timeString, defaultTimezone, expectedTs, expectedTz) {
    const [ts, tz] = Time.parseTime(timeString, defaultTimezone);

    JsUnit.assertEquals(expectedTs, ts);
    JsUnit.assertEquals(expectedTz, tz)
}

formatTimeWithTZOffsetTest();
formatTimeFromHoursAndMinsTest();

parseTimeTest('2023-11-01T22:00:00+01:00', null, 1698872400000, 3600000);
parseTimeTest('2023-11-01T23:00:00+02:00', null, 1698872400000, 7200000);
parseTimeTest('2023-11-01T22:00:00', GLib.TimeZone.new('Europe/Stockholm'),
              1698872400000, 3600000);
