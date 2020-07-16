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

const _ = imports.gettext.gettext;
const ngettext = imports.gettext.ngettext;

const GLib = imports.gi.GLib;
const Gdk = imports.gi.Gdk;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Geocode = imports.gi.GeocodeGlib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
// TODO: GWeather for GTK 4?
//const GWeather = imports.gi.GWeather;
const Soup = imports.gi.Soup;
const ByteArray = imports.byteArray;

var METRIC_SYSTEM = 1;
var IMPERIAL_SYSTEM = 2;

//List of locales using imperial system according to glibc locale database
const IMPERIAL_LOCALES = ['unm_US', 'es_US', 'es_PR', 'en_US', 'yi_US'];

// Matches all unicode stand-alone accent characters
const ACCENTS_REGEX = /[\u0300-\u036F]/g;

const _integerFormat = new Intl.NumberFormat([], { maximumFractionDigits: 0 });
const _integerTwoDigitFormat =
    new Intl.NumberFormat([], { minimumIntegerDigits: 2,
                                maximumFractionDigits: 0 });

let debugInit = false;
let measurementSystem = null;

var debugEnabled = false;

function debug(msg) {
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
function once(obj, signal, callback) {
    let id = obj.connect(signal, function() {
        obj.disconnect(id);
        callback();
    });
}

function loadStyleSheet(file) {
    let provider = new Gtk.CssProvider();
    provider.load_from_file(file);
    Gtk.StyleContext.add_provider_for_display(Gdk.Display.get_default(),
                                              provider,
                                              Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
}

function addActions(actionMap, entries, settings = null) {
    for(let name in entries) {
        let entry = entries[name];
        let action = createAction(name, entry, settings);

        actionMap.add_action(action);

        if(entry.accels)
            setAccelsForActionMap(actionMap, name, entry.accels);
    }
}

function setAccelsForActionMap(actionMap, actionName, accels) {
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

function activateAction(appId, action, parameter, timestamp) {
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

function dashedToCamelCase(name) {
    return name.replace(/(-.)/g, function(x) {
        return x[1].toUpperCase();
    });
}

function getUIObject(res, ids) {
    let builder = new Gtk.Builder();
    builder.add_from_resource('/org/gnome/Maps/ui/' + res + '.ui');
    let ret = {};
    ids.forEach(function(id) {
        ret[dashedToCamelCase(id)] = builder.get_object(id);
    });
    return ret;
}

function readFile(filename) {
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

function writeFile(filename, buffer) {
    let file = Gio.File.new_for_path(filename);
    let status;
    try {
        status = file.replace_contents(buffer, null, false, 0, null)[0];
        return status;
    } catch (e) {
        return false;
    }
}

function getMeasurementSystem() {
    if (measurementSystem)
        return measurementSystem;

    let locale = GLib.getenv('LC_MEASUREMENT') || GLib.get_language_names()[0];

    // Strip charset
    if (locale.indexOf('.') !== -1)
        locale = locale.substring(0, locale.indexOf('.'));

    if (IMPERIAL_LOCALES.indexOf(locale) === -1)
        measurementSystem = METRIC_SYSTEM;
    else
        measurementSystem = IMPERIAL_SYSTEM;

    return measurementSystem;
}

/**
 * Get the higest priority bare lange currently in use.
 */
function getLanguage() {
    let locale = GLib.get_language_names()[0];
    // the last item returned is the "bare" language
    return GLib.get_locale_variants(locale).slice(-1)[0];
}

function getAccuracyDescription(accuracy) {
    switch(accuracy) {
    case Geocode.LOCATION_ACCURACY_UNKNOWN:
        /* Translators: Accuracy of user location information */
        return _("Unknown");
    case 0:
        /* Translators: Accuracy of user location information */
        return _("Exact");
    default:
        return prettyDistance(accuracy);
    }
}

function load_icon(icon, size, loadCompleteCallback) {
    if (icon instanceof Gio.FileIcon || icon instanceof Gio.BytesIcon) {
        _load_icon(icon, loadCompleteCallback);
    } else if (icon instanceof Gio.ThemedIcon) {
        _load_themed_icon(icon, size, loadCompleteCallback);
    }
}

function _load_icon(icon, loadCompleteCallback) {
    icon.load_async(-1, null, function(icon, res) {
        try {
            let stream = icon.load_finish(res)[0];
            let pixbuf = GdkPixbuf.Pixbuf.new_from_stream(stream, null);

            loadCompleteCallback(pixbuf);
        } catch(e) {
            log("Failed to load pixbuf: " + e);
            loadCompleteCallback(null);
        }
    });
}

function _load_themed_icon(icon, size, loadCompleteCallback) {
    let theme = Gtk.IconTheme.get_default();
    let info = theme.lookup_by_gicon(icon, size, 0);

    try {
        let pixbuf = info.load_icon();
        loadCompleteCallback(pixbuf);
    } catch(e) {
        log("Failed to load pixbuf: " + e);
    }
}

function osmTypeToString(osmType) {
    switch(osmType) {
        case Geocode.PlaceOsmType.NODE: return 'node';
        case Geocode.PlaceOsmType.RELATION: return 'relation';
        case Geocode.PlaceOsmType.WAY: return 'way';
        default: return 'node';
    }
}

/**
 * Return a formatted integer number with no
 * fraction, using locale-specific numerals
 */
function formatLocaleInteger(n) {
    return _integerFormat.format(n);
}

/**
 * Return a formatted integer number with no
 * fraction, using locale-specific numerals using at least two digits
 * with possible leading 0, suitable for time rendering.
 */
function formatLocaleIntegerMinimumTwoDigits(n) {
    return _integerTwoDigitFormat.format(n);
}

function prettyTime(time) {
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
         * using abbreviations for hours and minutes, correspoding to 'h'
         * and 'min' in English. The minutes has appropriate plural variations
         */
        return ngettext("%s h %s min", "%s h %s mins",
                        minutes).format(hoursStr, minutesStr);
    } else if (minutes > 0) {
        /* Translators: this is a duration with minutes part
         * using abbreviation for minutes, corresponding to 'min' in English
         * with appropriate plural variations
         */
        return ngettext("%s min", "%s mins", minutes).format(minutesStr);
    } else {
        /* Translators: this is a duration of less than one minute
         * with seconds using an abbreviation for seconds, corresponding to
         * 's' in English with appropriate plural forms
         */
        return ngettext("%s s", "%s s", seconds).format(secondsStr);
    }
}

function prettyDistance(distance, noRound) {
    if (getMeasurementSystem() === METRIC_SYSTEM) {
        // round to whole meters
        distance = Math.round(distance);
        if (distance >= 1000 && !noRound) {
            distance = Math.round(distance / 1000 * 10) / 10;
            /* Translators: This is a distance measured in kilometers */
            return _("%s km").format(distance.toLocaleString());
        } else
            /* Translators: This is a distance measured in meters */
            return _("%s m").format(distance.toLocaleString());
    } else {
        // Convert to feet
        distance = Math.round(distance * 3.2808399);
        if (distance >= 1056 && !noRound) {
            // Convert to miles when distance is more than 0.2 mi
            distance = Math.round(distance / 5280 * 10) / 10;
            /* Translators: This is a distance measured in miles */
            return _("%s mi").format(distance.toLocaleString());
        } else
            /* Translators: This is a distance measured in feet */
            return _("%s ft").format(distance.toLocaleString());
    }
}

function uriSchemeSupported(scheme) {
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

function normalizeString(string) {
    let normalized = GLib.utf8_normalize(string, -1, GLib.NormalizeMode.ALL);
    return normalized.replace(ACCENTS_REGEX, '');
}

function isUsingDarkThemeVariant() {
    let gtkSettings = Gtk.Settings.get_default();

    return gtkSettings.gtk_application_prefer_dark_theme;
}

function isUsingHighContrastTheme() {
    let gtkSettings = Gtk.Settings.get_default();
    let themeName = gtkSettings.gtk_theme_name;

    return themeName === 'HighContrast' || themeName === 'HighContrastInverse';
}

function showDialog(msg, type, transientFor) {
    let messageDialog =
        new Gtk.MessageDialog({ transient_for: transientFor,
                                destroy_with_parent: true,
                                message_type: type,
                                buttons: Gtk.ButtonsType.OK,
                                modal: true,
                                text: msg });

    messageDialog.connect('response', () => messageDialog.destroy());
    messageDialog.show_all();
}

/* Gets a string from either a ByteArray or Uint8Array. This is for
compatibility between two different Gjs versions, see discussion at
https://gitlab.gnome.org/GNOME/gnome-maps/merge_requests/19 */
function getBufferText(buffer) {
    if (buffer instanceof Uint8Array) {
        return ByteArray.toString(buffer);
    } else {
        return buffer.toString();
    }
}

function getCountryCodeForCoordinates(lat, lon) {
    let location = GWeather.Location.new_detached('', null, lat, lon);

    return location.get_country();
}

