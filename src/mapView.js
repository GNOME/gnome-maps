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
const Color = imports.color;
const Geoclue = imports.geoclue;
const GeoJSONShapeLayer = imports.geoJSONShapeLayer;
const KmlShapeLayer = imports.kmlShapeLayer;
const GpxShapeLayer = imports.gpxShapeLayer;
const Location = imports.location;
const Maps = imports.gi.GnomeMaps;
const MapSource = imports.mapSource;
const MapWalker = imports.mapWalker;
const Place = imports.place;
const PlaceMarker = imports.placeMarker;
const RouteQuery = imports.routeQuery;
const ShapeLayer = imports.shapeLayer;
const StoredRoute = imports.storedRoute;
const TransitArrivalMarker = imports.transitArrivalMarker;
const TransitBoardMarker = imports.transitBoardMarker;
const TransitWalkMarker = imports.transitWalkMarker;
const TurnPointMarker = imports.turnPointMarker;
const UserLocationMarker = imports.userLocationMarker;
const Utils = imports.utils;

var MapType = {
    LOCAL: 'MapsLocalSource',
    STREET: 'MapsStreetSource',
    AERIAL: 'MapsAerialSource'
};
const _LOCATION_STORE_TIMEOUT = 500;
const MapMinZoom = 2;

/*
 * Due to the mathematics of spherical mericator projection,
 * the map must be truncated at a latitude less than 90 degrees.
 */
var MAX_LATITUDE = 85.05112;
var MIN_LATITUDE = -85.05112;
var MAX_LONGITUDE = 180;
var MIN_LONGITUDE = -180;

/* threashhold for route color luminance when we consider it more or less
 * as white, and draw an outline on the path */
const OUTLINE_LUMINANCE_THREASHHOLD = 0.9;

// color used for turn-by-turn-based routes (non-transit)
const TURN_BY_TURN_ROUTE_COLOR = '0000FF';

// line width for route lines
const ROUTE_LINE_WIDTH = 5;

/* length of filled parts of dashed lines used for walking legs of transit
 * itineraries
 */
const DASHED_ROUTE_LINE_FILLED_LENGTH = 5;

// length of gaps of dashed lines used for walking legs of transit itineraries
const DASHED_ROUTE_LINE_GAP_LENGTH = 5;

var MapView = new Lang.Class({
    Name: 'MapView',
    Extends: GtkChamplain.Embed,
    Properties: {
        // this property is true when the routing sidebar is active
        'routingOpen': GObject.ParamSpec.boolean('routingOpen',
                                                  'Routing open',
                                                  'Routing sidebar open',
                                                  GObject.ParamFlags.READABLE |
                                                  GObject.ParamFlags.WRITABLE,
                                                  false),
        /* this property is true when a route is being shown on the map */
        'routeShowing': GObject.ParamSpec.boolean('routeShowing',
                                                 'Route showing',
                                                 'Showing a route on the map',
                                                 GObject.ParamFlags.READABLE |
                                                 GObject.ParamFlags.WRITABLE,
                                                 false)
    },
    Signals: {
        'user-location-changed': {},
        'going-to': {},
        'going-to-user-location': {},
        'gone-to-user-location': {},
        'view-moved': {},
        'marker-selected': { param_types: [Champlain.Marker] }
    },

    get routingOpen() {
        return this._routingOpen || this._instructionMarkerLayer.visible;
    },

    set routingOpen(value) {
        let isValid = Application.routeQuery.isValid();

        this._routingOpen = value && isValid;
        this._routeLayers.forEach((routeLayer) => routeLayer.visible = value && isValid);
        this._instructionMarkerLayer.visible = value && isValid;
        if (!value)
            this.routeShowing = false;
        this.notify('routingOpen');
    },

    get routeShowing() {
        return this._routeShowing;
    },

    set routeShowing(value) {
        this._routeShowing = value;
        this.notify('routeShowing');
    },

    _init: function(params) {
        this.parent();

        let mapType = params.mapType || MapType.STREET;
        delete params.mapType;

        this.view = this._initView();
        this._initLayers();

        this.setMapType(mapType);

        this.shapeLayerStore = new Gio.ListStore(GObject.TYPE_OBJECT);

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
        view.horizontal_wrap = true;

        if (Application.normalStartup)
            view.connect('notify::realized', this._goToStoredLocation.bind(this));
        view.connect('notify::latitude', this._onViewMoved.bind(this));
        // switching map type will set view min-zoom-level from map source
        view.connect('notify::min-zoom-level', () => {
            if (view.min_zoom_level < MapMinZoom) {
                view.min_zoom_level = MapMinZoom;
            }
        });

        this._initScale(view);
        return view;
    },

    /* create and store a route layer, pass true to get a dashed line */
    _createRouteLayer: function(dashed, lineColor, width) {
        let red = Color.parseColor(lineColor, 0);
        let green = Color.parseColor(lineColor, 1);
        let blue = Color.parseColor(lineColor, 2);
        // Clutter uses a 0-255 range for color components
        let strokeColor = new Clutter.Color({ red: red * 255,
                                              blue: blue * 255,
                                              green: green * 255,
                                              alpha: 255 });
        let routeLayer = new Champlain.PathLayer({ stroke_width: width,
                                                   stroke_color: strokeColor });
        if (dashed)
            routeLayer.set_dash([DASHED_ROUTE_LINE_FILLED_LENGTH,
                                 DASHED_ROUTE_LINE_GAP_LENGTH]);

        this._routeLayers.push(routeLayer);
        this.view.add_layer(routeLayer);

        return routeLayer;
    },

    _clearRouteLayers: function() {
        this._routeLayers.forEach((routeLayer) => {
            routeLayer.remove_all();
            routeLayer.visible = false;
            this.view.remove_layer(routeLayer);
        });

        this._routeLayers = [];
    },

    _initLayers: function() {
        let mode = Champlain.SelectionMode.SINGLE;

        this._userLocationLayer = new Champlain.MarkerLayer({ selection_mode: mode });
        this.view.add_layer(this._userLocationLayer);

        this._placeLayer = new Champlain.MarkerLayer({ selection_mode: mode });
        this.view.add_layer(this._placeLayer);

        this._instructionMarkerLayer = new Champlain.MarkerLayer({ selection_mode: mode });
        this.view.add_layer(this._instructionMarkerLayer);

        this._annotationMarkerLayer = new Champlain.MarkerLayer({ selection_mode: mode });
        this.view.add_layer(this._annotationMarkerLayer);

        ShapeLayer.SUPPORTED_TYPES.push(GeoJSONShapeLayer.GeoJSONShapeLayer);
        ShapeLayer.SUPPORTED_TYPES.push(KmlShapeLayer.KmlShapeLayer);
        ShapeLayer.SUPPORTED_TYPES.push(GpxShapeLayer.GpxShapeLayer);

        this._routeLayers = [];
    },

    _ensureInstructionLayerAboveRouteLayers: function() {
        this.view.remove_layer(this._instructionMarkerLayer);
        this.view.add_layer(this._instructionMarkerLayer);
    },

    _connectRouteSignals: function() {
        let route = Application.routingDelegator.graphHopper.route;
        let transitPlan = Application.routingDelegator.openTripPlanner.plan;
        let query = Application.routeQuery;

        route.connect('update', () => {
            this.showRoute(route);
            this.routeShowing = true;
        });
        route.connect('reset', () => {
            this._clearRouteLayers();
            this._instructionMarkerLayer.remove_all();
            this.routeShowing = false;
        });
        transitPlan.connect('update', () => this._showTransitPlan(transitPlan));
        transitPlan.connect('reset', () => {
            this._clearRouteLayers();
            this._instructionMarkerLayer.remove_all();
            this.routeShowing = false;
        });
        transitPlan.connect('itinerary-selected', (obj, itinerary) => {
            this._showTransitItinerary(itinerary);
            this.routeShowing = true;
        });
        transitPlan.connect('itinerary-deselected', () => {
            this._clearRouteLayers();
            this._instructionMarkerLayer.remove_all();
            this.routeShowing = false;
        });


        query.connect('notify', () => this.routingOpen = query.isValid());
    },

    setMapType: function(mapType) {
        if (this._mapType && this._mapType === mapType)
            return;

        let overlay_sources = this.view.get_overlay_sources();

        this._mapType = mapType;

        if (mapType !== MapType.LOCAL) {
            if (mapType === MapType.AERIAL)
                this.view.map_source = MapSource.createAerialSource();
            else
                this.view.map_source = MapSource.createStreetSource();

            if (!this._attribution) {
                this._attribution = new MapSource.AttributionLogo(this.view);
                this.view.add_child(this._attribution);
            }
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

        overlay_sources.forEach((source) => this.view.add_overlay_source(source, 255));
    },

    toggleScale: function() {
        this._scale.visible = !this._scale.visible;
    },

    openShapeLayers: function(files) {
        let bbox = new Champlain.BoundingBox();
        let ret = true;
        files.forEach((file) => {
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
        });

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
        Utils.once(this._userLocation, "gone-to",
                   () => this.emit('gone-to-user-location'));
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
        if (this._userLocation)
            this._userLocation.disconnectView();
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

    showTransitStop: function(transitStop, transitLeg) {
        if (this._turnPointMarker)
            this._turnPointMarker.destroy();

        this._turnPointMarker = new TurnPointMarker.TurnPointMarker({ transitStop: transitStop,
                                                                      transitLeg: transitLeg,
                                                                      mapView: this });
        this._instructionMarkerLayer.add_marker(this._turnPointMarker);
        this._turnPointMarker.goTo();
    },

    showContact: function(contact) {
        let places = contact.get_places();
        if (places.length === 0)
            return;

        this._placeLayer.remove_all();
        places.forEach((p) => {
            let place = new ContactPlace.ContactPlace({ place: p,
                                                        contact: contact });
            let marker = new PlaceMarker.PlaceMarker({ place: place,
                                                       mapView: this });
            this._placeLayer.add_marker(marker);
        });

        if (places.length > 1)
            this.gotoBBox(contact.bounding_box);
        else
            new MapWalker.MapWalker(places[0], this).goTo(true);
    },

    _showStoredRoute: function(stored) {
        let query = Application.routeQuery;
        let route = Application.routingDelegator.graphHopper.route;

        Application.routingDelegator.graphHopper.storedRoute = stored.route;

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

        this.routingOpen = false;
        let placeMarker = new PlaceMarker.PlaceMarker({ place: place,
                                                        mapView: this });

        this._placeLayer.add_marker(placeMarker);
        placeMarker.goToAndSelect(animation);
    },

    showRoute: function(route) {
        let routeLayer;

        this._clearRouteLayers();
        this._placeLayer.remove_all();

        routeLayer = this._createRouteLayer(false, TURN_BY_TURN_ROUTE_COLOR,
                                            ROUTE_LINE_WIDTH);
        route.path.forEach((polyline) => routeLayer.add_node(polyline));
        this.routingOpen = true;

        this._ensureInstructionLayerAboveRouteLayers();

        this._showDestinationTurnpoints();
        this.gotoBBox(route.bbox);
    },

    _showDestinationTurnpoints: function() {
        let route = Application.routingDelegator.graphHopper.route;
        let query = Application.routeQuery;
        let pointIndex = 0;

        this._instructionMarkerLayer.remove_all();
        route.turnPoints.forEach((turnPoint) => {
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

    _showTransitItinerary: function(itinerary) {
        this.gotoBBox(itinerary.bbox);
        this._clearRouteLayers();
        this._placeLayer.remove_all();
        this._instructionMarkerLayer.remove_all();

        itinerary.legs.forEach((leg, index) => {
            let dashed = !leg.transit;
            let color = leg.color;
            let outlineColor = leg.textColor;
            let hasOutline = Color.relativeLuminance(color) >
                             OUTLINE_LUMINANCE_THREASHHOLD;
            let routeLayer;
            let outlineRouteLayer;

            /* draw an outline by drawing a background path layer if needed
             * TODO: maybe we should add support for outlined path layers in
             * libchamplain */
            if (hasOutline)
                outlineRouteLayer = this._createRouteLayer(dashed, outlineColor,
                                                           ROUTE_LINE_WIDTH + 2);
            routeLayer = this._createRouteLayer(dashed, color, ROUTE_LINE_WIDTH);

            /* if this is a walking leg and not at the start, "stitch" it
             * together with the end point of the previous leg, as the walk
             * route might not reach all the way */
            if (index > 0 && !leg.transit) {
                let previousLeg = itinerary.legs[index - 1];
                let lastPoint = previousLeg.polyline.last();

                routeLayer.add_node(lastPoint);
            }

            if (hasOutline) {
                leg.polyline.forEach((function (polyline) {
                    outlineRouteLayer.add_node(polyline);
                }));
            }
            leg.polyline.forEach((function (polyline) {
                routeLayer.add_node(polyline);
            }));

            /* like above, "stitch" the route segment with the next one if it's
             * a walking leg, and not the last one */
            if (index < itinerary.legs.length - 1 && !leg.transit) {
                let nextLeg = itinerary.legs[index + 1];
                let firstPoint = nextLeg.polyline[0];

                routeLayer.add_node(firstPoint);
            }
        });

        this._ensureInstructionLayerAboveRouteLayers();

        itinerary.legs.forEach((leg, index) => {
            let previousLeg = index === 0 ? null : itinerary.legs[index - 1];

            /* add start marker */
            let start;
            if (!leg.transit) {
                start = new TransitWalkMarker.TransitWalkMarker({ leg: leg,
                                                                  previousLeg: previousLeg,
                                                                  mapView: this });
            } else {
                start = new TransitBoardMarker.TransitBoardMarker({ leg: leg,
                                                                    mapView: this });
            }

            this._instructionMarkerLayer.add_marker(start);
        });

        /* add arrival marker */
        let lastLeg = itinerary.legs.last();
        let arrival = new TransitArrivalMarker.TransitArrivalMarker({ leg: lastLeg,
                                                                      mapView: this });
        this._instructionMarkerLayer.add_marker(arrival);

        this.routingOpen = true;
    },

    _showTransitPlan: function(plan) {
        this.gotoBBox(plan.bbox);
    },

    _onViewMoved: function() {
        this.emit('view-moved');
        if (this._storeId !== 0)
            return;

        this._storeId = Mainloop.timeout_add(_LOCATION_STORE_TIMEOUT, () => {
            this._storeId = 0;
            this._storeLocation();
        });
    },

    onSetMarkerSelected: function(selectedMarker) {
        this.emit('marker-selected', selectedMarker);
    }
});
