/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2014 Marcus Lundblad
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

import gettext from 'gettext';

const _ = gettext.gettext;
const C_ = gettext.dgettext;

import GLib from 'gi://GLib';

import * as Time from './time.js';
import * as Utils from './utils.js';

/* Translate an opening time specification tag value.
 * from OSM into a "two-dimensional" (array-of-arrays) grid of human-readable
 * strings (marked for translation) suitable for laying out in aligned rows
 * and columns in a GtkGrid in the place bubbles.
 *
 * Some limitations are imposed to keep the translations manageable:
 * A maximum of three components (separated by ; in the tag) are considered.
 * For each component a maximum of three day intervals are considered.
 * Each day interval can have one or two time intervals specified.
 * For each of these limitations, the input string is passed on unmodified
 * if the format is outside the supported cases, so no data should be dropped.
 * Currently only specifying weekdays and public and school holidays are
 * supported.
 * Other variants, such as month-specific opening hours and other interval
 * variants are not currently supported. In these cases, the data is
 * returned as-is.
 *
 * The definition for the opening_hours tag can be found at:
 * http://wiki.openstreetmap.org/wiki/Key:opening_hours
 */
export function translateOpeningHours(string) {
    if (string === '24/7' || string === 'Mo-Su 00:00-24:00' ||
        string === '00:00-24:00')
        return [[_("Around the clock")]];
    else if (string === 'sunrise-sunset')
        return [[_("From sunrise to sunset")]];
    else {
        /* split "components" */
        let splitParts = string.split(';');

        return splitParts.map(p => _translateOpeningHoursPart(p.trim()));
    }

}

/*
 * Parse a time range component, comprised of either a single time range, or
 * day and time ranges, such as:
 * 10:00-18:00
 * 09:00-12:00,13:00-19:00
 * Mo-Fr 10:00-19:00
 * Mo-We,Fr 10:00-12:00,13:00-17:00
 * Mo-We,Fr 10:00-12:00, 13:00-17:00
 */
export function _translateOpeningHoursPart(string) {
    let splitString = string.split(/\s+/);
    let len = splitString.length;

    if (len === 1) {
        return [_translateOpeningHoursTimeIntervalList(string.trim())];
    } else if (len === 2 || len === 3) {
        let dayIntervalSpec =
            _translateOpeningHoursDayIntervalList(splitString[0].trim());
        let intervalString =
            len === 2 ? splitString[1].trim() :
                        splitString[1].trim() + splitString[2].trim();
        let timeIntervalSpec =
            _translateOpeningHoursTimeIntervalList(intervalString);

        return [Utils.firstToLocaleUpperCase(dayIntervalSpec),
                timeIntervalSpec];
    } else {
        // for an unknown format, just output the raw value
        return [string];
    }
}

/*
 * Parse a day interval, such as:
 * Mo-Fr
 * Mo,We,Th-Fr
 */
export function _translateOpeningHoursDayIntervalList(string) {
    let splitParts = string.split(',');
    let interval1, interval2, interval3;

    switch (splitParts.length) {
        case 1:
            return _translateOpeningHoursDayInterval(splitParts[0].trim());
        case 2:
            interval1 = _translateOpeningHoursDayInterval(splitParts[0].trim());
            interval2 = _translateOpeningHoursDayInterval(splitParts[1].trim());
            /* Translators:
             * This represents a format string consisting of two day interval
             * specifications.
             * For example:
             * Mo-Fr,Sa
             * where the "Mo-Fr" and "Sa" parts are replaced by the %s
             * place holder.
             * The separator (,) could be replaced with a translated variant or
             * a phrase if appropriate. */
            return C_("day interval list", "%s,%s").format(interval1, interval2);
        case 3:
            interval1 = _translateOpeningHoursDayInterval(splitParts[0].trim());
            interval2 = _translateOpeningHoursDayInterval(splitParts[1].trim());
            interval3 = _translateOpeningHoursDayInterval(splitParts[2].trim());
            /* Translators:
             * This represents a format string consisting of three day interval
             * specifications.
             * For example:
             * Mo-We,Fr,Su
             * where the "Mo-We", "Fr", and "Su" parts are replaced by the
             * %s place holder.
             * The separator (,) could be replaced with a translated variant or
             * a phrase if appropriate. */
            return C_("day interval list", "%s,%s,%s").
                format(interval1, interval2, interval3);
        default:
            // for other formats, just return the raw string
            return string;
    }
}

/*
 * Parse a day interval consisting of either a single day
 * or a range, such as:
 * Mo-Fr
 * Tu
 */
export function _translateOpeningHoursDayInterval(string) {
    let splitString = string.split('-');

    // special case: Mo-Su treated as "every day"
    if (string === 'Mo-Su')
        return _("Every day");

    switch (splitString.length) {
        case 1:
            return _translateOpeningHoursDay(splitString[0].trim());
        case 2:
            let from = splitString[0].trim();
            let to = splitString[1].trim();

            /* Translators:
             * This represents a range of days with a starting and ending day.
             */
            return C_("day range", "%s-%s").format(
                _translateOpeningHoursDay(from),
                _translateOpeningHoursDay(to));
        default:
            // unknown format, just return the input
            return string;
    }
}

function _translateOpeningHoursDay(string) {
    if (string === 'PH')
        return _("Public holidays");
    if (string === 'SH')
        return _("School holidays");

    // create a dummy DateTime instance which is guaranteed to be a Monday
    let time = GLib.DateTime.new_local(1, 1, 1, 0, 0, 0.0);
    let days = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

    for (let i = 0; i < days.length; i++) {
        if (string === days[i]) {
            time = time.add_days(i);
            return time.format('%a');
        }
    }

    // unknown value, just return the input
    return string;
}

/*
 * Parse a time interval list, such as:
 * 10:00-20:00
 * 10:00-12:00,13:00-17:00
 */
function _translateOpeningHoursTimeIntervalList(string) {
    let splitString = string.split(',');

    switch (splitString.length) {
        case 1:
            return _translateOpeningHoursTimeInterval(splitString[0].trim());
        case 2:
            let interval1 = splitString[0].trim();
            let interval2 = splitString[1].trim();

            /* Translators:
             * This is a list with two time intervals, such as:
             * 09:00-12:00, 13:00-14:00
             * The intervals are represented by the %s place holders and
             * appropriate white space or connected phrase could be modified by
             * the translation. The order of the arguments can be rearranged
             * using the %n$s syntax.
             */
            return C_("time interval list", "%s, %s").format(
                _translateOpeningHoursTimeInterval(interval1),
                _translateOpeningHoursTimeInterval(interval2));
        default:
            // for other number of components, just return the input
            return string;
    }
}

/*
 * Parse a time interval
 */
function _translateOpeningHoursTimeInterval(string) {
    if (string === 'off')
        return _("not open");

    let splitString = string.split('-');

    if (splitString.length == 2) {
        let from = splitString[0].trim();
        let to = splitString[1].trim();

        /* Translators:
         * This is a time interval with a starting and an ending time.
         * The time values are represented by the %s place holders and
         * appropriate white spacing or connecting phrases can be set by the
         * translation as needed. The order of the arguments can be rearranged
         * using the %n$s syntax.
         */
        return C_("time interval", "%s-%s").format(
            _translateOpeningHoursTime(from),
            _translateOpeningHoursTime(to));
    } else {
        // unknown time interval format, just return the input
        return string;
    }
}

/*
 * Parse a time.
 */
function _translateOpeningHoursTime(string) {
    let splitString = string.split(':');

    if (splitString.length == 2) {
        let h = splitString[0];
        let min = splitString[1];

        // if the parts aren't numbers
        if (h % 1 !== 0 || min % 1 !== 0)
           return string;

        // if the hours or minute components are out of range
        if (h > 24 || h < 0 || min > 59 || min < 0)
            return string;

        return Time.formatTimeFromHoursAndMins(h, min);
    } else {
        // unknown format, just return input
        return string;
    }
}

export function translateReligion(string) {
    switch(string) {
    case 'animist': return _("Animism");
    case 'bahai': return _("Bahá'í");
    case 'buddhist': return _("Buddhism");
    case 'caodaism': return _("Caodaism");
    case 'christian': return _("Christianity");
    case 'confucian': return _("Confucianism");
    case 'hindu': return _("Hinduism");
    case 'jain': return _("Jainism");
    case 'jewish': return _("Judaism");
    case 'muslim': return _("Islam");
    case 'multifaith': return _("Multiple Religions");
    case 'none': return _("None");
    case 'pagan': return _("Paganism");
    case 'pastafarian': return _("Pastafarianism");
    case 'scientologist': return _("Scientology");
    case 'shinto': return _("Shinto");
    case 'sikh': return _("Sikhism");
    case 'spiritualist': return _("Spiritualism");
    case 'taoist': return _("Taoism");
    case 'unitarian_universalist': return _("Unitarian Universalism");
    case 'voodoo': return _("Voodoo");
    case 'yazidi': return _("Yazidism");
    case 'zoroastrian': return _("Zoroastrianism");
    default: return null;
    }
}
