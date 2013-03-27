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

        this._markerLayer = new Champlain.MarkerLayer();
        this._markerLayer.set_selection_mode(Champlain.SelectionMode.SINGLE);
        this._mainWindow.view.add_layer(this._markerLayer);
    },

    _onSearchActivate: function() {
        let str = this._entry.get_text();
        let forward = Geocode.Forward.new_for_string(str);
        this._markerLayer.remove_all();


        forward.search_async (null, Lang.bind(this, this._onSearchComplete));
    },

    _onSearchComplete: function(forward, res) {
        let locations = [];

        try {
            locations = forward.search_finish(res);
        } catch (e) {
            log ("Failed to search '" + str + "': " + e.message);
            return;
        }
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

        if (locations.length == 1)
            this._mainWindow.view.go_to(locations[0].latitude, locations[0].longitude);
        else {
            let min_latitude = 90;
            let max_latitude = -90;
            let min_longitude = 180;
            let max_longitude = -180;

            locations.forEach(Lang.bind(this,
                function(location) {
                    if (location.latitude > max_latitude)
                        max_latitude = location.latitude;
                    if (location.latitude < min_latitude)
                        min_latitude = location.latitude;
                    if (location.longitude > max_longitude)
                        max_longitude = location.longitude;
                    if (location.longitude < min_longitude)
                        min_longitude = location.longitude;
                }));

            let bbox = new Champlain.BoundingBox();
            bbox.left = min_longitude;
            bbox.right = max_longitude;
            bbox.bottom = min_latitude;
            bbox.top = max_latitude;

            this._mainWindow.view.ensure_visible(bbox, true);
        }
    }
});
