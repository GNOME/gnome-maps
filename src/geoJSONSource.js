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
import Champlain from 'gi://Champlain';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import {BoundingBox} from './boundingBox.js';
import * as Geojsonvt from './geojsonvt/geojsonvt.js';
import {Location} from './location.js';
import {Place} from './place.js';
import {PlaceMarker} from './placeMarker.js';
import * as Service from './service.js';
import * as Utils from './utils.js';
import {GeoJSONStyle} from './geoJSONStyle.js';
import {MapView} from './mapView.js';

const TileFeature = { POINT: 1,
                      LINESTRING: 2,
                      POLYGON: 3 };

export class GeoJSONSource extends Champlain.TileSource {

    constructor(params) {
        super();

        this._mapView = params.mapView;
        this._markerLayer = params.markerLayer;
        this._bbox = new BoundingBox();
        this._tileSize = Service.getService().tiles.street.tile_size;
    }

    get bbox() {
        return this._bbox;
    }

    vfunc_get_tile_size() {
        return this._tileSize;
    }

    vfunc_get_max_zoom_level() {
        return 20;
    }

    vfunc_get_min_zoom_level() {
        return 0;
    }

    vfunc_get_id() {
        return 'GeoJSONSource';
    }

    vfunc_get_name() {
        return 'GeoJSONSource';
    }

    vfunc_fill_tile(tile) {
        if (tile.get_state() === Champlain.State.DONE)
            return;

        tile.connect('render-complete', (tile, data, size, error) => {
            if(!error) {
                tile.set_state(Champlain.State.DONE);
                tile.display_content();
            } else if(this.next_source)
                this.next_source.fill_tile(tile);
        });

        GLib.idle_add(tile, () => this._renderTile(tile));
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
        let name = null;
        if (properties)
            name = properties.name;

        this._validate(coordinates);
        this._bbox.extend(coordinates[1],
                          coordinates[0]);

        let location = new Location({ latitude: coordinates[1],
                                      longitude: coordinates[0] });

        let place = new Place({ name: name, store: false, location: location });
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
        this._tileIndex = Geojsonvt.geojsonvt(json, { extent: this._tileSize,
                                                      maxZoom: 20 });
        this._clampBBox();
    }

    _renderTile(tile) {
        let tileJSON = this._tileIndex.getTile(tile.zoom_level, tile.x, tile.y);
        let content = new Clutter.Canvas({ width: this._tileSize,
                                           height: this._tileSize });
        tile.content = new Clutter.Actor({ width: this._tileSize,
                                           height: this._tileSize,
                                           content: content });

        content.connect('draw', (canvas, cr) => {
            tile.set_surface(cr.getTarget());
            cr.setOperator(Cairo.Operator.CLEAR);
            cr.paint();
            cr.setOperator(Cairo.Operator.OVER);
            cr.setFillRule(Cairo.FillRule.EVEN_ODD);

            if (!tileJSON) {
                tile.emit('render-complete', null, 0, false);
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

            tile.emit('render-complete', null, 0, false);
        });

        content.invalidate();
    }
}

GObject.registerClass(GeoJSONSource);
