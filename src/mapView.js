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
const Gtk = imports.gi.Gtk;
const GtkChamplain = imports.gi.GtkChamplain;
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
const Service = imports.service;
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

// Maximum limit of file size (20 MB) that can be loaded without user confirmation
const FILE_SIZE_LIMIT_MB = 20;

var MapView = GObject.registerClass({
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
        'marker-selected': { param_types: [Champlain.Marker] },
        'map-type-changed': { param_types: [GObject.TYPE_STRING] }
    },
}, class MapView extends GtkChamplain.Embed {

    get routingOpen() {
        return this._routingOpen || this._instructionMarkerLayer.visible;
    }

    set routingOpen(value) {
        let isValid = Application.routeQuery.isValid();

        this._routingOpen = value && isValid;
        this._routeLayers.forEach((routeLayer) => routeLayer.visible = value && isValid);
        this._instructionMarkerLayer.visible = value && isValid;
        if (!value)
            this.routeShowing = false;
        this.notify('routingOpen');
    }

    get routeShowing() {
        return this._routeShowing;
    }

    set routeShowing(value) {
        this._routeShowing = value;
        this.notify('routeShowing');
    }

    _init(params) {
        super._init();

        let mapType = params.mapType || this._getStoredMapType();
        delete params.mapType;

        this._mainWindow = params.mainWindow;
        delete params.mainWindow;

        this._storeId = 0;
        this.view = this._initView();
        this._initLayers();

        this.setMapType(mapType);

        if (Application.normalStartup)
            this._goToStoredLocation();

        this.shapeLayerStore = new Gio.ListStore(GObject.TYPE_OBJECT);

        Application.geoclue.connect('location-changed',
                                    this._updateUserLocation.bind(this));
        Application.geoclue.connect('notify::state',
                                    this._updateUserLocation.bind(this));
        this._connectRouteSignals();

        // set dark background if we start up in dark theme
        this._setBackgroundPatternIfNeeded();
    }

    _initScale(view) {
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
    }

    _initView() {
        let view = this.get_view();

        view.min_zoom_level = MapMinZoom;
        view.goto_animation_mode = Clutter.AnimationMode.EASE_IN_OUT_CUBIC;
        view.reactive = true;
        view.kinetic_mode = true;
        view.horizontal_wrap = true;

        view.connect('notify::latitude', this._onViewMoved.bind(this));
        view.connect('notify::longitude',
                     () => this._setBackgroundPatternIfNeeded());
        // switching map type will set view min-zoom-level from map source
        view.connect('notify::min-zoom-level', () => {
            if (view.min_zoom_level < MapMinZoom) {
                view.min_zoom_level = MapMinZoom;
            }
        });

        // if dark tiles is available, setup handler to switch style
        if (Service.getService().tiles.streetDark) {
            Application.settings.connect('changed::night-mode',
                                         this._onNightModeChanged.bind(this));
        }

        // if hybrid aerial tiles are available, setup handler to toggle
        if (Service.getService().tiles.hybridAerial) {
            Application.settings.connect('changed::hybrid-aerial',
                                         this._onHybridAerialChanged.bind(this));
        }

        this._gtkSettings = Gtk.Settings.get_default();
        this._gtkSettings.connect('notify::gtk-application-prefer-dark-theme',
                            this._onPreferDarkThemeChanged.bind(this));

        this._initScale(view);
        return view;
    }

    /* handler to draw background for dark theme,
     * these three functions should not be needed later with a native GTK
     * widget (Shumate)
     */
    _drawDarkBackground(canvas, cr, width, height) {
        // set this arbitrarily to try to match the typical dark tile set
        cr.setSourceRGB(0.2, 0.2, 0.2);
        cr.rectangle(0, 0, width, height);
        cr.fillPreserve();

        return true;
    }

    _createDarkBackground() {
        this._darkBackground = new Clutter.Canvas();
        this._darkBackground.set_size(512, 512);
        this._darkBackground.connect('draw',
                                     this._drawDarkBackground.bind(this));
        this._darkBackground.invalidate();
    }

    _isWrappingAround() {
        let bbox = this.view.get_bounding_box();

        return bbox.left > bbox.right;
    }

    _setBackgroundPatternIfNeeded() {
        if (this._gtkSettings.gtk_application_prefer_dark_theme &&
            !this._isWrappingAround()) {
            if (!this._darkBackgroud)
                this._createDarkBackground();
            this.view.set_background_pattern(this._darkBackground);
            this._customBackgroundSet = true;
        } else if (this._customBackgroundSet) {
            this.view.background_pattern = null;
            this._customBackgroundSet = false;
        }
    }

    _onPreferDarkThemeChanged() {
        this._setBackgroundPatternIfNeeded();
    }

    _onNightModeChanged() {
        if (this._mapType === MapType.STREET) {
            let overlay_sources = this.view.get_overlay_sources();

            if (Application.settings.get('night-mode'))
                this.view.map_source = MapSource.createStreetDarkSource();
            else
                this.view.map_source = MapSource.createStreetSource();
            overlay_sources.forEach((source) => this.view.add_overlay_source(source, 255));
        }
    }

    _onHybridAerialChanged() {
        if (this._mapType === MapType.AERIAL) {
            let overlay_sources = this.view.get_overlay_sources();

            if (Application.settings.get('hybrid-aerial'))
                this.view.map_source = MapSource.createHybridAerialSource();
            else
                this.view.map_source = MapSource.createAerialSource();
            overlay_sources.forEach((source) => this.view.add_overlay_source(source, 255));
        }
    }

    /* create and store a route layer, pass true to get a dashed line */
    _createRouteLayer(dashed, lineColor, width) {
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
    }

    _clearRouteLayers() {
        this._routeLayers.forEach((routeLayer) => {
            routeLayer.remove_all();
            routeLayer.visible = false;
            this.view.remove_layer(routeLayer);
        });

        this._routeLayers = [];
    }

    _initLayers() {
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
    }

    _ensureInstructionLayerAboveRouteLayers() {
        this.view.remove_layer(this._instructionMarkerLayer);
        this.view.add_layer(this._instructionMarkerLayer);
    }

    _connectRouteSignals() {
        let route = Application.routingDelegator.graphHopper.route;
        let transitPlan = Application.routingDelegator.transitRouter.plan;
        let query = Application.routeQuery;

        route.connect('update', () => {
            this.showRoute(route);
            this.routeShowing = true;
        });
        route.connect('reset', () => {
            this._clearRouteLayers();
            this._instructionMarkerLayer.remove_all();
            this._turnPointMarker = null;
            this.routeShowing = false;
        });
        transitPlan.connect('update', () => this._showTransitPlan(transitPlan));
        transitPlan.connect('reset', () => {
            this._clearRouteLayers();
            this._instructionMarkerLayer.remove_all();
            this._turnPointMarker = null;
            this.routeShowing = false;
        });
        transitPlan.connect('itinerary-selected', (obj, itinerary) => {
            this._showTransitItinerary(itinerary);
            this.routeShowing = true;
        });
        transitPlan.connect('itinerary-deselected', () => {
            this._clearRouteLayers();
            this._instructionMarkerLayer.remove_all();
            this._turnPointMarker = null;
            this.routeShowing = false;
        });

        query.connect('notify', () => this.routingOpen = query.isValid());
    }

    _getStoredMapType() {
        let mapType = Application.settings.get('map-type');

        // make sure it's a valid map type
        for (let type in MapType) {
            if (mapType === MapType[type]) {
                return mapType;
            }
        }

        return MapType.STREET;
    }

    getMapType() {
        return this._mapType;
    }

    setMapType(mapType) {
        if (this._mapType && this._mapType === mapType)
            return;

        let overlay_sources = this.view.get_overlay_sources();

        this._mapType = mapType;

        if (mapType !== MapType.LOCAL) {
            let tiles = Service.getService().tiles;

            if (mapType === MapType.AERIAL && tiles.aerial) {
                if (tiles.hybridAerial &&
                    Application.settings.get('hybrid-aerial')) {
                    this.view.map_source = MapSource.createHybridAerialSource();
                } else {
                    this.view.map_source = MapSource.createAerialSource();
                }
            } else {
                if (tiles.streetDark &&
                    Application.settings.get('night-mode')) {
                    this.view.map_source = MapSource.createStreetDarkSource();
                } else {
                    this.view.map_source = MapSource.createStreetSource();
                }
            }
            if (!this._attribution) {
                this._attribution = new MapSource.AttributionLogo(this.view);
                this.view.add_child(this._attribution);
            }

            this._attribution.setSource(this.view.map_source);

            Application.settings.set('map-type', mapType);
        } else {
            let renderer = new Champlain.ImageRenderer();
            let source = new Maps.FileTileSource({
                path: Utils.getBufferText(Application.application.local_tile_path),
                renderer: renderer,
                tile_size: Application.application.local_tile_size || 512
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
                Utils.showDialog(e.message, Gtk.MessageType.ERROR, this._mainWindow);
            }
        }

        overlay_sources.forEach((source) => this.view.add_overlay_source(source, 255));

        this.emit("map-type-changed", mapType);
    }

    toggleScale() {
        this._scale.visible = !this._scale.visible;
    }

    _checkIfFileSizeNeedsConfirmation(files) {
        let confirmLoad = false;
        let totalFileSizeMB = 0;
        files.forEach((file) => {
            totalFileSizeMB += file.query_info(Gio.FILE_ATTRIBUTE_STANDARD_SIZE, 
                                               0, null).get_size();
        });
        totalFileSizeMB = totalFileSizeMB / (1024 * 1024);
        if (totalFileSizeMB > FILE_SIZE_LIMIT_MB) {
            confirmLoad = true;
        }

        return {'confirmLoad': confirmLoad, 'totalFileSizeMB': totalFileSizeMB};
    }

    _onShapeLoad(error, bbox, layer) {
        if (error) {
            let msg = _("Failed to open layer");
            Utils.showDialog(msg, Gtk.MessageType.ERROR, this._mainWindow);
        } else {
            bbox.compose(layer.bbox);
        }

        this._remainingFilesToLoad--;
        if (this._remainingFilesToLoad === 0) {
            this.gotoBBox(bbox);
        }
    }

    openShapeLayers(files) {
        let result = this._checkIfFileSizeNeedsConfirmation(files);
        if (result.confirmLoad) {
            let totalFileSizeMB = result.totalFileSizeMB;

            let dialog = new Gtk.MessageDialog ({
                transient_for: this._mainWindow,
                modal: true,
                buttons: Gtk.ButtonsType.OK_CANCEL,
                text: _("Do you want to continue?"), 
                secondary_text: _("You are about to open files with a total " + 
                                 "size of %s MB. This could take some time to" +
                                 " load").format(totalFileSizeMB.toLocaleString(undefined,
                                                                               { maximumFractionDigits: 1 }))
            });

            dialog.connect('response', (widget, responseId) => {
                if (responseId === Gtk.ResponseType.OK) {
                    this._loadShapeLayers(files);
                }
                dialog.destroy();
            });
            dialog.show_all();
        } else {
            this._loadShapeLayers(files);
        }
        return true;
    }

    _loadShapeLayers(files) {
        let bbox = new Champlain.BoundingBox();
        this._remainingFilesToLoad = files.length;

        files.forEach((file) => {
            try {
                let i = this._findShapeLayerIndex(file);
                let layer = (i > -1) ? this.shapeLayerStore.get_item(i) : null;
                if (!layer) {
                    layer = ShapeLayer.newFromFile(file, this);
                    if (!layer)
                        throw new Error(_("File type is not supported"));
                    layer.load(this._onShapeLoad.bind(this), bbox);
                    this.shapeLayerStore.append(layer);
                }
            } catch (e) {
                Utils.debug(e);
                let msg = _("Failed to open layer");
                Utils.showDialog(msg, Gtk.MessageType.ERROR, this._mainWindow);
            }
        });
    }

    removeShapeLayer(shapeLayer) {
        shapeLayer.unload();
        let i = this._findShapeLayerIndex(shapeLayer.file);
        this.shapeLayerStore.remove(i);
    }

    _findShapeLayerIndex(file) {
        for (let i = 0; i < this.shapeLayerStore.get_n_items(); i++)
            if (this.shapeLayerStore.get_item(i).file.equal(file))
                return i;
        return -1;
    }

    goToGeoURI(uri) {
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
            Utils.showDialog(msg, Gtk.MessageType.ERROR, this._mainWindow);
            Utils.debug("failed to open GeoURI: %s".format(e.message));
        }
    }

    goToHttpURL(url) {
        Place.parseHttpURL(url, (place, error) => {
            if (place) {
                let marker = new PlaceMarker.PlaceMarker({ place: place,
                                                           mapView: this });

                this._placeLayer.add_marker(marker);
                marker.goToAndSelect(true);
            } else {
                Utils.showDialog(error, Gtk.MessageType.ERROR, this._mainWindow);
            }
        });
    }

    gotoUserLocation(animate) {
        if (!this._userLocation)
            return;

        this.emit('going-to-user-location');
        Utils.once(this._userLocation, "gone-to",
                   () => this.emit('gone-to-user-location'));
        this._userLocation.goTo(animate);
    }

    gotoAntipode() {
        let lat = -this.view.latitude;
        let lon = this.view.longitude > 0 ?
                  this.view.longitude - 180 : this.view.longitude + 180;
        let place =
            new Place.Place({ location: new Location.Location({ latitude: lat,
                                                                longitude: lon }),
                              initialZoom: this.view.zoom_level });

        new MapWalker.MapWalker(place, this).goTo(true);
    }

    userLocationVisible() {
        let box = this.view.get_bounding_box();

        return box.covers(this._userLocation.latitude, this._userLocation.longitude);
    }

    _updateUserLocation() {
        if (!Application.geoclue.place)
            return;

        if (Application.geoclue.state !== Geoclue.State.ON) {
            if (this._userLocation)
                this._userLocation.visible = false;
            return;
        }

        if (!this._userLocation) {
            let place = Application.geoclue.place;
            this._userLocation = new UserLocationMarker.UserLocationMarker({ place: place,
                                                                             mapView: this });
            this._userLocationLayer.remove_all();
            this._userLocation.addToLayer(this._userLocationLayer);
        }

        this._userLocation.visible = true;

        this.emit('user-location-changed');
    }

    _storeLocation() {
        let zoom = this.view.zoom_level;
        let location = [this.view.latitude, this.view.longitude];

        /* protect agains situations where the Champlain view was already
         * disposed, in this case zoom will be set to the GObject property
         * getter
         */
        if (!isNaN(zoom)) {
            Application.settings.set('zoom-level', zoom);
            Application.settings.set('last-viewed-location', location);
        } else {
            Utils.debug('Failed to extract location to store');
        }
    }

    _goToStoredLocation() {
        let location = Application.settings.get('last-viewed-location');

        if (location.length === 2) {
            let [lat, lon] = location;
            let zoom = Application.settings.get('zoom-level');

            if (zoom >= this.view.min_zoom_level &&
                zoom <= this.view.max_zoom_level)
                this.view.zoom_level = Application.settings.get('zoom-level');
            else
                Utils.debug('Invalid initial zoom level: ' + zoom);

            if (lat >= MIN_LATITUDE && lat <= MAX_LATITUDE &&
                lon >= MIN_LONGITUDE && lon <= MAX_LONGITUDE)
                this.view.center_on(location[0], location[1]);
            else
                Utils.debug('Invalid initial coordinates: ' + lat + ', ' + lon);
        } else {
            /* bounding box. for backwards compatibility, not used anymore */
            let bbox = new Champlain.BoundingBox({ top: location[0],
                                                   bottom: location[1],
                                                   left: location[2],
                                                   right: location[3] });
            this.view.connect("notify::realized", () => {
                if (this.view.realized)
                    this.gotoBBox(bbox, true);
            });
        }
    }

    gotoBBox(bbox, linear) {
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
    }

    showTurnPoint(turnPoint) {
        if (this._turnPointMarker)
            this._turnPointMarker.destroy();

        this._turnPointMarker = null;
        if (turnPoint.isStop())
            return;

        this._turnPointMarker = new TurnPointMarker.TurnPointMarker({ turnPoint: turnPoint,
                                                                      mapView: this });
        this._instructionMarkerLayer.add_marker(this._turnPointMarker);
        this._turnPointMarker.goTo();
    }

    showTransitStop(transitStop, transitLeg) {
        if (this._turnPointMarker)
            this._turnPointMarker.destroy();

        this._turnPointMarker = new TurnPointMarker.TurnPointMarker({ transitStop: transitStop,
                                                                      transitLeg: transitLeg,
                                                                      mapView: this });
        this._instructionMarkerLayer.add_marker(this._turnPointMarker);
        this._turnPointMarker.goTo();
    }

    showContact(contact) {
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
    }

    _showStoredRoute(stored) {
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
    }

    showPlace(place, animation) {
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
    }

    showRoute(route) {
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
    }

    _showDestinationTurnpoints() {
        let route = Application.routingDelegator.graphHopper.route;
        let query = Application.routeQuery;
        let pointIndex = 0;

        this._instructionMarkerLayer.remove_all();
        this._turnPointMarker = null;
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
    }

    _showTransitItinerary(itinerary) {
        this.gotoBBox(itinerary.bbox);
        this._clearRouteLayers();
        this._placeLayer.remove_all();
        this._instructionMarkerLayer.remove_all();
        this._turnPointMarker = null;

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
    }

    _showTransitPlan(plan) {
        this.gotoBBox(plan.bbox);
    }

    _onViewMoved() {
        this.emit('view-moved');
        if (this._storeId !== 0)
            return;

        this._storeId = Mainloop.timeout_add(_LOCATION_STORE_TIMEOUT, () => {
            this._storeId = 0;
            this._storeLocation();
        });
    }

    onSetMarkerSelected(selectedMarker) {
        this.emit('marker-selected', selectedMarker);
    }
});
