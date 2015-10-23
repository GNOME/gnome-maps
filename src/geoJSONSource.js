/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
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
 * Author: Jonas Danielsson <jonas@threetimestwo.org>
 */

const Cairo = imports.cairo;
const Champlain = imports.gi.Champlain;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

const Geojsonvt = imports.geojsonvt.geojsonvt;
const Location = imports.location;
const Place = imports.place;
const PlaceMarker = imports.placeMarker;
const Utils = imports.utils;

const TILE_SIZE = 256;

const TileFeature = { POINT: 1,
                      LINESTRING: 2,
                      POLYGON: 3 };

const GeoJSONSource = new Lang.Class({
    Name: 'GeoJSONSource',
    Extends: Champlain.TileSource,

    _init: function(params) {
        this.parent();

        this._file = params.file;
        this._mapView = params.mapView;
        this._markerLayer = params.markerLayer;
        this._bbox = new Champlain.BoundingBox();
    },

    get bbox() {
        return this._bbox;
    },

    vfunc_get_tile_size: function() {
        return TILE_SIZE;
    },

    vfunc_get_max_zoom_level: function() {
        return 20;
    },

    vfunc_get_min_zoom_level: function() {
        return 0;
    },

    vfunc_get_id: function() {
        return 'GeoJSONSource';
    },

    vfunc_get_name: function() {
        return 'GeoJSONSource';
    },

    vfunc_fill_tile: function(tile) {
        if (tile.get_state() === Champlain.State.DONE)
            return;

        tile.connect('render-complete', (function(tile, data, size, error) {
            if(!error) {
                tile.set_state(Champlain.State.DONE);
                tile.display_content();
            } else if(this.next_source)
                this.next_source.fill_tile(tile);
        }).bind(this));

        Mainloop.idle_add(this._renderTile.bind(this, tile));
    },

    _validate: function(coordinate) {
        if (!(-180 <= coordinate[0] && coordinate[0] <= 180) &&
            (-90 <= coordinate[1]  && coordinate[1] <= 90)) {
                throw new Error(_("invalid coordinate found"));
        }
    },

    _compose: function(coordinates) {
        coordinates.forEach((function(coordinate) {
            this._validate(coordinate);
            this._bbox.extend(coordinate[1], coordinate[0]);
        }).bind(this));
    },

    _parseLineString: function(coordinates) {
        this._compose(coordinates);
    },

    _parsePolygon: function(coordinates) {
        coordinates.forEach((function(coordinate) {
            this._compose(coordinate);
        }).bind(this));
    },

    _parseGeometry: function(geometry, properties) {
        if(!geometry)
            throw new Error(_("parse error"));

        switch(geometry.type) {
        case 'LineString':
            this._parseLineString(geometry.coordinates);
            break;

        case 'MultiLineString':
            geometry.coordinates.forEach((function(coordinate) {
                this._parseLineString(coordinate);
            }).bind(this));
            break;

        case 'Polygon':
            this._parsePolygon(geometry.coordinates);
            break;

        case 'MultiPolygon':
            geometry.coordinates.forEach((function(coordinate) {
                this._parsePolygon(coordinate);
            }).bind(this));
            break;

        case 'Point':
            let name = null;
            if (properties)
                name = properties.name;

            this._validate(geometry.coordinates);
            this._bbox.extend(geometry.coordinates[1],
                              geometry.coordinates[0]);

            let location = new Location.Location({
                latitude: geometry.coordinates[1],
                longitude: geometry.coordinates[0]
            });

            let place = new Place.Place({ name: name,
                                          location: location });
            let placeMarker = new PlaceMarker.PlaceMarker({ place: place,
                                                            mapView: this._mapView });
            this._markerLayer.add_marker(placeMarker);

        case 'MultiPoint':
            break;

        default:
            throw new Error(_("unknown geometry"));
        }
    },

    _parseInternal: function(root) {
        if (!root || !root.type)
            throw new Error(_("parse error"));

        switch(root.type) {
        case 'FeatureCollection':
            root.features.forEach((function(feature) {
                this._parseGeometry(feature.geometry, feature.properties);
            }).bind(this))
            break;

        case 'Feature':
            this._parseGeometry(root.geometry, root.properties);

        case 'GeometryCollection':
            if (!root.geometries)
                throw new Error(_("parse error"));

            root.geometries.forEach(this._parseGeometry.bind(this));
            break;

        default:
            this._parseGeometry(root);
        }
    },

    parse: function() {
        let [status, buffer] = this._file.load_contents(null);
        if (!status)
            throw new Error(_("failed to load file"));

        let json = JSON.parse(buffer);
        this._parseInternal(json);
        this._tileIndex = Geojsonvt.geojsonvt(json, { extent: TILE_SIZE,
                                                      maxZoom: 20 });
    },

    _renderTile: function(tile) {
        let tileJSON = this._tileIndex.getTile(tile.zoom_level, tile.x, tile.y);

        if (!tileJSON) {
            tile.emit('render-complete', null, 0, false);
            return;
        }

        let content = new Clutter.Canvas({ width: TILE_SIZE,
                                           height: TILE_SIZE });
        tile.content = new Clutter.Actor({ width: TILE_SIZE,
                                           height: TILE_SIZE,
                                           content: content });

        content.connect('draw', (function(canvas, cr) {
            cr.setOperator(Cairo.Operator.CLEAR);
            cr.paint();
            cr.setOperator(Cairo.Operator.OVER);
            cr.setSourceRGB(0, 0, 0);
            cr.setLineWidth(1);

            tileJSON.features.forEach(function(feature) {
                if (feature.type === TileFeature.POINT)
                    return;

                feature.geometry.forEach(function(geometry) {
                    let first = true;
                    cr.moveTo(0, 0);
                    geometry.forEach(function(coord) {
                        if (first) {
                            cr.moveTo(coord[0], coord[1]);
                            first = false;
                        } else {
                            cr.lineTo(coord[0], coord[1]);
                        }
                    });
                });
                if (feature.type === TileFeature.POLYGON)
                    cr.closePath();
                cr.stroke();
            });

            tile.emit('render-complete', null, 0, false);
        }).bind(this));

        content.invalidate();
    }
});
