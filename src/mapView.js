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

const Champlain = imports.gi.Champlain;
const Clutter = imports.gi.Clutter;
const GObject = imports.gi.GObject;
const Geocode = imports.gi.GeocodeGlib;
const GtkChamplain = imports.gi.GtkChamplain;
const Lang = imports.lang;

const Application = imports.application;
const MapWalker = imports.mapWalker;
const SearchResultMarker = imports.searchResultMarker;
const TurnPointMarker = imports.turnPointMarker;
const UserLocationMarker = imports.userLocationMarker;
const Utils = imports.utils;

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
    Properties: {
        'routeVisible': GObject.ParamSpec.boolean('routeVisible',
                                                   'Route visible',
                                                   'Visibility of route layers',
                                                   GObject.ParamFlags.READABLE |
                                                   GObject.ParamFlags.WRITABLE,
                                                   false)
    },

    get routeVisible() {
        return this._routeLayer.visible || this._instructionMarkerLayer.visible;
    },

    set routeVisible(value) {
        let isValid = Application.routeService.query.isValid();

        this._routeLayer.visible = value && isValid;
        this._instructionMarkerLayer.visible = value && isValid;
        this.notify('routeVisible');
    },

    _init: function() {
        this.parent();

        this.view = this._initView();
        this._initLayers();

        this._factory = Champlain.MapSourceFactory.dup_default();
        this.setMapType(MapType.STREET);

        this._updateUserLocation();
        Application.geoclue.connect("location-changed",
                                    this._updateUserLocation.bind(this));

        this._connectRouteSignals();
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
        // Switching map type will set view min-zoom-level from map source
        view.connect('notify::min-zoom-level', (function() {
            if (view.min_zoom_level < MapMinZoom) {
                view.min_zoom_level = MapMinZoom;
            }
        }).bind(this));
        return view;
    },

    _initLayers: function() {
        let color = new Clutter.Color({ red: 0,
                                        blue: 255,
                                        green: 0,
                                        alpha: 100 });
        this._routeLayer = new Champlain.PathLayer({ stroke_width: 5.0,
                                                     stroke_color: color });
        this.view.add_layer(this._routeLayer);

        let mode = Champlain.SelectionMode.SINGLE;
        this._searchResultLayer =
            new Champlain.MarkerLayer({ selection_mode: mode });
        this.view.add_layer(this._searchResultLayer);

        this._instructionMarkerLayer =
            new Champlain.MarkerLayer({ selection_mode: mode });
        this.view.add_layer(this._instructionMarkerLayer);

        this._userLocationLayer =
            new Champlain.MarkerLayer({ selection_mode: mode });
        this.view.add_layer(this._userLocationLayer);
    },

    _connectRouteSignals: function() {
        let route = Application.routeService.route;
        let query = Application.routeService.query;

        route.connect('update', this.showRoute.bind(this, route));
        route.connect('reset', (function() {
            this._routeLayer.remove_all();
            this._instructionMarkerLayer.remove_all();
        }).bind(this));

        query.connect('notify', (function() {
            this.routeVisible = query.isValid();
        }).bind(this));
    },

    setMapType: function(mapType) {
        if (this.view.map_source.id === mapType)
            return;

        let source = this._factory.create_cached_source(mapType);
        this.view.map_source = source;
    },

    gotoUserLocation: function(animate) {
        if (!this._userLocation)
            return;

        this.emit('going-to-user-location');
        Utils.once(this._userLocation, "gone-to", (function() {
            this.emit('gone-to-user-location');
        }).bind(this));
        this._userLocation.goTo(animate);
    },

    userLocationVisible: function() {
        let box = this.view.get_bounding_box();

        return box.covers(this._userLocation.latitude,
                          this._userLocation.longitude);
    },

    _updateUserLocation: function() {
        if (!Application.geoclue || !Application.geoclue.place)
            return;

        let place = Application.geoclue.place;

        let selected = this._userLocation && this._userLocation.selected;
        this._userLocation
            = new UserLocationMarker.UserLocationMarker({ place: place,
                                                          mapView: this });
        this._userLocationLayer.remove_all();
        this._userLocation.addToLayer(this._userLocationLayer);

        this._userLocation.selected = selected;

        this.emit('user-location-changed');
    },

    showTurnPoint: function(turnPoint) {
        if (this._turnPointMarker)
            this._turnPointMarker.destroy();

        if (turnPoint.isStop())
            return;

        this._turnPointMarker =
            new TurnPointMarker.TurnPointMarker({ turnPoint: turnPoint,
                                                  mapView: this });
        this._instructionMarkerLayer.add_marker(this._turnPointMarker);
        this._turnPointMarker.goToAndSelect(true);
    },

    showSearchResult: function(place) {
        this._searchResultLayer.remove_all();
        let searchResultMarker =
                new SearchResultMarker.SearchResultMarker({ place: place,
                                                            mapView: this });

        this._searchResultLayer.add_marker(searchResultMarker);
        searchResultMarker.goToAndSelect(true);

        return searchResultMarker;
    },

    showRoute: function(route) {
        this._routeLayer.remove_all();
        this.routeVisible = true;

        route.path.forEach(this._routeLayer.add_node.bind(this._routeLayer));

        let [lat, lon] = route.bbox.get_center();
        let place = new Geocode.Place({
            location:     new Geocode.Location({ latitude:  lat,
                                                 longitude: lon }),
            bounding_box: new Geocode.BoundingBox({ top:    route.bbox.top,
                                                    bottom: route.bbox.bottom,
                                                    left:   route.bbox.left,
                                                    right:  route.bbox.right })
        });

        this._showDestinationTurnpoints();
        new MapWalker.MapWalker(place, this).goTo(true);
    },

    _showDestinationTurnpoints: function() {
        let route = Application.routeService.route;
        let query = Application.routeService.query;

        this._instructionMarkerLayer.remove_all();

        route.turnPoints.filter(function(turnPoint) {
            return turnPoint.isStop();
        }).forEach(function(turnPoint, index) {
            let queryPoint = query.filledPoints[index];
            this._showDestinationMarker(turnPoint, queryPoint);
        }, this);
    },

    _showDestinationMarker: function(turnPoint, queryPoint) {
        let marker = new TurnPointMarker.DestinationMarker({
            turnPoint: turnPoint,
            queryPoint: queryPoint,
            mapView: this
        });

        this._instructionMarkerLayer.add_marker(marker);
    },

    _onViewMoved: function() {
        this.emit('view-moved');
    },

    onSetMarkerSelected: function(selectedMarker) {
        this.emit('marker-selected', selectedMarker);
    }
});
Utils.addSignalMethods(MapView.prototype);
