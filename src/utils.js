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

const GLib = imports.gi.GLib;
const Gdk = imports.gi.Gdk;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Geocode = imports.gi.GeocodeGlib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Signals = imports.signals;
const Soup = imports.gi.Soup;

const METRIC_SYSTEM = 1;
const IMPERIAL_SYSTEM = 2;

//List of locales using imperial system according to glibc locale database
const IMPERIAL_LOCALES = ['unm_US', 'es_US', 'es_PR', 'en_US', 'yi_US'];

let debugInit = false;
let debugEnabled = false;
let measurementSystem = null;

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

function addSignalMethods(proto) {
    Signals.addSignalMethods(proto);
    proto.once = once.bind(undefined, proto);
}

function loadStyleSheet(file) {
    let provider = new Gtk.CssProvider();
    provider.load_from_file(file);
    Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(),
                                             provider,
                                             Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
}

function clearGtkClutterActorBg(actor) {
    let widget = actor.get_widget();
    widget.override_background_color(0, new Gdk.RGBA({ red: 0,
                                                       green: 0,
                                                       blue: 0,
                                                       alpha: 0 }));
}

function addActions(actionMap, entries) {
    for(let name in entries) {
        let entry = entries[name];
        let action = createAction(name, entry);

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

function createAction(name, { state, paramType, onActivate, onChangeState }) {
    let entry = { name: name };

    if(Array.isArray(state)) {
        let [type, value] = state;
        entry.state = new GLib.Variant.new(type, value);
    }

    if(paramType !== undefined)
        entry.parameter_type = GLib.VariantType.new(paramType);

    let action = new Gio.SimpleAction(entry);

    if(onActivate)
        action.connect('activate', onActivate);
    if(onChangeState)
        action.connect('change-state', onChangeState);

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

    if (icon.file) {
        if (icon.file.has_uri_scheme ("http") || icon.file.has_uri_scheme ("https")) {
            _load_http_icon(icon, loadCompleteCallback);
            return;
        }
    }

    icon.load_async(-1, null, function(icon, res) {
        try {
            let stream = icon.load_finish(res, null)[0];
            let pixbuf = GdkPixbuf.Pixbuf.new_from_stream(stream, null);

            loadCompleteCallback(pixbuf);
        } catch(e) {
            log("Failed to load pixbuf: " + e);
            loadCompleteCallback(null);
        }
    });
}

function _load_http_icon(icon, loadCompleteCallback) {
    let msg = Soup.form_request_new_from_hash('GET', icon.file.get_uri(), {});
    let soup_session = _get_soup_session();

    soup_session.queue_message(msg, function(session, msg) {
        if (msg.status_code !== Soup.KnownStatusCode.OK) {
            log("Failed to load pixbuf: " + msg.reason_phrase);
            loadCompleteCallback(null);
            return;
        }

        let contents = msg.response_body.flatten().get_as_bytes();
        let stream = Gio.MemoryInputStream.new_from_data
                    (contents.get_data (null));
        try {
            let pixbuf = GdkPixbuf.Pixbuf.new_from_stream(stream, null);

            loadCompleteCallback(pixbuf);
        } catch(e) {
            log("Failed to load pixbuf: " + e);
            loadCompleteCallback(null);
        }
    });
}

let soup_session = null;
function _get_soup_session() {
    if (soup_session === null) {
        debug("Creating soup session...");
        soup_session = new Soup.Session ();
        debug("Created soup session");
    }

    return soup_session;
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

function prettyTime(time) {
    let seconds = Math.floor(time / 1000);
    let minutes = Math.floor(seconds / 60);
    seconds = seconds % 60;
    let hours = Math.floor(minutes / 60);
    minutes = minutes % 60;

    let labelledTime = "";
    if (hours > 0)
        labelledTime += _("%f h").format(hours)+' ';
    if (minutes > 0)
        labelledTime += _("%f min").format(minutes);
    if (hours === 0 && minutes === 0)
        labelledTime = _("%f s").format(seconds);
    return labelledTime;
}

function prettyDistance(distance, noRound) {
    distance = Math.round(distance);

    if (getMeasurementSystem() === METRIC_SYSTEM){
        if (distance >= 1000 && !noRound) {
            distance = Math.round(distance / 1000 * 10) / 10;
            /* Translators: This is a distance measured in kilometers */
            return _("%f km").format(distance);
        } else
            /* Translators: This is a distance measured in meters */
            return _("%f m").format(distance);
    } else {
        // Convert to feet
        distance = Math.round(distance * 3.2808399);
        if (distance >= 1056 && !noRound) {
            // Convert to miles when distance is more than 0.2 mi
            distance = Math.round(distance / 5280 * 10) / 10;
            /* Translators: This is a distance measured in miles */
            return _("%f mi").format(distance);
        } else
            /* Translators: This is a distance measured in feet */
            return _("%f ft").format(distance);
    }
}

function uriSchemeSupported(scheme) {
    let apps = Gio.AppInfo.get_all();
    let prefix = 'x-scheme-handler/';

    for (let i in apps) {
        let types = apps[i].get_supported_types();
        if (!types)
            continue;

        for (let j in types) {
            if (types[j].replace(prefix, '') === scheme)
                return true;
        }
    }
    return false;
}
