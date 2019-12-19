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
 * with GNOME Maps; if not, see <https://www.gnu.org/licenses/>.
 *
 * Author: Marcus Lundblad <ml@update.uu.se>
 */

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
function parseTimeString(timeString) {
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

    /* allow using :, ., and the ratio symbol to separate hours:mins */
    if (timeString.charAt(2) === ':' || timeString.charAt(1) === ':')
        timeString = timeString.replace(':', '');
    else if (timeString.charAt(2) === '.' || timeString.charAt(1) === '.')
        timeString = timeString.replace('.', '');
    else if (timeString.charAt(2) === '\u2236' ||
             timeString.charAt(1) === '\u2236')
        timeString = timeString.replace('\u2236', '');

    if (timeString.length === 4) {
        /* expect a full time specification (hours, minutes) */
        hours = timeString.substring(0, 2);
        mins = timeString.substring(2, 4);
    } else if (timeString.length === 3) {
        /* interpret a 3 digit string as h:mm */
        hours = '0' + timeString.substring(0, 1);
        mins = timeString.substring(1, 3);
    } else if (timeString.length === 2) {
        /* expect just the hour part */
        hours = timeString.substring(0, 2);
        mins = '00';
    } else if (timeString.length === 1) {
        /* expect just the hour part, one digit */
        hours = '0' + timeString;
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
