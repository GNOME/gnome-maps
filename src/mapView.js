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
const Cogl = imports.gi.Cogl;
const Gdk = imports.gi.Gdk;
const GdkPixbuf = imports.gi.GdkPixbuf;
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
const Path = imports.path;
const MapLocation = imports.mapLocation;
const UserLocation = imports.userLocation;
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
        this.view = this.actor;

        this._properties = new Properties.Properties(this);
        this.view.bin_layout_add(this._properties.actor,
                                 Clutter.BinAlignment.FILL,
                                 Clutter.BinAlignment.FILL);

        this._markerLayer = new Champlain.MarkerLayer();
        this._markerLayer.set_selection_mode(Champlain.SelectionMode.SINGLE);
        this.view.add_layer(this._markerLayer);

        this._userLocationLayer = new Champlain.MarkerLayer();
        this._userLocationLayer.set_selection_mode(Champlain.SelectionMode.SINGLE);
        this.view.add_layer(this._userLocationLayer);

        this._factory = Champlain.MapSourceFactory.dup_default();
        this.setMapType(MapType.STREET);

        this._showUserLocation();
    },

    setMapType: function(mapType) {
        let source = this._factory.create_cached_source(mapType);
        this.view.set_map_source(source);
    },

    geocodeSearch: function(string) {
        let forward = Geocode.Forward.new_for_string(string);

        forward.search_async (null, Lang.bind(this,
            function(forward, res) {
                try {
                    let locations = forward.search_finish(res);
                    log (locations.length + " locations found");
                    let mapLocations = new Array();
                    locations.forEach(Lang.bind(this,
                        function(location) {
                            let mapLocation = new MapLocation.MapLocation(location, this);
                            mapLocations.push(mapLocation);
                        }));
                    this._showLocations(mapLocations);
                } catch (e) {
                    log ("Failed to search '" + string + "': " + e.message);
                }
            }));
    },

    ensureVisible: function(locations) {
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

        this.view.ensure_visible(bbox, true);
    },

    _showUserLocation: function() {
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

            this._userLocation = new UserLocation.UserLocation(location, this);
            this._userLocation.show(this._userLocationLayer);
        }

        let ipclient = new Geocode.Ipclient();
        ipclient.server = "http://freegeoip.net/json/";
        ipclient.compatibility_mode = true;
        ipclient.search_async(null, Lang.bind(this,
            function(ipclient, res) {
                try {
                    let location = ipclient.search_finish(res);

                    this._userLocation = new UserLocation.UserLocation(location, this);
                    this._userLocation.show(this._userLocationLayer);

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
                location.show(this._markerLayer);
            }));

        if (locations.length == 1)
            locations[0].goTo(true);
        else
            this.ensureVisible(locations);
    },
});
