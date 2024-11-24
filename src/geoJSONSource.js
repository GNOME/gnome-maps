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

import Cairo from 'cairo';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Shumate from 'gi://Shumate';

import GnomeMaps from 'gi://GnomeMaps';

import {BoundingBox} from './boundingBox.js';
import * as Geojsonvt from './geojsonvt/geojsonvt.js';
import {Location} from './location.js';
import {Place} from './place.js';
import {PlaceMarker} from './placeMarker.js';
import * as Utils from './utils.js';
import {GeoJSONStyle} from './geoJSONStyle.js';
import {MapView} from './mapView.js';

const TileFeature = { POINT: 1,
                      LINESTRING: 2,
                      POLYGON: 3 };

export class GeoJSONSource extends GnomeMaps.SyncMapSource {

    constructor({mapView, markerLayer, filename, ...params}) {
        super(params);

        this._mapView = mapView;
        this._markerLayer = markerLayer;
        this._bbox = new BoundingBox();
        this._filename = filename;
        this.tile_size = mapView.map.viewport.reference_map_source.tile_size;
        this.max_zoom_level = mapView.map.viewport.max_zoom_level;
        this.min_zoom_level = mapView.map.viewport.min_zoom_level;
    }

    get bbox() {
        return this._bbox;
    }

    vfunc_fill_tile(tile) {
        if (tile.get_state() === Shumate.State.DONE)
            return;

        this._renderTile(tile);
    }

    _validate([lon, lat]) {
        if ((-180 <= lon && lon <= 180) &&
            (-90  <= lat && lat <= 90)) {
            return;
        }

        throw new Error(_("invalid coordinate"));
    }

    _compose(coordinates) {
        coordinates.forEach((coordinate) => {
            this._validate(coordinate);
            this._bbox.extend(coordinate[1], coordinate[0]);
        });
    }

    _clampBBox() {
        this._bbox.top = Math.min(this._bbox.top, MapView.MAX_LATITUDE);
        this._bbox.left = Math.max(this._bbox.left, MapView.MIN_LONGITUDE);
        this._bbox.bottom = Math.max(this._bbox.bottom, MapView.MIN_LATITUDE);
        this._bbox.right = Math.min(this._bbox.right, MapView.MAX_LONGITUDE);
    }

    _parseLineString(coordinates) {
        this._compose(coordinates);
    }

    _parsePolygon(coordinates) {
        coordinates.forEach((coordinate) => this._compose(coordinate));
    }

    _parsePoint(coordinates, properties) {
        let name = null, description = null;
        if (properties) {
            name = properties.title ?? properties.name;
            description = properties.description;
        }

        this._validate(coordinates);
        this._bbox.extend(coordinates[1],
                          coordinates[0]);

        let location = new Location({ latitude: coordinates[1],
                                      longitude: coordinates[0] });

        let place = new Place({
            name,
            description,
            source: this._filename,
            store: false,
            location: location
        });
        let placeMarker = new PlaceMarker({ place: place,
                                            mapView: this._mapView });
        this._markerLayer.add_marker(placeMarker);
    }

    _parseGeometry(geometry, properties) {
        if(!geometry)
            throw new Error(_("parse error"));

        switch(geometry.type) {
        case 'LineString':
            this._parseLineString(geometry.coordinates);
            break;

        case 'MultiLineString':
            geometry.coordinates.forEach((coordinate) => {
                this._parseLineString(coordinate);
            });
            break;

        case 'Polygon':
            this._parsePolygon(geometry.coordinates);
            break;

        case 'MultiPolygon':
            geometry.coordinates.forEach((coordinate) => {
                this._parsePolygon(coordinate);
            });
            break;

        case 'Point':
            this._parsePoint(geometry.coordinates, properties);
            break;

        case 'MultiPoint':
            geometry.coordinates.forEach((coordinate, properties) => {
                this._parsePoint(coordinate,properties);
            });
            break;

        default:
            throw new Error(_("unknown geometry"));
        }
    }

    _parseInternal(root) {
        if (!root || !root.type)
            throw new Error(_("parse error"));

        switch(root.type) {
        case 'FeatureCollection':
            root.features.forEach((feature) => {
                this._parseGeometry(feature.geometry, feature.properties);
            });
            break;

        case 'Feature':
            this._parseGeometry(root.geometry, root.properties);
            break;

        case 'GeometryCollection':
            if (!root.geometries)
                throw new Error(_("parse error"));

            root.geometries.forEach((g) => this._parseGeometry(g));
            break;

        default:
            this._parseGeometry(root);
        }
    }

    parse(json) {
        this._parseInternal(json);
        this._tileIndex = Geojsonvt.geojsonvt(json, { extent: this.tile_size,
                                                      maxZoom: this.max_zoom_level });
        this._clampBBox();
    }

    _renderTile(tile) {
        let tileJSON = this._tileIndex.getTile(tile.zoom_level, tile.x, tile.y);
        let surface = new Cairo.ImageSurface(Cairo.Format.ARGB32,
                                             this.tile_size, this.tile_size);
        let cr = new Cairo.Context(surface);

        cr.setOperator(Cairo.Operator.CLEAR);
        cr.paint();
        cr.setOperator(Cairo.Operator.OVER);
        cr.setFillRule(Cairo.FillRule.EVEN_ODD);

        if (!tileJSON) {
            return;
        }

        tileJSON.features.forEach((feature) => {
            if (feature.type === TileFeature.POINT)
                return;

            let geoJSONStyleObj = GeoJSONStyle.parseSimpleStyle(feature.tags);

            feature.geometry.forEach((geometry) => {
                let first = true;
                cr.moveTo(0, 0);
                cr.setLineWidth(geoJSONStyleObj.lineWidth);
                cr.setSourceRGBA(geoJSONStyleObj.color.red,
                                 geoJSONStyleObj.color.green,
                                 geoJSONStyleObj.color.blue,
                                 geoJSONStyleObj.alpha);

                geometry.forEach(function(coord) {
                    if (first) {
                        cr.moveTo(coord[0], coord[1]);
                        first = false;
                    } else {
                        cr.lineTo(coord[0], coord[1]);
                    }
                });
            });
            if (feature.type === TileFeature.POLYGON) {
                cr.closePath();
                cr.strokePreserve();
                cr.setSourceRGBA(geoJSONStyleObj.fillColor.red,
                                 geoJSONStyleObj.fillColor.green,
                                 geoJSONStyleObj.fillColor.blue,
                                 geoJSONStyleObj.fillAlpha);
                cr.fill();
            } else {
                cr.stroke();
            }
        });

        let paintable =
            Gdk.Texture.new_for_pixbuf(Gdk.pixbuf_get_from_surface(surface, 0, 0,
                                                                   this.tile_size,
                                                                   this.tile_size));

        tile.set_paintable(paintable);
        tile.state = Shumate.State.DONE;
    }
}

GObject.registerClass(GeoJSONSource);
