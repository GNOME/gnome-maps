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

import GObject from 'gi://GObject';
import Gdk from 'gi://Gdk';
import GeocodeGlib from 'gi://GeocodeGlib';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import Shumate from 'gi://Shumate';

import GnomeMaps from 'gi://GnomeMaps';

import {Application} from './application.js';
import {BoundingBox} from './boundingBox.js';
import * as Color from './color.js';
import * as Geoclue from './geoclue.js';
import * as GeocodeFactory from './geocode.js';
import {GeoJSONShapeLayer} from './geoJSONShapeLayer.js';
import {KmlShapeLayer} from './kmlShapeLayer.js';
import {GpxShapeLayer} from './gpxShapeLayer.js';
import {Location} from './location.js';
import * as MapSource from './mapSource.js';
import {MapWalker} from './mapWalker.js';
import {OSMAccountDialog} from './osmAccountDialog.js';
import {OSMEdit} from './osmEdit.js';
import {OSMEditDialog} from './osmEditDialog.js';
import {Place} from './place.js';
import {PlaceMarker} from './placeMarker.js';
import {RouteQuery} from './routeQuery.js';
import * as Service from './service.js';
import {ShapeLayer} from './shapeLayer.js';
import {StoredRoute} from './storedRoute.js';
import {TransitArrivalMarker} from './transitArrivalMarker.js';
import {TransitBoardMarker} from './transitBoardMarker.js';
import {TransitWalkMarker} from './transitWalkMarker.js';
import {TurnPointMarker} from './turnPointMarker.js';
import {UserLocationMarker} from './userLocationMarker.js';
import * as Utils from './utils.js';
import {ZoomInDialog} from './zoomInDialog.js';

const _LOCATION_STORE_TIMEOUT = 500;
const MapMinZoom = 2;
const MapMaxZoom = 19;

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

export class MapView extends Gtk.Overlay {

    static MapType = {
        LOCAL: 'MapsLocalSource',
        STREET: 'MapsStreetSource',
        AERIAL: 'MapsAerialSource'
    }

    /*
     * Due to the mathematics of spherical mericator projection,
     * the map must be truncated at a latitude less than 90 degrees.
     */
    static MAX_LATITUDE = 85.05112;
    static MIN_LATITUDE = -85.05112;
    static MAX_LONGITUDE = 180;
    static MIN_LONGITUDE = -180;

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

    get mapSource() {
        return this._mapSource;
    }

    constructor(params) {
        let mapTypeParam = params.mapType;
        delete params.mapType;

        let mainWindow = params.mainWindow;
        delete params.mainWindow;

        super(params);

        this._mainWindow = mainWindow;
        this._storeId = 0;
        this.map = this._initMap();

        this.child = this.map;

        this._initLicense();
        this.setMapType(mapTypeParam ?? this._getStoredMapType());

        this._initScale();
        this._initLayers();

        if (Application.normalStartup)
            this._goToStoredLocation();

        this.shapeLayerStore = new Gio.ListStore(GObject.TYPE_OBJECT);

        Application.geoclue.connect('location-changed',
                                    this._updateUserLocation.bind(this));
        Application.geoclue.connect('notify::state',
                                    this._updateUserLocation.bind(this));
        this._connectRouteSignals();

        let actions = {
            'route-from-here': {
                onActivate: () => this._onRouteFromHereActivated()
            },
            'add-intermediate-destination': {
                onActivate: () => this._onAddIntermediateDestinationActivated()
            },
            'route-to-here': {
                onActivate: () => this._onRouteToHereActivated()
            },
            'whats-here': {
                onActivate: () => this._onWhatsHereActivated()
            },
            'copy-location': {
                onActivate: () => this._onCopyLocationActivated()
            },
            'add-osm-location': {
                onActivate: () => this._onAddOSMLocationActivated()
            }
        };

        let actionGroup = new Gio.SimpleActionGroup();
        Utils.addActions(actionGroup, actions, null);
        this.insert_action_group('view', actionGroup);

        this._routeFromHereAction = actionGroup.lookup('route-from-here');
        this._routeToHereAction = actionGroup.lookup('route-to-here');
        this._addIntermediateDestinationAction = actionGroup.lookup('add-intermediate-destination');

        let builder = Gtk.Builder.new_from_resource('/org/gnome/Maps/ui/context-menu.ui');
        let menuModel = builder.get_object('context-menu');
        this._contextMenu = new Gtk.PopoverMenu({ menu_model: menuModel, has_arrow: false });
        this._contextMenu.set_parent(this);

        this._clickGesture = new Gtk.GestureClick({ button: Gdk.BUTTON_SECONDARY });
        this._clickGesture.connect('pressed', this._onClickGesturePressed.bind(this));
        this.add_controller(this._clickGesture);

        this._longPressGesture = new Gtk.GestureLongPress({ touch_only: true });;
        this._longPressGesture.connect('pressed',
                                       this._onLongPressGesturePressed.bind(this));
        this.add_controller(this._longPressGesture);
    }

    vfunc_size_allocate(width, height, baseline) {
        super.vfunc_size_allocate(width, height, baseline);
        this._contextMenu.present();
    }

    zoomIn() {
        let zoom = this.map.viewport.zoom_level;
        let maxZoom = this.map.viewport.max_zoom_level;
        let fraction = zoom - Math.floor(zoom);

        /* if we're zoomed to a fraction close to the next higher even zoom level
         * zoom to the next higher after that to avoid just going a tiny bit
         */
        this.map.go_to_full_with_duration(this.map.viewport.latitude,
                                          this.map.viewport.longitude,
                                          Math.min(fraction < 0.7 ?
                                                   Math.floor(zoom + 1) :
                                                   Math.floor(zoom + 2),
                                                   maxZoom),
                                          200);
    }

    zoomOut() {
        let zoom = this.map.viewport.zoom_level;
        let minZoom = this.map.viewport.min_zoom_level;
        let fraction = zoom - Math.floor(zoom);

        /* if we're zoomed to a fraction close to the next lower even zoom level
         * zoom to the next lower after that to avoid just going a tiny bit
         */
        this.map.go_to_full_with_duration(this.map.viewport.latitude,
                                          this.map.viewport.longitude,
                                          Math.max(fraction > 0.3 ?
                                                   Math.floor(zoom) :
                                                   Math.floor(zoom - 1),
                                                   minZoom),
                                          200);
    }

    _initScale() {
        let showScale = Application.settings.get('show-scale');

        this._scale = new Shumate.Scale({ visible:  showScale,
                                          viewport: this.map.viewport,
                                          halign:   Gtk.Align.START,
                                          valign:   Gtk.Align.END });

        if (Utils.getMeasurementSystem() === Utils.METRIC_SYSTEM)
            this._scale.unit = Shumate.Unit.METRIC;
        else
            this._scale.unit = Shumate.Unit.IMPERIAL;

        this.add_overlay(this._scale);
    }

    _initLicense() {
        this._license = new Shumate.License({ halign: Gtk.Align.END,
                                              valign: Gtk.Align.END });
        this.add_overlay(this._license);
    }

    _initMap() {
        let map = new Shumate.Map();

        map.viewport.max_zoom_level = MapMaxZoom;
        map.viewport.min_zoom_level = MapMinZoom;

        map.viewport.connect('notify::latitude', this._onViewMoved.bind(this));
        // switching map type will set view min-zoom-level from map source
        map.viewport.connect('notify::min-zoom-level', () => {
            if (map.viewport.min_zoom_level < MapMinZoom) {
                map.viewport.min_zoom_level = MapMinZoom;
            }
        });

        Application.settings.connect('changed::show-scale',
                                     this._onShowScaleChanged.bind(this));

        return map;
    }

    /* create and store a route layer, pass true to get a dashed line */
    _createRouteLayer(dashed, lineColor, outlineColor, width) {
        let strokeColor = new Gdk.RGBA({ red:    Color.parseColor(lineColor, 0),
                                         green:  Color.parseColor(lineColor, 1),
                                         blue:   Color.parseColor(lineColor, 2),
                                         alpha:  1.0 });
        let routeLayer = new Shumate.PathLayer({ viewport: this.map.viewport,
                                                 stroke_width: width,
                                                 stroke_color: strokeColor });
        if (dashed)
            routeLayer.set_dash([DASHED_ROUTE_LINE_FILLED_LENGTH,
                                 DASHED_ROUTE_LINE_GAP_LENGTH]);

        if (outlineColor) {
            let outlineStrokeColor =
                new Gdk.RGBA({ red:   Color.parseColor(outlineColor, 0),
                               green: Color.parseColor(outlineColor, 1),
                               blue:  Color.parseColor(outlineColor, 2),
                               alpha: 1.0 });

            routeLayer.outline_color = outlineStrokeColor;
            routeLayer.outline_width = 1.0;
        }

        this._routeLayers.push(routeLayer);
        this.map.insert_layer_behind(routeLayer, this._instructionMarkerLayer);

        return routeLayer;
    }

    _clearRouteLayers() {
        this._routeLayers.forEach((routeLayer) => {
            routeLayer.remove_all();
            routeLayer.visible = false;
            this.map.remove_layer(routeLayer);
        });

        this._routeLayers = [];
    }

    _initLayers() {
        let mode = Gtk.SelectionMode.MULTIPLE;

        this._userLocationLayer =
            new Shumate.MarkerLayer({ selection_mode: mode,
                                      viewport: this.map.viewport });
        this.map.add_layer(this._userLocationLayer);

        this._placeLayer =
            new Shumate.MarkerLayer({ selection_mode: mode,
                                      viewport: this.map.viewport });
        this.map.insert_layer_above(this._placeLayer, this._userLocationLayer);

        this._instructionMarkerLayer =
            new Shumate.MarkerLayer({ selection_mode: mode,
                                      viewport: this.map.viewport });
        this.map.insert_layer_above(this._instructionMarkerLayer,
                                     this._placeLayer);

        ShapeLayer.SUPPORTED_TYPES.push(GeoJSONShapeLayer);
        ShapeLayer.SUPPORTED_TYPES.push(KmlShapeLayer);
        ShapeLayer.SUPPORTED_TYPES.push(GpxShapeLayer);

        this._routeLayers = [];
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

        query.connect('notify', () => {
            this.routingOpen = query.isValid();
            this._clearRouteLayers();
            this._instructionMarkerLayer.remove_all();
            this.routeShowing = false;
        });

        query.connect('notify::points', () => {
            let query = Application.routeQuery;
            let numPoints = query.points.length;

            this._routeFromHereAction.enabled = numPoints < RouteQuery.MAX_QUERY_POINTS;
            this._routeToHereAction.enabled = numPoints < RouteQuery.MAX_QUERY_POINTS;
            this._addIntermediateDestinationAction.enabled =
                query.filledPoints.length >= 2 && numPoints < RouteQuery.MAX_QUERY_POINTS;
        });
    }

    _getStoredMapType() {
        let mapType = Application.settings.get('map-type');

        // make sure it's a valid map type
        for (let type in MapView.MapType) {
            if (mapType === MapView.MapType[type]) {
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

        //let overlay_sources = this.view.get_overlay_sources();

        this._mapType = mapType;

        let mapSource;

        if (mapType !== MapView.MapType.LOCAL) {
            let tiles = Service.getService().tiles;

            if (mapType === MapView.MapType.AERIAL && tiles.aerial)
                mapSource = MapSource.createAerialSource();
            else
                mapSource = MapSource.createStreetSource();

            // update license
            if (this._mapSource)
                this._license.remove_map_source(this._mapSource);

            this._license.append_map_source(mapSource);

            Application.settings.set('map-type', mapType);
        } else {
            let source = new GnomeMaps.FileDataSource({
                path: Utils.getBufferText(Application.application.local_tile_path)
            });
            try {
                source.prepare();

                mapSource =
                    new Shumate.RasterRenderer({ id: 'local',
                                                 name: 'local',
                                                 min_zoom_level: source.min_zoom,
                                                 max_zoom_level: source.max_zoom,
                                                 tile_size:      Application.application.local_tile_size ?? 512,
                                                 projection:     Shumate.MapProjection.MERCATOR,
                                                 data_source:    source });
            } catch(e) {
                this.setMapType(MapView.MapType.STREET);
                Application.application.local_tile_path = false;
                Utils.showDialog(e.message, Gtk.MessageType.ERROR, this._mainWindow);
                return;
            }
        }

        let mapLayer = new Shumate.MapLayer({ map_source: mapSource,
                                                  viewport:   this.map.viewport });

        this.map.add_layer(mapLayer);
        this._mapSource = mapSource;
        this.map.viewport.set_reference_map_source(mapSource);
        this.emit("map-type-changed", mapType);
    }

    _onShowScaleChanged() {
        this._scale.visible = Application.settings.get('show-scale');
    }

    _checkIfFileSizeNeedsConfirmation(files) {
        let confirmLoad = false;
        let totalFileSizeMB = 0;
        let file;
        let i = 0;

        do {
            let file = files.get_item(i);

            totalFileSizeMB += file.query_info(Gio.FILE_ATTRIBUTE_STANDARD_SIZE,
                                               0, null).get_size();
            i++;
        } while (file);
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
            dialog.present();
        } else {
            this._loadShapeLayers(files);
        }
        return true;
    }

    _loadShapeLayers(files) {
        let bbox = new BoundingBox();
        this._remainingFilesToLoad = files.get_n_items();

        for (let i = 0; i < files.get_n_items(); i++) {
            let file = files.get_item(i);

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
        }
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
            let location = new Location({ heading: -1 });
            location.set_from_uri(uri);

            let place = new Place({ location: location,
                                    name: location.description,
                                    store: false });
            let marker = new PlaceMarker({ place: place,
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
                let marker = new PlaceMarker({ place: place,
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
        let lat = -this.map.viewport.latitude;
        let lon = this.map.viewport.longitude > 0 ?
                  this.map.viewport.longitude - 180 :
                  this.map.viewport.longitude + 180;
        let place =
            new Place({ location: new Location({ latitude: lat,
                                                 longitude: lon }),
                        initialZoom: this.map.viewport.zoom_level });

        new MapWalker(place, this).goTo(true);
    }

    _getViewBBox() {
        let {x, y, width, height} = this.get_allocation();
        let [top, left] = this.map.viewport.widget_coords_to_location(0, 0);
        let [bottom, right] =
            this.map.viewport.widget_coords_to_location(width - 1, height - 1);

        return new BoundingBox({ left:   left,
                                 top:    top,
                                 right:  right,
                                 bottom: bottom });
    }

    userLocationVisible() {
        let box = this._getViewBBox();

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
            this._userLocation = new UserLocationMarker({ place: place,
                                                          mapView: this });
            this._userLocation.addToLayer(this._userLocationLayer);
        }

        this._userLocation.visible = true;

        this.emit('user-location-changed');
    }

    _storeLocation() {
        let viewport = this.map.viewport;
        let zoom = viewport.zoom_level;
        let location = [viewport.latitude, viewport.longitude];

        /* protect agains situations where the map view was already
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

            if (lat >= MapView.MIN_LATITUDE && lat <= MapView.MAX_LATITUDE &&
                lon >= MapView.MIN_LONGITUDE && lon <= MapView.MAX_LONGITUDE) {
                this.map.viewport.latitude = lat;
                this.map.viewport.longitude = lon;
                if (zoom >= this.map.viewport.min_zoom_level &&
                    zoom <= this.map.viewport.max_zoom_level) {
                    this.map.viewport.zoom_level = zoom;
                } else {
                    Utils.debug('Invalid initial zoom level: ' + zoom);
                }
            } else {
                Utils.debug('Invalid initial coordinates: ' + lat + ', ' + lon);
            }
        } else {
            /* bounding box. for backwards compatibility, not used anymore */
            let bbox = new BoundingBox({ top: location[0],
                                         bottom: location[1],
                                         left: location[2],
                                         right: location[3] });
            this.map.connect("notify::realized", () => {
                if (this.map.realized)
                    this.gotoBBox(bbox, true);
            });
        }
    }

    gotoBBox(bbox, linear) {
        if (!bbox.isValid()) {
            Utils.debug('Bounding box is invalid');
            return;
        }

        let [lon, lat] = bbox.getCenter();
        let place = new Place({
            location: new Location({ latitude  : lat,
                                              longitude : lon }),
            bounding_box: new GeocodeGlib.BoundingBox({ top    : bbox.top,
                                                        bottom : bbox.bottom,
                                                        left   : bbox.left,
                                                        right  : bbox.right })
        });
        new MapWalker(place, this).zoomToFit();
    }

    getZoomLevelFittingBBox(bbox) {
        let mapSource = this._mapSource;
        let goodSize = false;
        let zoomLevel = this.map.viewport.max_zoom_level;

        do {

            let minX = mapSource.get_x(zoomLevel, bbox.left);
            let minY = mapSource.get_y(zoomLevel, bbox.bottom);
            let maxX = mapSource.get_x(zoomLevel, bbox.right);
            let maxY = mapSource.get_y(zoomLevel, bbox.top);
            let {x, y, width, height} = this.get_allocation();

            if (minY - maxY <= height && maxX - minX <= width)
                goodSize = true;
            else
                zoomLevel--;

            if (zoomLevel <= this.map.viewport.min_zoom_level) {
                zoomLevel = this.map.viewport.min_zoom_level;
                goodSize = true;
            }
        } while (!goodSize);

        return zoomLevel;
    }

    showTurnPoint(turnPoint) {
        if (this._turnPointMarker)
            this._instructionMarkerLayer.remove_marker(this._turnPointMarker);

        this._turnPointMarker = null;
        if (turnPoint.isStop())
            return;

        this._turnPointMarker = new TurnPointMarker({ turnPoint: turnPoint,
                                                      mapView: this });
        this._instructionMarkerLayer.add_marker(this._turnPointMarker);
        this._turnPointMarker.goTo();
    }

    showTransitStop(transitStop, transitLeg) {
        if (this._turnPointMarker)
            this._instructionMarkerLayer.remove_marker(this._turnPointMarker);

        this._turnPointMarker = new TurnPointMarker({ transitStop: transitStop,
                                                      transitLeg: transitLeg,
                                                      mapView: this });
        this._instructionMarkerLayer.add_marker(this._turnPointMarker);
        this._turnPointMarker.goTo();
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

        if (place instanceof StoredRoute) {
            this._showStoredRoute(place);
            return;
        }

        this.routingOpen = false;
        let placeMarker = new PlaceMarker({ place: place,
                                            mapView: this });

        this._placeLayer.add_marker(placeMarker);
        placeMarker.goToAndSelect(animation);
        Application.application.selected_place = place;
    }

    showRoute(route) {
        let routeLayer;

        this._clearRouteLayers();
        this._placeLayer.remove_all();

        routeLayer = this._createRouteLayer(false, TURN_BY_TURN_ROUTE_COLOR,
                                            null, ROUTE_LINE_WIDTH);
        route.path.forEach((polyline) => routeLayer.add_node(polyline));
        this.routingOpen = true;

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
                let destinationMarker = new TurnPointMarker({ turnPoint: turnPoint,
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
            let lineWidth = ROUTE_LINE_WIDTH + (hasOutline ? 2 : 0);

            routeLayer = this._createRouteLayer(dashed, color,
                                                hasOutline ? outlineColor : null,
                                                lineWidth);

            /* if this is a walking leg and not at the start, "stitch" it
             * together with the end point of the previous leg, as the walk
             * route might not reach all the way */
            if (index > 0 && !leg.transit) {
                let previousLeg = itinerary.legs[index - 1];
                let lastPoint = previousLeg.polyline.last();

                routeLayer.add_node(lastPoint);
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
        })

        itinerary.legs.forEach((leg, index) => {
            let previousLeg = index === 0 ? null : itinerary.legs[index - 1];

            /* add start marker */
            let start;
            if (!leg.transit) {
                start = new TransitWalkMarker({ leg: leg,
                                                previousLeg: previousLeg,
                                                mapView: this });
            } else {
                start = new TransitBoardMarker({ leg: leg,
                                                 mapView: this });
            }

            this._instructionMarkerLayer.add_marker(start);
        });

        /* add arrival marker */
        let lastLeg = itinerary.legs.last();
        let arrival = new TransitArrivalMarker({ leg: lastLeg,
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

        this._storeId = GLib.timeout_add(null, _LOCATION_STORE_TIMEOUT, () => {
            this._storeId = 0;
            this._storeLocation();
        });
    }

    onSetMarkerSelected(selectedMarker) {
        this.emit('marker-selected', selectedMarker);
    }

    _onClickGesturePressed(gesture, n_presses, x, y) {
        if (n_presses > 1) {
            gesture.set_state(Gtk.EventSequenceState.DENIED);
            return;
        }

        let event = gesture.get_current_event();
        if (event.triggers_context_menu()) {
            this._showContextMenuAt(x, y);
            gesture.set_state(Gtk.EventSequenceState.CLAIMED);
        }

        gesture.set_state(Gtk.EventSequenceState.DENIED);
    }

    _onLongPressGesturePressed(gesture, x, y) {
        this._showContextMenuAt(x, y);
        gesture.set_state(Gtk.EventSequenceState.CLAIMED);
    }

    _showContextMenuAt(x, y) {
        let viewport = this.map.viewport;
        let rect = new Gdk.Rectangle({ x: x, y: y, width: 0, height: 0 });

        [this._latitude, this._longitude] = viewport.widget_coords_to_location(this, x, y);

        if (this.direction === Gtk.TextDirection.RTL) {
            this._contextMenu.halign = Gtk.Align.END;
        } else {
            this._contextMenu.halign = Gtk.Align.START;
        }

        this._contextMenu.pointing_to = rect;
        this._contextMenu.popup();
    }

    _onRouteFromHereActivated() {
        let query = Application.routeQuery;
        let location = new Location({ latitude: this._latitude,
                                      longitude: this._longitude,
                                      accuracy: 0 });
        let place = new Place({ location: location, store: false });

        query.points[0].place = place;
    }

    _onAddIntermediateDestinationActivated() {
        let query = Application.routeQuery;
        let location = new Location({ latitude: this._latitude,
                                      longitude: this._longitude,
                                      accuracy: 0 });
        let place = new Place({ location: location, store: false });

        query.addPoint(-1).place = place;
    }

    _onRouteToHereActivated() {
        let query = Application.routeQuery;
        let location = new Location({ latitude: this._latitude,
                                      longitude: this._longitude,
                                      accuracy: 0 });
        let place = new Place({ location: location, store: false });

        query.points.last().place = place;
    }

    _onWhatsHereActivated() {
        GeocodeFactory.getGeocoder().reverse(this._latitude, this._longitude,
                                      (place) => {
            if (place) {
                this.showPlace(place, true);
            } else {
                let msg = _("Nothing found here!");

                Utils.showDialog(msg, Gtk.MessageType.INFO, this._mainWindow);
            }
        });
    }

    _onCopyLocationActivated() {
        let location = new Location({ latitude: this._latitude,
                                      longitude: this._longitude,
                                      accuracy: 0 });
        let clipboard = this.get_clipboard();
        let uri = location.to_uri(GeocodeGlib.LocationURIScheme.GEO);

        clipboard.set(uri);
    }

    _onAddOSMLocationActivated() {
        let osmEdit = Application.osmEdit;
        /* if the user is not already signed in, show the account dialog */
        if (!osmEdit.isSignedIn) {
            let dialog = osmEdit.createAccountDialog(this._mainWindow, true);

            dialog.show();
            dialog.connect('response', (dialog, response) => {
                dialog.destroy();
                if (response === OSMAccountDialog.Response.SIGNED_IN)
                    this._addOSMLocation();
            });

            return;
        }

        this._addOSMLocation();
    }

    _addOSMLocation() {
        let osmEdit = Application.osmEdit;
        let viewport = this.map.viewport;

        if (viewport.zoom_level < OSMEdit.MIN_ADD_LOCATION_ZOOM_LEVEL) {
            let zoomInDialog =
                new ZoomInDialog({ longitude: this._longitude,
                                   latitude: this._latitude,
                                   map: this.map,
                                   transient_for: this._mainWindow,
                                   modal: true });

            zoomInDialog.connect('response', () => zoomInDialog.destroy());
            zoomInDialog.show();
            return;
        }

        let dialog =
            osmEdit.createEditNewDialog(this._mainWindow,
                                        this._latitude, this._longitude);

        dialog.show();
        dialog.connect('response', (dialog, response) => {
            dialog.destroy();
            if (response === OSMEditDialog.Response.UPLOADED) {
                Utils.showDialog(_("Location was added to the map, note that it may take a while before it shows on the map and in search results."),
                                 Gtk.MessageType.INFO, this._mainWindow);
            }
        });
    }
}

GObject.registerClass({
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
        'marker-selected': { param_types: [Shumate.Marker] },
        'map-type-changed': { param_types: [GObject.TYPE_STRING] }
    },
}, MapView);
