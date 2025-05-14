/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2011, 2013 Red Hat, Inc.
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
 * Author: Cosimo Cecchi <cosimoc@redhat.com>
 *         Zeeshan Ali (Khattak) <zeeshanak@gnome.org>
 */

import gettext from 'gettext';

import GLib from 'gi://GLib';
import Gdk from 'gi://Gdk';
import GeocodeGlib from 'gi://GeocodeGlib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import GWeather from 'gi://GWeather';

import {Settings} from './settings.js';

const _ = gettext.gettext;
const ngettext = gettext.ngettext;

//List of locales using imperial system according to glibc locale database
const IMPERIAL_LOCALES = ['unm_US', 'es_US', 'es_PR', 'en_US', 'yi_US'];

// Matches all unicode stand-alone accent characters
const ACCENTS_REGEX = /[\u0300-\u036F]/g;

// Regex matching e-mail addresses
const EMAIL_REGEX=/^[^\s@]+@[^\s@]+\.[^\s@]+$/

const _integerFormat = new Intl.NumberFormat([], { maximumFractionDigits: 0 });
const _integerTwoDigitFormat =
    new Intl.NumberFormat([], { minimumIntegerDigits: 2,
                                maximumFractionDigits: 0 });

/* countries/terrotories driving on the left
 * source: https://en.wikipedia.org/wiki/Left-_and_right-hand_traffic
 */
const LHT_COUNTRIES = new Set(['AG', 'AI', 'AU', 'BB', 'BD', 'BM', 'BN', 'BS',
                               'BT', 'BW', 'CY', 'DM', 'FJ', 'FK', 'GB', 'GD',
                               'GY', 'HK', 'ID', 'IE', 'IM', 'IN', 'JE', 'JM',
                               'JP', 'KE', 'KI', 'KN', 'KY', 'LC', 'LK', 'LS',
                               'MO', 'MS', 'MT', 'MU', 'MV', 'MW', 'MY', 'MZ',
                               'NA', 'NP', 'NR', 'NZ', 'PG', 'PN', 'PK', 'SB',
                               'SC', 'SG', 'SH', 'SR', 'SZ', 'TC', 'TH', 'TL',
                               'TO', 'TT', 'TV', 'TZ', 'UG', 'VC', 'VG', 'VI',
                               'WS', 'ZA', 'ZM', 'ZW']);

let debugInit = false;

export var debugEnabled = false;

export function debug(msg) {
    if (!debugInit) {
        let env = GLib.getenv('MAPS_DEBUG');
        if (env)
            debugEnabled = true;

        debugInit = true;
    }

    if (debugEnabled) {
        log('DEBUG: ' + msg);
        if (msg instanceof Error)
            log(msg.stack);
    }
}

// Connect to a signal on an object and disconnect on its first emission.
export function once(obj, signal, callback) {
    let id = obj.connect(signal, function() {
        obj.disconnect(id);
        callback();
    });
}

export function addActions(actionMap, entries, settings = null) {
    for(let name in entries) {
        let entry = entries[name];
        let action = createAction(name, entry, settings);

        actionMap.add_action(action);

        if(entry.accels)
            setAccelsForActionMap(actionMap, name, entry.accels);
    }
}

export function setAccelsForActionMap(actionMap, actionName, accels) {
    let app;
    let prefix;

    if(actionMap instanceof Gtk.Application) {
        app = actionMap;
        prefix = "app";
    } else if(actionMap instanceof Gtk.Window) {
        app = actionMap.application;
        prefix = "win";
    }
    app.set_accels_for_action(prefix + '.' + actionName, accels);
}

function createAction(name,
                      { state, paramType, onActivate, onChangeState, setting },
                      settings = null) {
    let action;

    if (setting && settings) {
        action = settings.create_action(setting);

        if (onChangeState)
            action.connect('notify::state', onChangeState);
    } else {
        let entry = { name: name };

        if (Array.isArray(state)) {
            let [type, value] = state;
            entry.state = new GLib.Variant.new(type, value);
        }

        if (paramType !== undefined)
            entry.parameter_type = GLib.VariantType.new(paramType);

        action = new Gio.SimpleAction(entry);

        if (onActivate)
            action.connect('activate', onActivate);
        if (onChangeState)
            action.connect('change-state', onChangeState);
    }

    return action;
}

function _getPlatformData(appId, timestamp) {
    let context = Gdk.Display.get_default().get_app_launch_context();
    context.set_timestamp(timestamp);
    let info = Gio.DesktopAppInfo.new(appId + '.desktop');
    let id = new GLib.Variant('s', context.get_startup_notify_id(info, []));

    return { 'desktop-startup-id': id };
}

export function activateAction(appId, action, parameter, timestamp) {
    let objectPath = '/' + appId.replace(/\./g, '/');
    let platformData = _getPlatformData(appId, timestamp);
    let wrappedParam = parameter ? [parameter] : [];

    Gio.DBus.session.call(appId,
                          objectPath,
                          'org.freedesktop.Application',
                          'ActivateAction',
                          new GLib.Variant('(sava{sv})', [action,
                                                          wrappedParam,
                                                          platformData]),
                          null,
                          Gio.DBusCallFlags.NONE, -1, null, function(c, res) {
                              try {
                                  c.call_finish(res);
                              } catch(e) {
                                  debug('ActivateApplication: ' + e);
                              }
                          });
}

export function dashedToCamelCase(name) {
    return name.replace(/(-.)/g, function(x) {
        return x[1].toUpperCase();
    });
}

export function getUIObject(res, ids) {
    let builder = new Gtk.Builder();
    builder.add_from_resource('/org/gnome/Maps/ui/' + res + '.ui');
    let ret = {};
    ids.forEach(function(id) {
        ret[dashedToCamelCase(id)] = builder.get_object(id);
    });
    return ret;
}

export function readFile(filename) {
    let status, buffer;
    let file = Gio.File.new_for_path(filename);
    try {
        [status, buffer] = file.load_contents(null);
    } catch (e) {
        return null;
    }
    if (status)
        return buffer;
    else
        return null;
}

export function writeFile(filename, buffer) {
    let file = Gio.File.new_for_path(filename);
    let status;
    try {
        status = file.replace_contents(buffer, null, false, 0, null)[0];
        return status;
    } catch (e) {
        return false;
    }
}

// only to be used by tests
var _overrideMeasurementSystem;

export function _setOverrideMeasurementSystem(measurementSystem) {
    _overrideMeasurementSystem = measurementSystem;
}

export function shouldShowImperialUnits() {
    const measurementSystemSetting =
        _overrideMeasurementSystem ??
        Settings.getSettings('org.gnome.Maps').get('measurement-system');

    switch (measurementSystemSetting) {
        case 'system':
            let locale = GLib.getenv('LC_MEASUREMENT') || GLib.get_language_names()[0];

            // Strip charset
            if (locale.indexOf('.') !== -1)
                locale = locale.substring(0, locale.indexOf('.'));

            if (IMPERIAL_LOCALES.indexOf(locale) === -1)
                return false;
            else
                return true;
        case 'metric':
            return false;
        case 'imperial':
            return true;
        default:
            return false;
    }
}

/**
 * Get the highest priority bare lange currently in use.
 */
export function getLanguage() {
    let locale = GLib.get_language_names()[0];
    // the last item returned is the "bare" language
    return GLib.get_locale_variants(locale).slice(-1)[0];
}

export function getAccuracyDescription(accuracy) {
    switch(accuracy) {
    case GeocodeGlib.LOCATION_ACCURACY_UNKNOWN:
        /* Translators: Accuracy of user location information */
        return _("Unknown");
    case 0:
        /* Translators: Accuracy of user location information */
        return _("Exact");
    default:
        return prettyDistance(accuracy);
    }
}

export function osmTypeToString(osmType) {
    switch(osmType) {
        case GeocodeGlib.PlaceOsmType.NODE: return 'node';
        case GeocodeGlib.PlaceOsmType.RELATION: return 'relation';
        case GeocodeGlib.PlaceOsmType.WAY: return 'way';
        default: return 'node';
    }
}

export function osmTypeFromString(osmType) {
    switch(osmType) {
        case 'node': return GeocodeGlib.PlaceOsmType.NODE;
        case 'relation': return GeocodeGlib.PlaceOsmType.RELATION;
        case 'way': return GeocodeGlib.PlaceOsmType.WAY;
        default: return GeocodeGlib.PlaceOsmType.UNKNOWN;
    }
}

/**
 * Return a formatted integer number with no
 * fraction, using locale-specific numerals
 */
export function formatLocaleInteger(n) {
    return _integerFormat.format(n);
}

/**
 * Return a formatted integer number with no
 * fraction, using locale-specific numerals using at least two digits
 * with possible leading 0, suitable for time rendering.
 */
export function formatLocaleIntegerMinimumTwoDigits(n) {
    return _integerTwoDigitFormat.format(n);
}

export function prettyTime(time) {
    let seconds = Math.floor(time / 1000);
    let minutes = Math.floor(seconds / 60);
    seconds = seconds % 60;
    let hours = Math.floor(minutes / 60);
    minutes = minutes % 60;

    let secondsStr = formatLocaleInteger(seconds);
    let minutesStr = formatLocaleInteger(minutes);
    let hoursStr = formatLocaleInteger(hours);

    if (hours > 0 && minutes === 0) {
        /* Translators: this is a duration with only hours, using
         * an abbreviation for hours, corresponding to 'h' in English
         */
        return _("%s h").format(hoursStr);
    } else if (hours > 0) {
        /* Translators: this is a duration with hours and minutes parts
         * using abbreviations for hours and minutes, corresponding to 'h'
         * and 'min' in English. The minutes has appropriate plural variations
         */
        return ngettext("%s h %s min", "%s h %s min",
                        minutes).format(hoursStr, minutesStr);
    } else if (minutes > 0) {
        /* Translators: this is a duration with minutes part
         * using abbreviation for minutes, corresponding to 'min' in English
         * with appropriate plural variations
         */
        return ngettext("%s min", "%s min", minutes).format(minutesStr);
    } else {
        /* Translators: this is a duration of less than one minute
         * with seconds using an abbreviation for seconds, corresponding to
         * 's' in English with appropriate plural forms
         */
        return ngettext("%s s", "%s s", seconds).format(secondsStr);
    }
}

export function prettyDistance(distance, noRound) {
    if (shouldShowImperialUnits()) {
        // Convert to feet
        distance = Math.round(distance * 3.2808399);
        if (distance >= 1056 && !noRound) {
            // Convert to miles when distance is more than 0.2 mi
            distance = Math.round(distance / 5280 * 10) / 10;
            /* Translators: This is a distance measured in miles */
            return _("%s mi").format(distance.toLocaleString());
        } else {
            /* Translators: This is a distance measured in feet */
            return _("%s ft").format(distance.toLocaleString());
        }
    } else {
        // round to whole meters
        distance = Math.round(distance);
        if (distance >= 1000 && !noRound) {
            distance = Math.round(distance / 1000 * 10) / 10;
            /* Translators: This is a distance measured in kilometers */
            return _("%s km").format(distance.toLocaleString());
        } else {
            /* Translators: This is a distance measured in meters */
            return _("%s m").format(distance.toLocaleString());
        }
    }
}

/**
 * Format a population number so that greater than or equal to a million and
 * evenly divisiable by 100k are displayed a locale-specific compact form
 * to handle estimated values without showing lots of zeros.
 * Other values are formatted in full.
 */
export function prettyPopulation(population) {
    let notation = population >= 1000000 && population % 100000 === 0 ?
                   'compact' : 'standard';

    return population.toLocaleString(undefined, { notation: notation });
}

export function uriSchemeSupported(scheme) {
    let apps = Gio.AppInfo.get_all();
    let prefix = 'x-scheme-handler/';

    for (let app of apps) {
        let types = app.get_supported_types();
        if (!types)
            continue;

        for (let type of types) {
            if (type.replace(prefix, '') === scheme)
                return true;
        }
    }
    return false;
}

export function normalizeString(string) {
    let normalized = GLib.utf8_normalize(string, -1, GLib.NormalizeMode.ALL);
    return normalized.replace(ACCENTS_REGEX, '');
}

export function showToastInOverlay(message, overlay) {
    let toast = new Adw.Toast({
        title: message,
    });

    overlay.add_toast(toast);
}

let decoder = new TextDecoder('utf-8');

/* Gets a string from either a ByteArray or Uint8Array. This is for
compatibility between two different Gjs versions, see discussion at
https://gitlab.gnome.org/GNOME/gnome-maps/merge_requests/19 */
export function getBufferText(buffer) {
    return decoder.decode(buffer);
}

export function getCountryCodeForCoordinates(lat, lon) {
    let location = GWeather.Location.new_detached('', null, lat, lon);

    return location.get_country();
}

/* Determines whether a URI is valid and its scheme is HTTP or HTTPS. */
export function isValidWebsite(website) {
    try {
        GLib.Uri.is_valid(website, GLib.UriFlags.NONE);
    } catch(e) {
        return false;
    }
    return website.startsWith("http://") || website.startsWith("https://");
}

/* Determine whether a string is a valid e-mail address. */
export function isValidEmail(email) {
    // if it starts with 'mailto:', it's probably a mistake copy-pasting a URI
    if (email.startsWith('mailto:'))
        return false;

    return email.match(EMAIL_REGEX) !== null;
}

/* Return string with first character in upper case according the rules
 * determined by the current locale
 */
export function firstToLocaleUpperCase(str) {
    return str[0].toLocaleUpperCase() + str.substring(1);
}

/* Splits string at first occurance of a character, leaving remaining
 * occurances of the separator in the second part
 */
export function splitAtFirst(string, separator) {
    let [first, ...rest] = string.split(separator);

    if (rest.length > 0) {
        rest = rest.join(separator);

        return [first, rest];
    } else {
        return [first];
    }
}

/**
 * Determines if left-hand road traffic is used in a given location.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @return {boolean} true if the given location has LHT
 */
export function isLefthandTrafficForCoordinates(latitude, longitude) {
    const country = getCountryCodeForCoordinates(latitude, longitude);

    return isLefthandTrafficForCountry(country);
}

/**
 * Determine if left-hand road traffic is used in a given country/region.
 *
 * @param {string} ISO country code
 * @return {boolean} true if the given location has LHT
 */
export function isLefthandTrafficForCountry(country) {
    return LHT_COUNTRIES.has(country);
}
