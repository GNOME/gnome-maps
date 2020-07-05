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
 * with GNOME Maps; if not, see <https://www.gnu.org/licenses/>.
 *
 * Author: Hashem Nasarat <hashem@riseup.net>
 */

const GObject = imports.gi.GObject;

const GeoJSONSource = imports.geoJSONSource;
const ShapeLayer = imports.shapeLayer;
const Utils = imports.utils;
const Togeojson = imports.togeojson.togeojson;
const Domparser = imports.xmldom.domparser;

var KmlShapeLayer = GObject.registerClass(
class KmlShapeLayer extends ShapeLayer.ShapeLayer {
    _init(params) {
        super._init(params);

        this._mapSource = new GeoJSONSource.GeoJSONSource({
            mapView: this._mapView,
            markerLayer: this._markerLayer
        });
    }

    _parseContent() {
        let s = Utils.getBufferText(this._fileContents);
        let parser = new Domparser.DOMParser();
        let json = Togeojson.toGeoJSON.kml(parser.parseFromString(s));
        this._mapSource.parse(json);
    }
});

KmlShapeLayer.mimeTypes = ['application/vnd.google-earth.kml+xml'];
KmlShapeLayer.displayName = 'KML';
KmlShapeLayer.createInstance = function(params) {
    return new KmlShapeLayer(params);
};
