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
 * Author: Dario Di Nucci <linkin88mail@gmail.com>
 */

import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Shumate from 'gi://Shumate';

import {Application} from './application.js';
import * as MapSource from './mapSource.js';
import {MapView} from './mapView.js';
import * as Service from './service.js';
import {ShapeLayer} from './shapeLayer.js';
import * as Utils from './utils.js';

const PREVIEW_WIDTH = 230;
const PREVIEW_HEIGHT = 80;

export class ShapeLayerRow extends Gtk.ListBoxRow {

    constructor(params) {
        let shapeLayer = params.shapeLayer;
        delete params.shapeLayer;

        super(params);

        this.shapeLayer = shapeLayer;
        this._layerLabel.label = this.shapeLayer.getName();
        this._layerLabel.tooltip_text = this.shapeLayer.file.get_parse_name();
        this._visibleButton.connect('clicked', () => {
            let image = this._visibleButton.get_child();

            this.shapeLayer.visible = !this.shapeLayer.visible;
            this.activatable = this.shapeLayer.visible;
            if (this.shapeLayer.visible)
                image.icon_name = 'layer-visible-symbolic';
            else
                image.icon_name = 'layer-not-visible-symbolic';
        });
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/shape-layer-row.ui',
    Children: ['closeButton'],
    InternalChildren: ['layerLabel', 'visibleButton']
}, ShapeLayerRow);

export class LayersPopover extends Gtk.Popover {

    constructor(params) {
        super({ width_request: 200,
                visible: false });

        this._mapView = params.mapView;

        //this._aerialLayerButton.join_group(this._streetLayerButton);

        this._layersListBox.bind_model(this._mapView.shapeLayerStore,
                                       this._listBoxCreateWidget.bind(this));
        this._layersListBox.connect('row-activated', (lb, row) => {
            this._mapView.gotoBBox(row.shapeLayer.bbox);
        });

        this._layersListBox.set_header_func((row, before) => {
            let header = before ? new Gtk.Separator() : null;
            row.set_header(header);
        });

        this._loadLayerButton.connect('clicked', () => this.popdown());

        // for now let's disable the map type swithery, as we only have street
        /*
        this._layerPreviews = {
            street: {
                source: MapSource.createStreetSource(),
                widget: this._streetLayerImage,
                lastLocation: { x: -1, y: -1, z: -1 }
            }
        };

        if (Service.getService().tiles.aerial) {
            this._layerPreviews.aerial = {
                source: MapSource.createAerialSource(),
                widget: this._aerialLayerImage,
                lastLocation: { x: -1, y: -1, z: -1 }
            };
        }

        // disable the map type switch buttons if aerial is unavailable
        if (Service.getService().tiles.aerial) {
            this._streetLayerButton.connect('clicked', () => {
                if (this._streetLayerButton.active) {
                    this._mapView.setMapType(MapView.MapType.STREET);
                }
            });

            this._aerialLayerButton.connect('clicked', () => {
                if (this._aerialLayerButton.active) {
                    this._mapView.setMapType(MapView.MapType.AERIAL);
                }
            });

            this._mapView.view.connect("notify::zoom-level",
                                       this._setLayerPreviews.bind(this));
            this._mapView.view.connect("notify::latitude",
                                       this._setLayerPreviews.bind(this));
            this._mapView.view.connect("notify::longitude",
                                       this._setLayerPreviews.bind(this));
        } else {
            this._streetLayerButton.visible = false;
            this._aerialLayerButton.visible = false;
        }

        this.setMapType(this._mapView.getMapType());
        this._mapView.connect("map-type-changed", (_mapView, type) => {
            this.setMapType(type);
        });
        */
    }

    /*
    _setLayerPreviews() {
        this._setLayerPreviewImage('street');
        this._setLayerPreviewImage('aerial');
    }

    _setLayerPreviewImage(layer, forceUpdate = false) {
        let previewInfo = this._layerPreviews[layer];
        let source = previewInfo.source;
        let widget = previewInfo.widget;

        let z = this._mapView.view.zoom_level - 1;
        if (z < 0)
            z = 0;
        let size = source.get_tile_size();
        let x = Math.floor(source.get_x(z, this._mapView.view.longitude) / size);
        let y = Math.floor(source.get_y(z, this._mapView.view.latitude) / size);

        // If the view hasn't moved enough that the tile is different,
        // then don't bother changing anything
        if (previewInfo.lastLocation.x == x &&
            previewInfo.lastLocation.y == y &&
            previewInfo.lastLocation.z == z && !forceUpdate) {

            return;
        }
        previewInfo.lastLocation = {x, y, z};

        let tile = Champlain.Tile.new_full(x, y, size, z);

        tile.connect("render-complete", (a, b, c, error) => {
            if (error)
                return; // oh well

            // Make sure we're still at the same location
            // This is especially important on slow connections
            if (previewInfo.lastLocation.x == x &&
                previewInfo.lastLocation.y == y &&
                previewInfo.lastLocation.z == z) {

                let pixbuf = Gdk.pixbuf_get_from_surface(tile.surface,
                                                    (size - PREVIEW_WIDTH) / 2,
                                                    (size - PREVIEW_HEIGHT) / 2,
                                                    PREVIEW_WIDTH,
                                                    PREVIEW_HEIGHT);
                widget.set_from_pixbuf(pixbuf);
            }
        });

        source.fill_tile(tile);
    }

    setMapType(mapType) {
        if (mapType === MapView.MapType.STREET) {
            this._streetLayerButton.active = true;
        } else if (mapType === MapView.MapType.AERIAL) {
            this._aerialLayerButton.active = true;
        }
    }
    */

    _onRemoveClicked(row) {
        this._mapView.removeShapeLayer(row.shapeLayer);
        let numLayers = 0;

        for (let layer of this._layersListBox) {
            numLayers++;
        }
        if (numLayers <= 0)
            this._layersListBox.hide();
    }

    _listBoxCreateWidget(shapeLayer) {
        let row = new ShapeLayerRow({ shapeLayer: shapeLayer });
        row.closeButton.connect('clicked',
                                () => this._onRemoveClicked(row));
        this._layersListBox.show();
        return row;
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/layers-popover.ui',
    InternalChildren: [ /*'streetLayerButton',
                        'aerialLayerButton',
                        'streetLayerImage',
                        'aerialLayerImage',*/
                        'layersListBox',
                        'loadLayerButton' ]
}, LayersPopover);
