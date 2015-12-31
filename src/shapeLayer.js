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

const Champlain = imports.gi.Champlain;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Lang = imports.lang;

const SUPPORTED_TYPES = [];

function newFromFile(file, mapView) {
    let contentType = Gio.content_type_guess(file.get_uri(), null)[0];
    for (let i in SUPPORTED_TYPES) {
        let layerClass = SUPPORTED_TYPES[i];
        if (layerClass.mimeTypes.indexOf(contentType) > -1) {
            return new layerClass({ file: file, mapView: mapView });
        }
    }
    return null;
}

const ShapeLayer = new Lang.Class({
    Name: 'ShapeLayer',
    Extends: GObject.Object,
    Abstract: true,

    _init: function(params) {
        this.parent();

        this._mapView = params.mapView;
        this.file = params.file;

        this.filename = this.file.query_info(
            Gio.FILE_ATTRIBUTE_STANDARD_DISPLAY_NAME,
            Gio.FileQueryInfoFlags.NONE,
            null
        ).get_attribute_string(Gio.FILE_ATTRIBUTE_STANDARD_DISPLAY_NAME);

        this._markerLayer = new Champlain.MarkerLayer({
            selection_mode: Champlain.SelectionMode.SINGLE
        });
        this._mapSource = null;
    },

    get bbox() {
        return this._mapSource.bbox;
    },

    getName: function() {
        /*
         * Remove file extension and use that in lieu of a fileformat-specific
         * display name.
         */
        return this.filename.replace(/\.[^\.]+$/, '');
    },

    load: function() {
        this._mapView.view.add_layer(this._markerLayer);
        this._mapView.view.add_overlay_source(this._mapSource, 255);
    },

    unload: function() {
        this._mapView.view.remove_layer(this._markerLayer);
        this._mapView.view.remove_overlay_source(this._mapSource);
    }
});

ShapeLayer.mimeTypes = [];
ShapeLayer.displayName = '';
