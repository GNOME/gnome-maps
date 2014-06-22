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
const Utils = imports.utils;
const Path = imports.path;
const MapLocation = imports.mapLocation;
const MapWalker = imports.mapWalker;
const UserLocation = imports.userLocation;
const _ = imports.gettext.gettext;

const MapType = {
    STREET:  Champlain.MAP_SOURCE_OSM_MAPQUEST,
    AERIAL:  Champlain.MAP_SOURCE_OSM_AERIAL_MAP,
    CYCLING: Champlain.MAP_SOURCE_OSM_CYCLE_MAP,
    TRANSIT: Champlain.MAP_SOURCE_OSM_TRANSPORT_MAP
};

const MapMinZoom = 2;

const MapView = new Lang.Class({
    Name: 'MapView',
    Extends: GtkChamplain.Embed,

    _init: function() {
        this.parent();

        this.view = this._initView();
        this._initLayers();

        this._factory = Champlain.MapSourceFactory.dup_default();
        this.setMapType(MapType.STREET);

        this._updateUserLocation();
        Application.geoclue.connect("location-changed",
                                    this._updateUserLocation.bind(this));

        this._connectRouteSignals(Application.routeService.route);
    },

    _initView: function() {
        let view = this.get_view();
        view.zoom_level = 3;
        view.min_zoom_level = MapMinZoom;
        view.goto_animation_mode = Clutter.AnimationMode.EASE_IN_OUT_CUBIC;
        view.reactive = true;
        view.kinetic_mode = true;

        view.connect('notify::latitude', this._onViewMoved.bind(this));
        view.connect('notify::longitude', this._onViewMoved.bind(this));
        // switching map type will set view min-zoom-level from map source
        view.connect('notify::min-zoom-level', (function() {
            if (view.min_zoom_level < MapMinZoom) {
                view.min_zoom_level = MapMinZoom;
            }
        }).bind(this));
        return view;
    },

    _initLayers: function() {
        this._routeLayer = new Champlain.PathLayer({ stroke_width: 2.0 });
        this.view.add_layer(this._routeLayer);

        let mode = Champlain.SelectionMode.SINGLE;
        this._markerLayer = new Champlain.MarkerLayer({ selection_mode: mode });
        this.view.add_layer(this._markerLayer);

        this._userLocationLayer = new Champlain.MarkerLayer({ selection_mode: mode });
        this.view.add_layer(this._userLocationLayer);
    },

    _connectRouteSignals: function(route) {
        route.connect('update', this.showRoute.bind(this, route));
        route.connect('reset', this._routeLayer.remove_all.bind(this._routeLayer));
    },

    setMapType: function(mapType) {
        if (this.view.map_source.id === mapType)
            return;

        let source = this._factory.create_cached_source(mapType);
        this.view.map_source = source;
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
        if (!Application.geoclue)
            return;

        let location = Application.geoclue.location;

        if (!location)
            return;

        let place = Geocode.Place.new_with_location(location.description,
                                                    Geocode.PlaceType.UNKNOWN,
                                                    location);

        let selected = this._userLocation && this._userLocation.getSelected();
        this._userLocation = new UserLocation.UserLocation(place, this);
        this._userLocation.show(this._userLocationLayer);
        this._userLocation.setSelected(selected);
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

    showRoute: function(route) {
        this._routeLayer.remove_all();

        route.path.forEach(this._routeLayer.add_node.bind(this._routeLayer));

        let [lat, lon] = route.bbox.get_center();
        let place = new Geocode.Place({
            location     : new Geocode.Location({ latitude  : lat,
                                                  longitude : lon }),
            bounding_box : new Geocode.BoundingBox({ top    : route.bbox.top,
                                                     bottom : route.bbox.bottom,
                                                     left   : route.bbox.left,
                                                     right  : route.bbox.right })
        });

        new MapWalker.MapWalker(place, this).goTo(true);
    },

    _onViewMoved: function() {
        this.emit('view-moved');
    },

    onSetMarkerSelected: function(selectedMarker) {
        this.emit('marker-selected', selectedMarker);
    }
});
Utils.addSignalMethods(MapView.prototype);
