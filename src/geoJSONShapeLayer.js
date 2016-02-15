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
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>.
 *
 * Author: Hashem Nasarat <hashem@riseup.net>
 */

const Lang = imports.lang;

const GeoJSONSource = imports.geoJSONSource;
const ShapeLayer = imports.shapeLayer;

const GeoJSONShapeLayer = new Lang.Class({
    Name: 'GeoJSONShapeLayer',
    Extends: ShapeLayer.ShapeLayer,

    _init: function(params) {
        this.parent(params);

        this._mapSource = new GeoJSONSource.GeoJSONSource({
            mapView: this._mapView,
            markerLayer: this._markerLayer
        });
    },

    getName: function() {
        /* Special Case since this file extension contains 2 periods */
        let suffix = '.geo.json';
        if (this.filename.endsWith(suffix))
            return this.filename.replace(new RegExp(suffix + '$'), '');
        else
            return this.parent();
    },

    _parseContent: function() {
        this._mapSource.parse(JSON.parse(this._fileContents));
    }
});

GeoJSONShapeLayer.mimeTypes = ['application/vnd.geo+json',
                               'application/json'];
GeoJSONShapeLayer.displayName = 'GeoJSON';
