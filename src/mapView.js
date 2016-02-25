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
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>.
 *
 * Author: Zeeshan Ali (Khattak) <zeeshanak@gnome.org>
 */

const Champlain = imports.gi.Champlain;
const Clutter = imports.gi.Clutter;
const GObject = imports.gi.GObject;
const Geocode = imports.gi.GeocodeGlib;
const Gio = imports.gi.Gio;
const GtkChamplain = imports.gi.GtkChamplain;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

const Application = imports.application;
const ContactPlace = imports.contactPlace;
const Geoclue = imports.geoclue;
const GeoJSONShapeLayer = imports.geoJSONShapeLayer;
const KmlShapeLayer = imports.kmlShapeLayer;
const GpxShapeLayer = imports.gpxShapeLayer;
const Location = imports.location;
const Maps = imports.gi.GnomeMaps;
const MapWalker = imports.mapWalker;
const Place = imports.place;
const PlaceMarker = imports.placeMarker;
const ShapeLayer = imports.shapeLayer;
const StoredRoute = imports.storedRoute;
const TurnPointMarker = imports.turnPointMarker;
const UserLocationMarker = imports.userLocationMarker;
const Utils = imports.utils;

const MapType = {
    LOCAL: 'MapsLocalSource',
    STREET:  Champlain.MAP_SOURCE_OSM_MAPQUEST,
    AERIAL:  Champlain.MAP_SOURCE_OSM_AERIAL_MAP,
    CYCLING: Champlain.MAP_SOURCE_OSM_CYCLE_MAP,
    TRANSIT: Champlain.MAP_SOURCE_OSM_TRANSPORT_MAP
};
const _LOCATION_STORE_TIMEOUT = 500;
const MapMinZoom = 2;

/*
 * Due to the mathematics of spherical mericator projection,
 * the map must be truncated at a latitude less than 90 degrees.
 */
const MAX_LATITUDE = 85.05112;
const MIN_LATITUDE = -85.05112;
const MAX_LONGITUDE = 180;
const MIN_LONGITUDE = -180;

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

    _init: function(params) {
        this.parent();

        let mapType = params.mapType || MapType.STREET;
        delete params.mapType;

        this.view = this._initView();
        this._initLayers();

        this._factory = Champlain.MapSourceFactory.dup_default();
        this.setMapType(mapType);

        this.shapeLayerStore = new Gio.ListStore(GObject.TYPE_OBJECT);

        this._updateUserLocation();
        Application.geoclue.connect('location-changed',
                                    this._updateUserLocation.bind(this));
        Application.geoclue.connect('notify::state',
                                    this._updateUserLocation.bind(this));
        this._storeId = 0;
        this._connectRouteSignals();
    },

    _initScale: function(view) {
        this._scale = new Champlain.Scale({ visible: true });
        this._scale.connect_view(view);

        if (Utils.getMeasurementSystem() === Utils.METRIC_SYSTEM)
            this._scale.unit = Champlain.Unit.KM;
        else
            this._scale.unit = Champlain.Unit.MILES;

        this._scale.set_x_expand(true);
        this._scale.set_y_expand(true);
        this._scale.set_x_align(Clutter.ActorAlign.START);
        this._scale.set_y_align(Clutter.ActorAlign.END);
        view.add_child(this._scale);
    },

    _initView: function() {
        let view = this.get_view();
        view.zoom_level = 3;
        view.min_zoom_level = MapMinZoom;
        view.goto_animation_mode = Clutter.AnimationMode.EASE_IN_OUT_CUBIC;
        view.reactive = true;
        view.kinetic_mode = true;

        if (Application.normalStartup)
            view.connect('notify::realized', this._goToStoredLocation.bind(this));
        view.connect('notify::latitude', this._onViewMoved.bind(this));
        // switching map type will set view min-zoom-level from map source
        view.connect('notify::min-zoom-level', (function() {
            if (view.min_zoom_level < MapMinZoom) {
                view.min_zoom_level = MapMinZoom;
            }
        }).bind(this));

        this._initScale(view);
        return view;
    },

    _initLayers: function() {
        let strokeColor = new Clutter.Color({ red: 0,
                                              blue: 255,
                                              green: 0,
                                              alpha: 100 });

        let mode = Champlain.SelectionMode.SINGLE;

        this._userLocationLayer = new Champlain.MarkerLayer({ selection_mode: mode });
        this.view.add_layer(this._userLocationLayer);

        this._routeLayer = new Champlain.PathLayer({ stroke_width: 5.0,
                                                     stroke_color: strokeColor });
        this.view.add_layer(this._routeLayer);


        this._placeLayer = new Champlain.MarkerLayer({ selection_mode: mode });
        this.view.add_layer(this._placeLayer);

        this._instructionMarkerLayer = new Champlain.MarkerLayer({ selection_mode: mode });
        this.view.add_layer(this._instructionMarkerLayer);

        this._annotationMarkerLayer = new Champlain.MarkerLayer({ selection_mode: mode });
        this.view.add_layer(this._annotationMarkerLayer);

        ShapeLayer.SUPPORTED_TYPES.push(GeoJSONShapeLayer.GeoJSONShapeLayer);
        ShapeLayer.SUPPORTED_TYPES.push(KmlShapeLayer.KmlShapeLayer);
        ShapeLayer.SUPPORTED_TYPES.push(GpxShapeLayer.GpxShapeLayer);
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

        let overlay_sources = this.view.get_overlay_sources();

        if (mapType !== MapType.LOCAL) {
            let source = this._factory.create_cached_source(mapType);
            this.view.map_source = source;
        } else {
            let renderer = new Champlain.ImageRenderer();
            let source = new Maps.FileTileSource({
                path: Application.application.local_tile_path.toString(),
                renderer: renderer
            });
            try {
                source.prepare();

                this.view.map_source = source;
                this.view.world = source.world;
                let [lat, lon] = this.view.world.get_center();
                this.view.center_on(lat, lon);
            } catch(e) {
                this.setMapType(MapType.STREET);
                Application.application.local_tile_path = false;
                Application.application.notify('connected');
                Application.notificationManager.showMessage(e.message);
            }
        }

        overlay_sources.forEach((function(source) {
            this.view.add_overlay_source(source, 255);
        }).bind(this));
    },

    toggleScale: function() {
        this._scale.visible = !this._scale.visible;
    },

    openShapeLayers: function(files) {
        let bbox = new Champlain.BoundingBox();
        let ret = true;
        files.forEach((function(file){
            try {
                let i = this._findShapeLayerIndex(file);
                let layer = (i > -1) ? this.shapeLayerStore.get_item(i) : null;
                if (!layer) {
                    layer = ShapeLayer.newFromFile(file, this);
                    if (!layer)
                        throw new Error(_("File type is not supported"));
                    layer.load();
                    this.shapeLayerStore.append(layer);
                }
                bbox.compose(layer.bbox);
            } catch (e) {
                Utils.debug(e);
                let msg = _("Failed to open layer");
                Application.notificationManager.showMessage(msg);
                ret = false;
            }
        }).bind(this));

        this.gotoBBox(bbox);
        return ret;
    },

    removeShapeLayer: function(shapeLayer) {
        shapeLayer.unload();
        let i = this._findShapeLayerIndex(shapeLayer.file);
        this.shapeLayerStore.remove(i);
    },

    _findShapeLayerIndex: function(file) {
        for (let i = 0; i < this.shapeLayerStore.get_n_items(); i++)
            if (this.shapeLayerStore.get_item(i).file.equal(file))
                return i;
        return -1;
    },

    goToGeoURI: function(uri) {
        try {
            let location = new Location.Location({ heading: -1 });
            location.set_from_uri(uri);

            let place = new Place.Place({ location: location,
                                          name: location.description,
                                          store: false });
            let marker = new PlaceMarker.PlaceMarker({ place: place,
                                                       mapView: this });
            this._placeLayer.add_marker(marker);
            marker.goToAndSelect(true);
        } catch(e) {
            let msg = _("Failed to open GeoURI");
            Application.notificationManager.showMessage(msg);
            Utils.debug("failed to open GeoURI: %s".format(e.message));
        }
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

        return box.covers(this._userLocation.latitude, this._userLocation.longitude);
    },

    _updateUserLocation: function() {
        if (!Application.geoclue.place)
            return;

        if (Application.geoclue.state !== Geoclue.State.ON) {
            if (this._userLocation)
                this._userLocation.destroy();
            this._userLocation = null;
            return;
        }

        let place = Application.geoclue.place;

        let previousSelected = this._userLocation && this._userLocation.selected;
        this._userLocation = new UserLocationMarker.UserLocationMarker({ place: place,
                                                                         mapView: this });
        this._userLocationLayer.remove_all();
        this._userLocation.addToLayer(this._userLocationLayer);

        this._userLocation.selected = previousSelected;

        this.emit('user-location-changed');
    },

    _storeLocation: function() {
        let box = this.view.get_bounding_box();
        let lastViewedLocation = [box.top, box.bottom, box.left, box.right];
        Application.settings.set('last-viewed-location', lastViewedLocation);
    },

    _goToStoredLocation: function() {
        if (!this.view.realized)
            return;

        let box = Application.settings.get('last-viewed-location');
        let bounding_box = new Champlain.BoundingBox({ top: box[0],
                                                       bottom: box[1],
                                                       left: box[2],
                                                       right: box[3] });
        this.gotoBBox(bounding_box, true);
    },

    gotoBBox: function(bbox, linear) {
        if (!bbox.is_valid()) {
            Utils.debug('Bounding box is invalid');
            return;
        }

        let [lat, lon] = bbox.get_center();
        let place = new Place.Place({
            location: new Location.Location({ latitude  : lat,
                                              longitude : lon }),
            bounding_box: new Geocode.BoundingBox({ top    : bbox.top,
                                                    bottom : bbox.bottom,
                                                    left   : bbox.left,
                                                    right  : bbox.right })
        });
        new MapWalker.MapWalker(place, this).goTo(true, linear);
    },

    showTurnPoint: function(turnPoint) {
        if (this._turnPointMarker)
            this._turnPointMarker.destroy();

        if (turnPoint.isStop())
            return;

        this._turnPointMarker = new TurnPointMarker.TurnPointMarker({ turnPoint: turnPoint,
                                                                      mapView: this });
        this._instructionMarkerLayer.add_marker(this._turnPointMarker);
        this._turnPointMarker.goTo();
    },

    showContact: function(contact) {
        let places = contact.get_places();
        if (places.length === 0)
            return;

        this._placeLayer.remove_all();
        places.forEach((function(p) {
            let place = new ContactPlace.ContactPlace({ place: p,
                                                        contact: contact });
            let marker = new PlaceMarker.PlaceMarker({ place: place,
                                                       mapView: this });
            this._placeLayer.add_marker(marker);
        }).bind(this));

        if (places.length > 1)
            this.gotoBBox(contact.bounding_box);
        else
            new MapWalker.MapWalker(places[0], this).goTo(true);
    },

    _showStoredRoute: function(stored) {
        let query = Application.routeService.query;
        let route = Application.routeService.route;

        Application.routeService.storedRoute = stored.route;

        let resetId = route.connect('reset', function() {
            route.disconnect(resetId);
            query.freeze_notify();

            let storedLast = stored.places.length - 1;
            query.points[0].place = stored.places[0];
            query.points[1].place = stored.places[storedLast];
            query.transportation = stored.transportation;

            for (let i = 1; i < storedLast; i++) {
                let point = query.addPoint(i);
                point.place = stored.places[i];
            }

            query.thaw_notify();
        });
        route.reset();
    },

    showPlace: function(place, animation) {
        this._placeLayer.remove_all();

        if (place instanceof StoredRoute.StoredRoute) {
            this._showStoredRoute(place);
            return;
        }

        this.routeVisible = false;
        let placeMarker = new PlaceMarker.PlaceMarker({ place: place,
                                                        mapView: this });

        this._placeLayer.add_marker(placeMarker);
        placeMarker.goToAndSelect(animation);
    },

    showRoute: function(route) {
        this._routeLayer.remove_all();
        this._placeLayer.remove_all();

        this.routeVisible = true;

        route.path.forEach(this._routeLayer.add_node.bind(this._routeLayer));

        this._showDestinationTurnpoints();
        this.gotoBBox(route.bbox);
    },

    _showDestinationTurnpoints: function() {
        let route = Application.routeService.route;
        let query = Application.routeService.query;
        let pointIndex = 0;

        this._instructionMarkerLayer.remove_all();
        route.turnPoints.forEach(function(turnPoint) {
            if (turnPoint.isStop()) {
                let queryPoint = query.filledPoints[pointIndex];
                let destinationMarker = new TurnPointMarker.TurnPointMarker({ turnPoint: turnPoint,
                                                                              queryPoint: queryPoint,
                                                                              mapView: this });
                this._instructionMarkerLayer.add_marker(destinationMarker);
                pointIndex++;
            }
        }, this);
    },

    _onViewMoved: function() {
        this.emit('view-moved');
        if (this._storeId !== 0)
            return;

        this._storeId = Mainloop.timeout_add(_LOCATION_STORE_TIMEOUT,(function(){
            this._storeId = 0;
            this._storeLocation();
        }).bind(this));
    },

    onSetMarkerSelected: function(selectedMarker) {
        this.emit('marker-selected', selectedMarker);
    }
});
Utils.addSignalMethods(MapView.prototype);
