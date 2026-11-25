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

pkg.initFormat();

import GLib from 'gi://GLib';

import * as Time from '../src/time.js';

function compare12HourTime(format, hoursMinutes, AMPM) {
    JsUnit.assertTrue(format.includes(hoursMinutes));
    JsUnit.assertTrue(format.endsWith(AMPM));
}

function formatDateTimeTest() {
    // mock to always use 24 hour format
    Time._setIs12HourFunction(() => { return false; });

    const date1 = GLib.DateTime.new_from_iso8601('2025-11-03T21:14:29Z', null);
    // date during European DST
    const date2 = GLib.DateTime.new_from_iso8601('2025-07-01T12:34:56Z', null);

    JsUnit.assertEquals('22:14',
                        Time.formatDateTime(date1.to_timezone(GLib.TimeZone.new_identifier('Europe/Stockholm'))));
    JsUnit.assertEquals('21:14',
                        Time.formatDateTime(date1.to_timezone(GLib.TimeZone.new_identifier('Europe/London'))));
    JsUnit.assertEquals('14:34',
                        Time.formatDateTime(date2.to_timezone(GLib.TimeZone.new_identifier('Europe/Stockholm'))));
    JsUnit.assertEquals('13:34',
                        Time.formatDateTime(date2.to_timezone(GLib.TimeZone.new_identifier('Europe/London'))));

    // mock to always use 12 hour format
    Time._setIs12HourFunction(() => { return true; });

    compare12HourTime(Time.formatDateTime(date1.to_timezone(GLib.TimeZone.new_identifier('Europe/Stockholm'))),
                      '10:14', 'PM');
    compare12HourTime(Time.formatDateTime(date1.to_timezone(GLib.TimeZone.new_identifier('Europe/London'))),
                      '09:14', 'PM');
    compare12HourTime(Time.formatDateTime(date2.to_timezone(GLib.TimeZone.new_identifier('Europe/Stockholm'))),
                      '02:34', 'PM');
    compare12HourTime(Time.formatDateTime(date2.to_timezone(GLib.TimeZone.new_identifier('Europe/London'))),
                      '01:34', 'PM');
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

function parseDateTimeTest() {
    // valid date
    const dateValid =
        Time.parseDateTime('2025-11-06T22:33:44Z',
                           GLib.TimeZone.new_identifier('Europe/Stockholm'));
    // invalid date
    const dateInvalid =
        Time.parseDateTime('invalid-date',
                           GLib.TimeZone.new_identifier('Asia/Tokyo'));

    JsUnit.assertEquals(2025, dateValid.get_year());
    JsUnit.assertEquals(11, dateValid.get_month());
    JsUnit.assertEquals(6, dateValid.get_day_of_month());
    JsUnit.assertEquals(23, dateValid.get_hour());
    JsUnit.assertEquals(33, dateValid.get_minute());
    JsUnit.assertEquals(44, dateValid.get_second());
    JsUnit.assertEquals('Europe/Stockholm',
                        dateValid.get_timezone().get_identifier());
    JsUnit.assertNull(dateInvalid);
}

function getTimezoneOffsetTest() {
    const dateTime =
        GLib.DateTime.new_from_iso8601('2026-10-25T21:23:00Z', null).to_timezone(GLib.TimeZone.new_identifier('Europe/Stockholm'));

    JsUnit.assertEquals(1,
                        Time.getTimezoneOffset(dateTime,
                                               GLib.TimeZone.new_identifier('Europe/London')));
    JsUnit.assertEquals(5,
                        Time.getTimezoneOffset(dateTime,
                                               GLib.TimeZone.new_identifier('America/New_York')));
    JsUnit.assertEquals(-8,
                        Time.getTimezoneOffset(dateTime,
                                               GLib.TimeZone.new_identifier('Asia/Tokyo')));
}

function getUTCOffsetStringTest() {
    const tz1 = GLib.TimeZone.new_identifier('Europe/Stockholm');
    const tz2 = GLib.TimeZone.new_identifier('Europe/London');
    const tz3 = GLib.TimeZone.new_identifier('America/Los_Angeles');

    JsUnit.assertEquals('UTC+1',
                        Time.getUTCOffsetString(GLib.DateTime.new_from_iso8601('2026-10-26T22:00:00Z',
                                                                               null).to_timezone(tz1)));
    JsUnit.assertEquals('UTC+0',
                        Time.getUTCOffsetString(GLib.DateTime.new_from_iso8601('2026-10-26T22:00:00Z',
                                                                               null).to_timezone(tz2)));
    JsUnit.assertEquals('UTC-7',
                        Time.getUTCOffsetString(GLib.DateTime.new_from_iso8601('2026-10-26T22:00:00Z',
                                                                               null).to_timezone(tz3)));
}

function getTimezoneOffsetStringTest() {
    JsUnit.assertEquals('2', Time.getTimezoneOffsetString(2));
    JsUnit.assertEquals('2', Time.getTimezoneOffsetString(2, false));
    JsUnit.assertEquals('+2', Time.getTimezoneOffsetString(2, true));
    JsUnit.assertEquals('-2', Time.getTimezoneOffsetString(-2));
    JsUnit.assertEquals('-2', Time.getTimezoneOffsetString(-2, true));
    JsUnit.assertEquals('4:30', Time.getTimezoneOffsetString(4.5));
    JsUnit.assertEquals('-3:30', Time.getTimezoneOffsetString(-3.5));
    JsUnit.assertEquals('+5:30', Time.getTimezoneOffsetString(5.5, true));
    JsUnit.assertEquals('2:06', Time.getTimezoneOffsetString(2.1));
    JsUnit.assertEquals('0:30', Time.getTimezoneOffsetString(0.5));
    JsUnit.assertEquals('+0:30', Time.getTimezoneOffsetString(0.5, true));
    JsUnit.assertEquals('-0:30', Time.getTimezoneOffsetString(-0.5));
}

formatDateTimeTest();
formatTimeFromHoursAndMinsTest();

parseDateTimeTest();
getTimezoneOffsetTest();
getUTCOffsetStringTest();


function getTimetableDayOffsetTest() {
    const tz = GLib.TimeZone.new_identifier('Europe/Stockholm');
    // Reference time: Monday 2026-11-23 at 20:00
    const mon20 = GLib.DateTime.new(tz, 2026, 11, 23, 20, 0, 0);

    // Same day late evening: Monday 23:30 -> offset 0
    const mon23 = GLib.DateTime.new(tz, 2026, 11, 23, 23, 30, 0);
    JsUnit.assertEquals(0, Time.getTimetableDayOffset(mon23, mon20));

    // Next calendar day early morning before 04:00: Tuesday 01:30 -> still offset 0
    const tue01 = GLib.DateTime.new(tz, 2026, 11, 24, 1, 30, 0);
    JsUnit.assertEquals(0, Time.getTimetableDayOffset(tue01, mon20));

    // Right before 04:00 cutoff: Tuesday 03:59:59 -> offset 0
    const tue0359 = GLib.DateTime.new(tz, 2026, 11, 24, 3, 59, 59);
    JsUnit.assertEquals(0, Time.getTimetableDayOffset(tue0359, mon20));

    // Right at 04:00 cutoff: Tuesday 04:00 -> new timetable day -> offset 1
    const tue04 = GLib.DateTime.new(tz, 2026, 11, 24, 4, 0, 0);
    JsUnit.assertEquals(1, Time.getTimetableDayOffset(tue04, mon20));

    // Tuesday afternoon 14:00 -> offset 1
    const tue14 = GLib.DateTime.new(tz, 2026, 11, 24, 14, 0, 0);
    JsUnit.assertEquals(1, Time.getTimetableDayOffset(tue14, mon20));

    // Wednesday afternoon 14:00 (two days later) -> offset 2
    const wed14 = GLib.DateTime.new(tz, 2026, 11, 25, 14, 0, 0);
    JsUnit.assertEquals(2, Time.getTimetableDayOffset(wed14, mon20));

    // Previous day: Sunday 22:00 -> offset -1
    const sun22 = GLib.DateTime.new(tz, 2026, 11, 22, 22, 0, 0);
    JsUnit.assertEquals(-1, Time.getTimetableDayOffset(sun22, mon20));
}

function formatTransitDateTimeTest() {
    const tz = GLib.TimeZone.new_identifier('Europe/Stockholm');
    // Mock current time: Monday 2026-11-23 at 20:00
    const fixedNow = GLib.DateTime.new(tz, 2026, 11, 23, 20, 0, 0);
    Time._setNowFunction(() => fixedNow);

    // Mock 24-hour format
    Time._setIs12HourFunction(() => false);

    // Same day departure (Monday 22:15) -> standard time format
    const mon22 = GLib.DateTime.new(tz, 2026, 11, 23, 22, 15, 0);
    JsUnit.assertEquals('22:15', Time.formatTransitDateTime(mon22));

    // Late night departure (Tuesday 01:30) -> same timetable day -> standard time format
    const tue01 = GLib.DateTime.new(tz, 2026, 11, 24, 1, 30, 0);
    JsUnit.assertEquals('01:30', Time.formatTransitDateTime(tue01));

    // Next day morning departure (Tuesday 06:15) -> Tomorrow indicator
    const tue06 = GLib.DateTime.new(tz, 2026, 11, 24, 6, 15, 0);
    JsUnit.assertEquals('06:15 (Tomorrow)', Time.formatTransitDateTime(tue06));

    // Previous day departure (Sunday 21:00) -> Yesterday indicator
    const sun21 = GLib.DateTime.new(tz, 2026, 11, 22, 21, 0, 0);
    JsUnit.assertEquals('21:00 (Yesterday)', Time.formatTransitDateTime(sun21));

    // Two days later (Wednesday 10:00) -> Weekday name indicator
    const wed10 = GLib.DateTime.new(tz, 2026, 11, 25, 10, 0, 0);
    JsUnit.assertTrue(Time.formatTransitDateTime(wed10).includes('10:00'));
    JsUnit.assertTrue(Time.formatTransitDateTime(wed10).includes('Wed'));

    // Overnight trip departing today: Monday 22:00 -> Tuesday 06:00
    const tripArrToday = GLib.DateTime.new(tz, 2026, 11, 24, 6, 0, 0);
    JsUnit.assertEquals('06:00 (Tomorrow)', Time.formatTransitDateTime(tripArrToday, mon22));

    // Overnight trip departing on Thursday 17:22 arriving Friday 05:08 (from MOTIS reference)
    const thuDep = GLib.DateTime.new(tz, 2026, 11, 26, 17, 22, 0);
    const friArr = GLib.DateTime.new(tz, 2026, 11, 27, 5, 8, 0);
    JsUnit.assertTrue(Time.formatTransitDateTime(thuDep).includes('17:22'));
    JsUnit.assertTrue(Time.formatTransitDateTime(thuDep).includes('Thu'));
    JsUnit.assertTrue(Time.formatTransitDateTime(friArr, thuDep).includes('05:08'));
    JsUnit.assertTrue(Time.formatTransitDateTime(friArr, thuDep).includes('Fri'));

    // Trip departing tomorrow stretching into the day after (e.g. Stockholm -> Hamburg)
    const tue17 = GLib.DateTime.new(tz, 2026, 11, 24, 17, 30, 0);
    const wed15 = GLib.DateTime.new(tz, 2026, 11, 25, 15, 37, 0);
    JsUnit.assertEquals('17:30 (Tomorrow)', Time.formatTransitDateTime(tue17));
    JsUnit.assertTrue(Time.formatTransitDateTime(wed15, tue17).includes('15:37'));
    JsUnit.assertTrue(Time.formatTransitDateTime(wed15, tue17).includes('Wed'));
}

getTimezoneOffsetStringTest();
getTimetableDayOffsetTest();
formatTransitDateTimeTest();
