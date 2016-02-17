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

const _ = imports.gettext.gettext;
const C_ = imports.gettext.dgettext;

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

// in org.gnome.desktop.interface
const CLOCK_FORMAT_KEY = 'clock-format';

let _desktopSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
let clockFormat = _desktopSettings.get_string(CLOCK_FORMAT_KEY);


/* Translate an opening time specification tag value.
 * from OSM to a human-readable string (marked for translation).
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
function translateOpeningHours(string) {
    if (string === '24/7')
        return _("around the clock");
    else if (string === 'Mo-Su 00:00-24:00')
        return _("around the clock");
    else if (string === 'sunrise-sunset')
        return _("from sunrise to sunset");
    else {
        /* split "components" */
        let splitParts = string.split(';');
        let part1, part2, part3;

        switch (splitParts.length) {
            case 1:
                return _translateOpeningHoursPart(splitParts[0].trim());
            case 2:
                part1 = _translateOpeningHoursPart(splitParts[0].trim());
                part2 = _translateOpeningHoursPart(splitParts[1].trim());

                /* Translators:
                 * This is a format string with two separate time ranges
                 * such as "Mo-Fr 10:00-19:00 Sa 12:00-16:00"
                 * The space between the format place holders could be
                 * substituted with the appropriate separator.
                 */
                return C_("time range list", "%s %s").format(part1, part2);
            case 3:
                part1 = _translateOpeningHoursPart(splitParts[0].trim());
                part2 = _translateOpeningHoursPart(splitParts[1].trim());
                part3 = _translateOpeningHoursPart(splitParts[2].trim());

                /* Translators:
                 * This is a format string with three separate time ranges
                 * such as "Mo-Fr 10:00-19:00 Sa 10:00-17:00 Su 12:00-16:00"
                 * The space between the format place holders could be
                 * substituted with the appropriate separator.
                 */
            return C_("time range list", "%s %s %s").format(part1,
                                                            part2,
                                                            part3);
            default:
                return string;
        }
    }

}

/*
 * Parse a time range component, comprised of day and time ranges, such as:
 * Mo-Fr 10:00-19:00
 * Mo-We,Fr 10:00-12:00,13:00-17:00
 */
function _translateOpeningHoursPart(string) {
    let splitString = string.split(' ');

    if (splitString.length == 2) {
        let dayIntervalSpec =
            _translateOpeningHoursDayIntervalList(splitString[0].trim());
        let timeIntervalSpec =
            _translateOpeningHoursTimeIntervalList(splitString[1].trim());

        /* Translators:
         * This is a format string consisting of a part specifying the days for
         * which the specified time is applied and the time interval
         * specification as the second argument.
         * The space between the format place holders could be substituted with
         * the appropriate separator or phrase and the ordering of the arguments
         * can be rearranged with the %n#s syntax. */
        return C_("time range component", "%s %s").
                    format(dayIntervalSpec, timeIntervalSpec);
    } else {
        // for an unknown format, just output the raw value
        return string;
    }
}

/*
 * Parse a day interval, such as:
 * Mo-Fr
 * Mo,We,Th-Fr
 */
function _translateOpeningHoursDayIntervalList(string) {
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
function _translateOpeningHoursDayInterval(string) {
    let splitString = string.split('-');

    // special case: Mo-Su treated as "every day"
    if (string === 'Mo-Su')
        return _("every day");

    switch (splitString.length) {
        case 1:
            return _translateOpeningHoursDay(splitString[0].trim());
        case 2: {
            let from = splitString[0].trim();
            let to = splitString[1].trim();

            /* Translators:
             * This represents a range of days with a starting and ending day.
             */
            return C_("day range", "%s-%s").format(
                _translateOpeningHoursDay(from),
                _translateOpeningHoursDay(to));
        }
        default:
            // unknown format, just return the input
            return string;
    }
}

function _translateOpeningHoursDay(string) {
    if (string === 'PH')
        return _("public holidays");
    if (string === 'SH')
        return _("school holidays");

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
        case 2: {
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
        }
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

        // should translate 24:00 to 00:00 to keep GDateTime happy
        if (h == 24)
            h = 0;

        // create a dummy DateTime, we are just interested in the hour and
        // minute parts
        let time = GLib.DateTime.new_local(1, 1, 1, h, min, 0.0);

        if (clockFormat === '24h')
            return time.format('%R');
        else
            return time.format('%r');
    } else {
        // unknown format, just return input
        return string;
    }
}

function translateInternetAccess(string) {
    switch(string) {
    /* Translators:
     * There is public internet access but the particular kind is unknown.
     */
    case 'yes': return _("yes");

    /* Translators:
     * no internet access is offered in a place where
     * someone might expect it.
     */
    case 'no': return _("no");

    /* Translators:
     * This means a WLAN Hotspot, also know as wireless, wifi or Wi-Fi.
     */
    case 'wlan': return _("Wi-Fi");

    /* Translators:
     * This means a a place where you can plug in your laptop with ethernet.
     */
    case 'wired': return _("wired");

    /* Translators:
     * Like internet cafe or library where the computer is given.
     */
    case 'terminal': return _("terminal");

    /* Translators:
     * This means there is personnel which helps you in case of problems.
     */
    case 'service': return _("service");

    default: return null;
    }
}

