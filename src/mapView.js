/*
 * Copyright (c) 2011, 2012, 2013 Red Hat, Inc.
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
 * Author: Zeeshan Ali (Khattak) <zeeshanak@gnome.org>
 */

const Clutter = imports.gi.Clutter;
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const GtkChamplain = imports.gi.GtkChamplain;
const Champlain = imports.gi.Champlain;
const Geocode = imports.gi.GeocodeGlib;

const Lang = imports.lang;
const Mainloop = imports.mainloop;

const Application = imports.application;
const Properties = imports.properties;
const Utils = imports.utils;
const _ = imports.gettext.gettext;

const MapType = {
   STREET:  Champlain.MAP_SOURCE_OSM_MAPQUEST,
   AERIAL: Champlain.MAP_SOURCE_OSM_AERIAL_MAP,
   CYCLING: Champlain.MAP_SOURCE_OSM_CYCLE_MAP,
   TRANSIT: Champlain.MAP_SOURCE_OSM_TRANSPORT_MAP
}

const MapView = new Lang.Class({
    Name: 'MapView',
    Extends: GtkChamplain.Embed,

    _init: function(app) {
        this.parent();

        this.actor = this.get_view();
        this._view = this.actor;

        this._properties = new Properties.Properties(this);
        this._view.bin_layout_add(this._properties.actor,
                                  Clutter.BinAlignment.FILL,
                                  Clutter.BinAlignment.FILL);

        this._markerLayer = new Champlain.MarkerLayer();
        this._markerLayer.set_selection_mode(Champlain.SelectionMode.SINGLE);
        this._view.add_layer(this._markerLayer);

        this._factory = Champlain.MapSourceFactory.dup_default();
        this.setMapType(MapType.STREET);

        this._gotoUserLocation();
    },

    setMapType: function(mapType) {
        let source = this._factory.create_cached_source(mapType);
        this._view.set_map_source(source);
    },

    geocodeSearch: function(string) {
        let forward = Geocode.Forward.new_for_string(string);

        forward.search_async (null, Lang.bind(this,
            function(forward, res) {
                try {
                    let locations = forward.search_finish(res);
                    log (locations.length + " locations found");
                    this._showLocations(locations);
                } catch (e) {
                    log ("Failed to search '" + string + "': " + e.message);
                }
            }));
    },

    _gotoLocation: function(location, animate) {
        log(location.description);

        let zoom = Utils.getZoomLevelForAccuracy(location.accuracy);

        if (!animate) {
            this._view.center_on(location.latitude, location.longitude);
            this._view.set_zoom_level(zoom);

            return;
        }

        /* Lets first ensure that both current and destination location are visible
         * before we start the animated journey towards destination itself. We do this
         * to create the zoom-out-then-zoom-in effect that many map implementations
         * do. This not only makes the go-to animation look a lot better visually but
         * also give user a good idea of where the destination is compared to current
         * location.
         */
        let locations = new Array();
        locations[0] = new Geocode.Location({ latitude: this._view.get_center_latitude(),
                                              longitude: this._view.get_center_longitude() });
        locations[1] = location;
        this._ensureVisible(locations);

        let anim_completed_id = this._view.connect("animation-completed::go-to", Lang.bind(this,
            function() {
                // Apparently the signal is called before animation is really complete so if we don't
                // zoom in idle, we get a crash. Perhaps a bug in libchamplain?
                Mainloop.idle_add(Lang.bind(this,
                    function() {
                        this._view.set_zoom_level(zoom);
                    }));
                this._view.disconnect(anim_completed_id);
            }));
        this._view.go_to(location.latitude, location.longitude);
    },

    _gotoUserLocation: function () {
        let lastLocation = Application.settings.get_value('last-location');
        if (lastLocation.n_children() >= 3) {
            let lat = lastLocation.get_child_value(0);
            let lng = lastLocation.get_child_value(1);
            let accuracy = lastLocation.get_child_value(2);

            let location = new Geocode.Location({ latitude: lat.get_double(),
                                                  longitude: lng.get_double(),
                                                  accuracy: accuracy.get_double() });
            let lastLocationDescription = Application.settings.get_string('last-location-description');
            location.set_description(lastLocationDescription);

            this._gotoLocation(location, false);
        }

        let ipclient = new Geocode.Ipclient();
        ipclient.server = "http://freegeoip.net/json/";
        ipclient.compatibility_mode = true;
        ipclient.search_async(null, Lang.bind(this,
            function(ipclient, res) {
                try {
                    let location = ipclient.search_finish(res);

                    this._gotoLocation(location, true);

                    let variant = GLib.Variant.new('ad', [location.latitude, location.longitude, location.accuracy]);
                    Application.settings.set_value('last-location', variant);
                    Application.settings.set_string('last-location-description', location.description);
                } catch (e) {
                    log("Failed to find your location: " + e);
                }
            }));
    },

    _showLocations: function(locations) {
        if (locations.length == 0)
            return;
        this._markerLayer.remove_all();

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
            this._gotoLocation(locations[0], true);
        else
            this._ensureVisible(locations);
    },

    _ensureVisible: function(locations) {
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

        this._view.ensure_visible(bbox, true);
    }
});
