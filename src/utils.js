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

let debugInit = false;
let debugEnabled = false;

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

function addJSSignalMethods(proto) {
    proto.connectJS = Signals._connect;
    proto.disconnectJS = Signals._disconnect;
    proto.emitJS = Signals._emit;
    proto.disconnectAllJS = Signals._disconnectAll;
}

function loadStyleSheet(file) {
    file = file || Gio.file_new_for_path(GLib.build_filenamev([pkg.pkgdatadir,
                                                               'application.css']));

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

function initActions(actionMap, simpleActionEntries) {
    simpleActionEntries.forEach(function(entry) {
        let action = new Gio.SimpleAction({ name: entry.name });

        if (entry.callback)
            action.connect('activate', Lang.bind(actionMap, entry.callback));

        actionMap.add_action(action);
    });
}

// accuracy: double value in meters
function getZoomLevelForAccuracy(accuracy) {
    if (accuracy == Geocode.LOCATION_ACCURACY_UNKNOWN)
        return 12; // Accuracy is usually city-level when unknown
    else if (accuracy <= Geocode.LOCATION_ACCURACY_STREET)
        return 16;
    else if (accuracy <= Geocode.LOCATION_ACCURACY_CITY)
        return 12;
    else if (accuracy <= Geocode.LOCATION_ACCURACY_REGION)
        return 10;
    else if (accuracy <= Geocode.LOCATION_ACCURACY_COUNTRY)
        return 6;
    else
        return 3;
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
