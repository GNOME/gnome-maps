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
 * with GNOME Maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Cosimo Cecchi <cosimoc@redhat.com>
 *         Zeeshan Ali (Khattak) <zeeshanak@gnome.org>
 */

const Lang = imports.lang;
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Signals = imports.signals;
const Geocode = imports.gi.GeocodeGlib;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Clutter = imports.gi.Clutter;
const Cogl = imports.gi.Cogl;
const Soup = imports.gi.Soup;

const _ = imports.gettext.gettext;

let debugInit = false;
let debugEnabled = false;

let _iconStore = {};

function debug(str) {
    if (!debugInit) {
        let env = GLib.getenv('MAPS_DEBUG');
        if (env)
            debugEnabled = true;

        debugInit = true;
    }

    if (debugEnabled)
        log('DEBUG: ' + str);
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

function initActions(actionMap, simpleActionEntries, context) {
    simpleActionEntries.forEach(function(entry) {
        let action = new Gio.SimpleAction(entry.properties);

        for(let signalHandler in entry.signalHandlers) {
            let callback = entry.signalHandlers[signalHandler];
            action.connect(signalHandler, callback.bind(context));
        }

        actionMap.add_action(action);
    });
}



function CreateActorFromImageFile(path) {
    try {
        let pixbuf = GdkPixbuf.Pixbuf.new_from_file(path);
        let image = new Clutter.Image();
        image.set_data(pixbuf.get_pixels(),
                       Cogl.PixelFormat.RGBA_8888,
                       pixbuf.get_width(),
                       pixbuf.get_height(),
                       pixbuf.get_rowstride());

        let actor = new Clutter.Actor();
        actor.set_content(image);
        actor.set_size(pixbuf.get_width(), pixbuf.get_height());

        return actor;
    } catch(e) {
        log("Failed to load image: " + e.message);
        return null;
    }
}

function dashedToCamelCase(name) {
    return name.replace(/(-.)/g, function(x) {
        return x[1].toUpperCase();
    });
}

function getUIObject(res, ids) {
    let builder = new Gtk.Builder();
    builder.add_from_resource('/org/gnome/maps/' + res + '.ui');
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

function load_icon(icon, size, loadCompleteCallback) {
    if (icon instanceof Gio.FileIcon) {
        _load_file_icon(icon, loadCompleteCallback);
    } else if (icon instanceof Gio.ThemedIcon) {
        _load_themed_icon(icon, size, loadCompleteCallback);
    }
}

function _load_file_icon(icon, loadCompleteCallback) {
    let pixbuf = _iconStore[icon.file.get_uri()];

    if (pixbuf) { // check if the icon is cached
        loadCompleteCallback(pixbuf);
        return;
    }

    if (icon.file.has_uri_scheme ("http") || icon.file.has_uri_scheme ("https")) {
        _load_http_icon(icon, loadCompleteCallback);
        return;
    }

    icon.load_async(-1, null, function(icon, res) {
        try {
            let stream = icon.load_finish(res, null)[0];

            pixbuf =
                GdkPixbuf.Pixbuf.new_from_stream(stream, null);

            _iconStore[icon.file.get_uri()] = pixbuf;
            loadCompleteCallback(pixbuf);
        } catch(e) {
            log("Failed to load pixbuf: " + e);
        }
    });
}

function _load_http_icon(icon, loadCompleteCallback) {
    let msg = Soup.form_request_new_from_hash('GET', icon.file.get_uri(), {});
    let soup_session = _get_soup_session();

    soup_session.queue_message(msg, function(session, msg) {
        if (msg.status_code != Soup.KnownStatusCode.OK) {
            log("Failed to load pixbuf: " + msg.reason_phrase);
            return;
        }

        let contents = msg.response_body.flatten().get_as_bytes();
        let stream = Gio.MemoryInputStream.new_from_data
                    (contents.get_data (null));
        try {
            let pixbuf = GdkPixbuf.Pixbuf.new_from_stream(stream, null);

            _iconStore[icon.file.get_uri()] = pixbuf;
            loadCompleteCallback(pixbuf);
        } catch(e) {
            log("Failed to load pixbuf: " + e);
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
    let flags = Gtk.IconLookupFlags.GENERIC_FALLBACK;
    let info = theme.lookup_by_gicon(icon, size, flags);

    try {
        let pixbuf = info.load_icon();
        loadCompleteCallback(pixbuf);
    } catch(e) {
        log("Failed to load pixbuf: " + e);
    }
}
