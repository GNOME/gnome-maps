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

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Shumate from 'gi://Shumate';

import {GeoJSONSource} from './geoJSONSource.js';
import * as Utils from './utils.js';

export class ShapeLayer extends GObject.Object {

    static mimeTypes = [];
    static displayName = '';

    static SUPPORTED_TYPES = [];

    static newFromFile(file, mapView) {
        let contentType = Gio.content_type_guess(file.get_uri(), null)[0];
        for (let layerClass of ShapeLayer.SUPPORTED_TYPES) {
            if (layerClass.mimeTypes.indexOf(contentType) > -1) {
                return layerClass.createInstance({ file: file, mapView: mapView });
            }
        }
        return null;
    }

    constructor(params) {
        super();
        this._visible = true;
        this._mapView = params.mapView;
        this.file = params.file;

        this.filename = this.file.query_info(
            Gio.FILE_ATTRIBUTE_STANDARD_DISPLAY_NAME,
            Gio.FileQueryInfoFlags.NONE,
            null
        ).get_attribute_string(Gio.FILE_ATTRIBUTE_STANDARD_DISPLAY_NAME);

        this._markerLayer = new Shumate.MarkerLayer({
            selection_mode: Gtk.SelectionMode.SINGLE,
            viewport:       this._mapView.map.viewport
        });

        this._mapSource = new GeoJSONSource({ mapView: this._mapView,
                                              markerLayer: this._markerLayer,
                                              filename: this.getName() });
        this._overlayLayer =
            new Shumate.MapLayer({ map_source: this._mapSource,
                                   viewport:   this._mapView.map.viewport });
        this._zoomId = this._mapView.map.viewport.connect('notify::zoom-level', () => {
            let oldOverlayLayer = this._overlayLayer;

            this._overlayLayer =
                new Shumate.MapLayer({ map_source: this._mapSource,
                                       viewport:   this._mapView.map.viewport });
            this._overlayLayer.visible = this._visible;
            this._mapView.map.add_layer(this._overlayLayer);
            this._mapView.map.remove_layer(oldOverlayLayer);
        });
    }

    get bbox() {
        return this._mapSource.bbox;
    }

    get visible() {
        return this._visible;
    }

    set visible(v) {
        this._overlayLayer.visible = v;
        this._markerLayer.visible = v;
        this._visible = v;
    }

    getName() {
        /*
         * Remove file extension and use that in lieu of a fileformat-specific
         * display name.
         */
        return this.filename.replace(/\.[^\.]+$/, '');
    }

    load(callback, bbox) {
        this.file.load_contents_async(null, (sourceObject, result) => {
            let error = false;
            try {
                let [status, buffer] = this.file.load_contents_finish(result);
                this._fileContents = buffer;
                if (!status)
                    throw new Error(_("failed to load file"));
                this._parseContent();
                this._mapView.map.add_layer(this._markerLayer);
                this._mapView.map.add_layer(this._overlayLayer);
            } catch (e) {
                Utils.debug(e);
                error = true;
            }
            callback(error, bbox, this);
        });
    }

    _parseContent() {
        /* Unimplemented */
    }

    unload() {
        this._mapView.map.remove_layer(this._markerLayer);
        this._mapView.map.remove_layer(this._overlayLayer);
        this._mapView.map.viewport.disconnect(this._zoomId);
    }
}

GObject.registerClass({
    Abstract: true
}, ShapeLayer);

