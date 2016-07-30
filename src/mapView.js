/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
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
const Gtk = imports.gi.Gtk;
const GtkChamplain = imports.gi.GtkChamplain;
const Champlain = imports.gi.Champlain;
const Geocode = imports.gi.GeocodeGlib;

const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Signals = imports.signals;

const Application = imports.application;
const Sidebar = imports.sidebar;
const Utils = imports.utils;
const Path = imports.path;
const MapLocation = imports.mapLocation;
const MapSource = imports.mapSource;
const UserLocation = imports.userLocation;
const Geoclue = imports.geoclue;
const _ = imports.gettext.gettext;

const MapType = {
    STREET: 'MapsStreetSource',
    AERIAL: 'MapsAerialSource'
};

const MapMinZoom = 2;

const MapView = new Lang.Class({
    Name: 'MapView',
    Extends: GtkChamplain.Embed,

    _init: function() {
        this.parent();

        this.actor = this.get_view();
        this.view = this.actor;
        this.view.set_zoom_level(3);
        this.view.min_zoom_level = MapMinZoom;
        this.view.goto_animation_mode = Clutter.AnimationMode.EASE_IN_OUT_CUBIC;
        this.view.set_reactive(true);

        this.view.connect('notify::latitude', this._onViewMoved.bind(this));
        this.view.connect('notify::longitude', this._onViewMoved.bind(this));

        this._sidebar = new Sidebar.Sidebar(this);
        // Don't show sidebar until it has something in it
        //this.view.add_child(this._sidebar.actor);

        this._markerLayer = new Champlain.MarkerLayer();
        this._markerLayer.set_selection_mode(Champlain.SelectionMode.SINGLE);
        this.view.add_layer(this._markerLayer);

        this._userLocationLayer = new Champlain.MarkerLayer();
        this._userLocationLayer.set_selection_mode(Champlain.SelectionMode.SINGLE);
        this.view.add_layer(this._userLocationLayer);

        // switching map type will set view min-zoom-level from map source
        this.view.connect('notify::min-zoom-level', (function() {
            if (this.view.min_zoom_level < MapMinZoom) {
                this.view.min_zoom_level = MapMinZoom;
            }
        }).bind(this));

        this.setMapType(MapType.STREET);


        this.geoclue = new Geoclue.Geoclue();
        this._updateUserLocation();
        this.geoclue.connect("location-changed",
                             this._updateUserLocation.bind(this));
    },

    setMapType: function(mapType) {
        if (mapType === MapType.AERIAL)
            this.view.map_source = MapSource.createAerialSource();
        else
            this.view.map_source = MapSource.createStreetSource();
    },

    geocodeSearch: function(searchString, searchCompleteCallback) {
        let forward = Geocode.Forward.new_for_string(searchString);
        let places = [];
        let answerCount = Application.settings.get('max-search-results');
        let bbox = this.view.get_bounding_box();

        forward.search_area = new Geocode.BoundingBox({
            top: bbox.top,
            left: bbox.left,
            bottom: bbox.bottom,
            right: bbox.right
        });
        forward.bounded = false;
        forward.set_answer_count(answerCount);
        forward.search_async (null, (function(forward, res) {
            try {
                places = forward.search_finish(res);
            } catch (e) {
                places = null;
            }
            searchCompleteCallback(places);
        }).bind(this));
    },

    ensureLocationsVisible: function(locations) {
        let bbox = new Champlain.BoundingBox({ left:   180,
                                               right: -180,
                                               bottom:  90,
                                               top:    -90 });

        locations.forEach(function(location) {
            bbox.left   = Math.min(bbox.left,   location.longitude);
            bbox.right  = Math.max(bbox.right,  location.longitude);
            bbox.bottom = Math.min(bbox.bottom, location.latitude);
            bbox.top    = Math.max(bbox.top,    location.latitude);
        });
        this.view.ensure_visible(bbox, true);
    },

    gotoUserLocation: function(animate) {
        this.emit('going-to-user-location');
        this._userLocation.once("gone-to", (function() {
            this.emit('gone-to-user-location');
        }).bind(this));
        this._userLocation.goTo(animate);
    },

    userLocationVisible: function() {
        let box = this.view.get_bounding_box();

        return box.covers(this._userLocation.latitude, this._userLocation.longitude);
    },

    _updateUserLocation: function() {
        if (!this.geoclue.location)
            return;

        let place = Geocode.Place.new_with_location(this.geoclue.location.description,
                                                    Geocode.PlaceType.UNKNOWN,
                                                    this.geoclue.location);

        this._userLocation = new UserLocation.UserLocation(place, this);
        this._userLocation.show(this._userLocationLayer);
        this.emit('user-location-changed');
    },

    showLocation: function(place) {
        this._markerLayer.remove_all();
        let mapLocation = new MapLocation.MapLocation(place, this);

        mapLocation.show(this._markerLayer);

        return mapLocation;
    },

    showNGotoLocation: function(place) {
        let mapLocation = this.showLocation(place);
        mapLocation.goTo(true);
    },

    _onViewMoved: function() {
        this.emit('view-moved');
    }
});
Utils.addSignalMethods(MapView.prototype);
