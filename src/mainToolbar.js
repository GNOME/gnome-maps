/*
 * Copyright (c) 2011 Red Hat, Inc.
 *
 * Gnome Documents is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 2 of the License, or (at your
 * option) any later version.
 *
 * Gnome Documents is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with Gnome Documents; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Cosimo Cecchi <cosimoc@redhat.com>
 *
 */

const Gd = imports.gi.Gd;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Geocode = imports.gi.GeocodeGlib;
const Champlain = imports.gi.Champlain;

const _ = imports.gettext.gettext;

const Lang = imports.lang;

const Application = imports.application;

const MainToolbar = new Lang.Class({
    Name: 'MainToolbar',

    _init: function(mainWindow) {
        this._model = null;
        this._mainWindow = mainWindow;

        this.widget = new Gd.MainToolbar();

        this._searchEntry = new Gd.TaggedEntry({ width_request: 500 });
        this._searchEntry.set_halign(Gtk.Align.CENTER);
        this._searchEntry.set_hexpand(true);
        this.widget.add_widget(this._searchEntry, true);
        this.widget.show_all();

        this._searchEntry.connect('activate', Lang.bind(this, this._onSearchActivate));

        this._markerLayer = new Champlain.MarkerLayer();
        this._mainWindow.view.add_layer(this._markerLayer);
    },

    _onSearchActivate: function() {
        let str = this._searchEntry.get_text();
        let forward = Geocode.Forward.new_for_string(str);
        this._markerLayer.remove_all();

        try {
            let locations = forward.search ();
            log (locations.length + " locations found");
            if (locations.length == 0)
                return;

            locations.forEach(Lang.bind(this,
                function(location) {
                    log ("location: " + location);
                    let marker = new Champlain.Label();
                    marker.set_text(location.description);
                    marker.set_location(location.latitude, location.longitude);
                    this._markerLayer.add_marker(marker);
                    log ("Added marker at " + location.latitude + ", " + location.longitude);
                }));
        } catch (e) {
            log ("Failed to search '" + str + "': " + e.message);
        }
    }
});
