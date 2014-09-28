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
const GData = imports.gi.GData;
const Pango = imports.gi.Pango;
const GLib = imports.gi.GLib;

const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Signals = imports.signals;

const Application = imports.application;
const Utils = imports.utils;
const Path = imports.path;
const MapLocation = imports.mapLocation;
const UserLocation = imports.userLocation;
const _ = imports.gettext.gettext;

const MapType = {
    STREET:  Champlain.MAP_SOURCE_OSM_MAPQUEST,
    AERIAL:  Champlain.MAP_SOURCE_OSM_AERIAL_MAP,
    CYCLING: Champlain.MAP_SOURCE_OSM_CYCLE_MAP,
    TRANSIT: Champlain.MAP_SOURCE_OSM_TRANSPORT_MAP
};

const MapMinZoom = 2;

const PoiType = {
    TOURIST_PLACE:    1,
    NATURAL_LOCATION: 2
};

const MapView = new Lang.Class({
    Name: 'MapView',
    Extends: GtkChamplain.Embed,

    _init: function() {
        this.parent();

        this.view = this._initView();
        this._initLayers();
        this._initPoi();

        this._factory = Champlain.MapSourceFactory.dup_default();
        this.setMapType(MapType.STREET);

        this._updateUserLocation();
        Application.geoclue.connect("location-changed",
                                    this._updateUserLocation.bind(this));

        this._connectRouteSignals(Application.routeService.route);
    },

    _initView: function() {
        let view = this.get_view();
        view.set_zoom_level(3);
        view.min_zoom_level = MapMinZoom;
        view.goto_animation_mode = Clutter.AnimationMode.EASE_IN_OUT_CUBIC;
        view.set_reactive(true);

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
        this._routeLayer = new Champlain.PathLayer();
        this._routeLayer.set_stroke_width(2.0);
        this.view.add_layer(this._routeLayer);

        this._markerLayer = new Champlain.MarkerLayer();
        this._markerLayer.set_selection_mode(Champlain.SelectionMode.SINGLE);
        this.view.add_layer(this._markerLayer);

        this._userLocationLayer = new Champlain.MarkerLayer();
        this._userLocationLayer.set_selection_mode(Champlain.SelectionMode.SINGLE);
        this.view.add_layer(this._userLocationLayer);

        this._poiLayer = new Champlain.MarkerLayer();
        this._poiLayer.set_selection_mode(Champlain.SelectionMode.SINGLE);
        this.view.add_layer(this._poiLayer);
    },

    _connectRouteSignals: function(route) {
        route.connect('update', this.showRoute.bind(this, route));
        route.connect('reset', this._routeLayer.remove_all.bind(this._routeLayer));
    },

    setMapType: function(mapType) {
        if (this.view.map_source.get_id() === mapType)
            return;

        let source = this._factory.create_cached_source(mapType);
        this.view.set_map_source(source);
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
        this._unsetPoi();
        let mapLocation = this.showLocation(place);
        mapLocation.goTo(true);
    },

    showRoute: function(route) {
        this._routeLayer.remove_all();

        route.path.forEach(this._routeLayer.add_node.bind(this._routeLayer));

        // Animate to the center of the route bounding box
        // goto() is currently implemented on mapLocation, so we need to go
        // through some hoops here.
        let [lat, lon] = route.bbox.get_center();
        let place = new Geocode.Place({
            location     : new Geocode.Location({ latitude  : lat,
                                                  longitude : lon }),
            bounding_box : new Geocode.BoundingBox({ top    : route.bbox.top,
                                                     bottom : route.bbox.bottom,
                                                     left   : route.bbox.left,
                                                     right  : route.bbox.right })
        });
        let mapLocation = new MapLocation.MapLocation(place, this);

        mapLocation.goTo(true);
    },

    _initPoi: function() {
        this._poiLocationInfo = {};
        this._poiElements = {};
        this._poiLocationInfo[PoiType.TOURIST_PLACE] = { minZoom: 12,
                                                         image: Path.ICONS_DIR + "/pin.svg"};
        this._poiLocationInfo[PoiType.NATURAL_LOCATION] = { minZoom: 7,
                                                            image: Path.ICONS_DIR + "/pin.svg" };
    },

    _unsetPoi: function() {
        this._poiLayer.remove_all();
        this._poiElements = {};
        this._highlightedPoiMarker = null;
    },

    _updatePoiImage: function(marker) {
        let image = new Clutter.Image();
        let format;

        if (marker.imagePixbuf.get_n_channels() == 3)
            format = Cogl.PixelFormat.RGB_888;
        else
            format = Cogl.PixelFormat.RGBA_8888;

        image.set_data(marker.imagePixbuf.get_pixels(),
                       format,
                       marker.imagePixbuf.get_width(),
                       marker.imagePixbuf.get_height(),
                       marker.imagePixbuf.get_rowstride());

        this._highlightedPoiImage.set_content(image);
        this._highlightedPoiImage.height = marker.imagePixbuf.get_height();
        image.invalidate();
    },

    _updateHighlightedPoi: function(marker) {
        if (this._highlightedPoi == marker)
            return;

        this._highlightedPoi = marker;

        if (!this._highlightedPoiMarker) {
            this._highlightedPoiImage = new Clutter.Actor({ width: 80, height: 80 });
            this._highlightedPoiMarker = new Champlain.Label({ ellipsize: Pango.EllipsizeMode.END,
                                                               image: this._highlightedPoiImage,
                                                               single_line_mode: false,
                                                               use_markup: true,
                                                               wrap: true });
            this._poiLayer.add_marker(this._highlightedPoiMarker);
        }

        this._highlightedPoiImage.set_content(null);

        if (marker.imagePixbuf)
            this._updatePoiImage(marker);
        else if (marker.imageStream) {
            GdkPixbuf.Pixbuf.new_from_stream_at_scale_async(marker.imageStream, 80, -1,
                                                            true, null, (function(stream, res) {
                marker.imagePixbuf = GdkPixbuf.Pixbuf.new_from_stream_finish(res);
                this._updatePoiImage(marker);
            }).bind(this));
        }

        let markup;
        markup = "<span size='larger'>" + GLib.markup_escape_text(marker.place.location.description, -1) + "</span>\n";

        if (marker.longText)
            markup += GLib.markup_escape_text(marker.longText, -1);

        this._highlightedPoiMarker.text = markup;
        this._highlightedPoiMarker.set_location(marker.place.location.latitude,
                                                marker.place.location.longitude);
    },

    _addPoiItem: function(object, id, locationType) {
        let nameValue = object.get_property_value('/type/object/name', 0);
        let geolocationValue = object.get_property_value('/location/location/geolocation', 0);
        let descValue = object.get_property_value('/common/topic/description', 0);
        let imageValue = object.get_property_value('/common/topic/image', 0);
        let latValue = null, lonValue = null;

        if (geolocationValue) {
            let geolocationObject = geolocationValue.get_object();
            latValue = geolocationObject.get_property_value('/location/geocode/latitude', 0);
            lonValue = geolocationObject.get_property_value('/location/geocode/longitude', 0);
        }

        if (nameValue && latValue && lonValue) {
            let place = new Geocode.Place({
                place_type : Geocode.PlaceType.POINT_OF_INTEREST,
                location   : new Geocode.Location({ description : nameValue.get_string(),
                                                    latitude    : latValue.get_double(),
                                                    longitude   : lonValue.get_double() }),
            });

            let marker = new Champlain.Marker();
            let imageActor = Utils.CreateActorFromImageFile(this._poiLocationInfo[locationType].image);
            marker.add_child(imageActor);
            marker.place = place;
            marker.set_location(place.location.latitude, place.location.longitude);
            marker.connect('button-press', Lang.bind(this, function(marker) {
                this._updateHighlightedPoi(marker);
            }));
            marker.connect('notify::size', Lang.bind(this, function() {
                marker.set_translation(-Math.floor(marker.get_width() / 2),
                                       -Math.floor(marker.get_height() / 2),
                                       0);
            }));

            if (descValue)
                marker.longText = descValue.get_string();
            if (imageValue)
                marker.imageStream = Application.freebase.get_image(imageValue, null, 512, 512);

            this._poiLayer.add_marker(marker);
            this._poiElements[id] = marker;
        }
    },

    _getRadiusForView: function() {
        let box = this.view.get_bounding_box();
        let topLeft = new Geocode.Location({ latitude  : box.top,
                                             longitude : box.left });
        let bottomRight = new Geocode.Location({ latitude  : box.bottom,
                                                 longitude : box.right });

        // Return radius in meters
        return topLeft.get_distance_from(bottomRight) * 1000 / 2;
    },

    _createQuery: function(locationType) {
        let searchQuery = new GData.FreebaseSearchQuery();

        searchQuery.open_filter(GData.FreebaseSearchFilterType.ALL);
        searchQuery.add_location(this._getRadiusForView(),
                                 this.view.latitude,
                                 this.view.longitude);

        searchQuery.open_filter(GData.FreebaseSearchFilterType.ANY);

        if (locationType == PoiType.TOURIST_PLACE) {
            searchQuery.add_filter('type', '/travel/tourist_attraction');
            searchQuery.add_filter('type', '/architecture/museum');
        } else if (locationType == PoiType.NATURAL_LOCATION) {
            searchQuery.add_filter('type', '/geography/mountain');
            searchQuery.add_filter('type', '/protected_sites/protected_site');
        } else {
            return null;
        }

        searchQuery.close_filter();
        searchQuery.close_filter();

        return searchQuery;
    },

    _updatePoiLocation: function(locationType) {
        if (!Application.freebase)
            return;

        // Don't show POI on too wide views
        if (this.view.zoom_level < this._poiLocationInfo[locationType].minZoom)
            return;

        let searchQuery = this._createQuery(locationType);

        if (!searchQuery)
            return;

        Application.freebase.search_async(searchQuery, null, Lang.bind(this, function(service, res) {
            let result = service.query_single_entry_finish(res);

            for (let i = 0; i < result.get_num_items(); i++) {
                let item = result.get_item(i);

                if (this._poiElements[item.get_mid()])
                    continue;

                let topicQuery = new GData.FreebaseTopicQuery({q: item.get_mid()});

                service.get_topic_async(topicQuery, null, Lang.bind(this, function(service, res) {
                    let result = service.query_single_entry_finish(res);
                    this._addPoiItem(result.dup_object(), item.get_mid(), locationType);
                }));
            }
        }));
    },

    _updatePoiLayer: function() {
        for (let type in PoiType)
            this._updatePoiLocation(PoiType[type]);
    },

    _onViewMoved: function() {
        if (this._queryPoiTimeoutId)
            Mainloop.source_remove(this._queryPoiTimeoutId);
        this._queryPoiTimeoutId = Mainloop.timeout_add_seconds(1, Lang.bind(this, function() {
            this._updatePoiLayer();
            this._queryPoiTimeoutId = 0;
            return false;
        }));

        this.emit('view-moved');
    }
});
Utils.addSignalMethods(MapView.prototype);
