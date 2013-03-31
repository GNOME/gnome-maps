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

        this._entry = new Gd.TaggedEntry({ width_request: 500 });
        this._entry.show();

        this._entry.connect('activate', Lang.bind(this, this._onSearchActivate));

        this.widget = new Gd.HeaderBar();
        this.widget.set_custom_title(this._entry);
    },

    _onSearchActivate: function() {
        let string = this._entry.get_text();

        this._mainWindow.mapView.geocodeSearch(string);
    },
});
