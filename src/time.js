/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2017, Marcus Lundblad
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

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// allow using :, ., and the ratio symbol to separate hours:mins
const _DELIMITERS = [':', '.', '\u2236'];

// digits variants
const _DIGIT_RANGE_BASES = [
    // Arabic
    0x0660,
    // Persian
    0x06f0,
    // Nko
    0x07c0,
    // Devanagari
    0x0966,
    // Bengali
    0x09e6,
    // Gurmukhi
    0x0a66,
    // Gujarati
    0x0ae6,
    // Oriya
    0x0b66,
    // Tamil
    0x0be6,
    // Telugu
    0x0c66,
    // Kannada
    0x0c80,
    // Malayalam
    0x0d66,
    // Sinhala
    0x0de6,
    // Thai
    0x0e50,
    // Lao
    0x0ed0,
    // Tibetan
    0x0f20,
    // Myanmar
    0x1090,
    // Khmer
    0x17e0,
    // Mongolian
    0x1810,
    // Limbu
    0x1946,
    // Tai lue
    0x19d0,
    // Tai Tham
    0x1a90,
    // Balinese
    0x1b50,
    // Sundanese
    0x1bb0,
    // Lepcha
    0x1c40
];

// in org.gnome.desktop.interface
const CLOCK_FORMAT_SCHEMA = 'org.gnome.desktop.interface';
const CLOCK_FORMAT_KEY = 'clock-format';

const PORTAL_BUS_NAME = 'org.freedesktop.portal.Desktop';
const PORTAL_OBJECT_PATH = '/org/freedesktop/portal/desktop';
const PORTAL_SETTINGS_INTERFACE = 'org.freedesktop.portal.Settings';


let _desktopSettings = new Gio.Settings({ schema_id: CLOCK_FORMAT_SCHEMA });
let _clockFormat;
let _portal;

const _timeFormat24 = new Intl.DateTimeFormat([], { hour:     '2-digit',
                                                    minute:   '2-digit',
                                                    hour12:   false,
                                                    timeZone: 'UTC'});
const _timeFormat12 = new Intl.DateTimeFormat([], { hour:     '2-digit',
                                                    minute:   '2-digit',
                                                    hour12:   true,
                                                    timeZone: 'UTC'});

/* parse a time from a fixed set of free-formats into a string representation:
 * hour:min
 *
 * Examples:
 * "10:00" → "10:00"
 * "1:00pm" → "13:00"
 * "0800" → "08:00"
 * "10.30" → "10:30"
 * "12" → "12:00"
 *
 * TODO: maybe try to use some library to get better locale handling,
 * or push for something in GLib */
export function parseTimeString(timeString) {
    let pmSet = false;
    let hours;
    let mins;
    /* remove extra whitespaces */
    timeString = timeString.replace(/\s+/g, '');

    if (timeString.endsWith('am')) {
        timeString = timeString.substring(0, timeString.length - 2);
    } else if (timeString.endsWith('pm')) {
        timeString = timeString.substring(0, timeString.length - 2);
        pmSet = true;
    }

    /* remove delimiting characters if they occur at position 3 (hh:mm)
     * or position 2 (h:mm)
     */
    if (_DELIMITERS.includes(timeString.charAt(2)))
        timeString = timeString.substring(0, 2) + timeString.substring(3);
    else if (_DELIMITERS.includes(timeString.charAt(1)))
        timeString = timeString.substring(0, 1) + timeString.substring(2);

    // translate localized digits to corresponding Latin digits
    let translatedTimeString = '';

    for (let i = 0; i < timeString.length; i++) {
        let c = timeString.charCodeAt(i);

        _DIGIT_RANGE_BASES.forEach((base) => {
            if (c >= base && c < base + 10)
                c = (c - base) + 0x30;
        });
        translatedTimeString += String.fromCharCode(c);
    }

    if (translatedTimeString.length === 4) {
        /* expect a full time specification (hours, minutes) */
        hours = translatedTimeString.substring(0, 2);
        mins = translatedTimeString.substring(2, 4);
    } else if (timeString.length === 3) {
        /* interpret a 3 digit string as h:mm */
        hours = '0' + translatedTimeString.substring(0, 1);
        mins = translatedTimeString.substring(1, 3);
    } else if (translatedTimeString.length === 2) {
        /* expect just the hour part */
        hours = translatedTimeString.substring(0, 2);
        mins = '00';
    } else if (translatedTimeString.length === 1) {
        /* expect just the hour part, one digit */
        hours = '0' + translatedTimeString;
        mins = '00';
    } else {
        /* this makes no sense, just bail out */
        return null;
    }

    /* check if the parts can be interpreted as numbers */
    if (hours % 1 === 0 && mins % 1 === 0) {
        if (pmSet)
            hours = parseInt(hours) + 12;

        /* if the hours or minutes is out-of-range, bail out */
        if (hours < 0 || hours > 24 || mins < 0 || mins > 59)
            return null;

        return hours + ':' + mins;
    } else {
        return null;
    }
}

function setupClockFormatPortal() {
    _portal = Gio.DBusProxy.new_for_bus_sync(Gio.BusType.SESSION,
                                             Gio.DBusProxyFlags.NONE,
                                             null,
                                             PORTAL_BUS_NAME,
                                             PORTAL_OBJECT_PATH,
                                             PORTAL_SETTINGS_INTERFACE,
                                             null);

    const result = _portal.call_sync('Read',
                                     new GLib.Variant('(ss)',
                                                      [CLOCK_FORMAT_SCHEMA,
                                                       CLOCK_FORMAT_KEY]),
                                     Gio.DBusCallFlags.NONE,
                                     -1,
                                     null);

    _portal.connect('g-signal', (proxy, senderName, signalName, parameters) => {
        if (signalName !== 'SettingChanged')
            return;

        _clockFormat = parameters.deepUnpack()[2].deepUnpack();
    });

    [_clockFormat,] = result.deepUnpack()[0].unpack().get_string();
}

let _is12Hour = function() {
    if (!_clockFormat) {
        try {
            setupClockFormatPortal();
        } catch (e) {
            log('Failed to get clock format from portal, fallback to GSettings');

            _desktopSettings.connect('changed', (settings, key) => {
                if (key === CLOCK_FORMAT_KEY)
                    _clockFormat = _desktopSettings.get_string(CLOCK_FORMAT_KEY);
            });

            _clockFormat = _desktopSettings.get_string(CLOCK_FORMAT_KEY);
        }
    }

    return _clockFormat === '12h';
}

export function is12Hour() {
    return _is12Hour();
}

// for use by unit test mocking only
export function _setIs12HourFunction(f) {
    _is12Hour = f;
}

/**
 * Format a time as HH:mm in either 12 or 24 h
 * format depending on system settings
 * given time in ms since Epoch with an offset in
 * ms relative UTC.
 */
export function formatTimeWithTZOffset(time, offset) {
    let utcTimeWithOffset = time + offset;
    let date = new Date();
    let timeFormat = _is12Hour() ? _timeFormat12 : _timeFormat24;

    date.setTime(utcTimeWithOffset);

    return timeFormat.format(date);
}

/**
 * Format a time as HH:mm in either 12 or 24 h
 * format depending on system settings
 * given hours and minutes values.
 */
export function formatTimeFromHoursAndMins(hours, mins) {
    let date = new Date();
    let timeFormat = _is12Hour() ? _timeFormat12 : _timeFormat24;

    date.setUTCHours(hours);
    date.setUTCMinutes(mins);

    return timeFormat.format(date);
}

/**
 * Parse a time string into an array with
 * an absolute timestamp in ms since Unix epoch and a timezone offset
 *
 * @param {string} timeString
 * @param {GLib.TimeZone} defaultTimezome timezone to use if timeString doesn't specify offset
 * @returns {Array} timestamp in ms since Epoch, timezone offset from UTC in ms
 */
export function parseTime(timeString, defaultTimezone = null) {
    const dateTime = GLib.DateTime.new_from_iso8601(timeString,
                                                    defaultTimezone);

    return [dateTime.to_unix() * 1000, dateTime.get_utc_offset() / 1000];
}
