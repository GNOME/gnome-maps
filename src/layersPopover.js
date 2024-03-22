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
import {MapView} from './mapView.js';
import {ShapeLayer} from './shapeLayer.js';
import * as Utils from './utils.js';

const PREVIEW_WIDTH = 230;
const PREVIEW_HEIGHT = 80;

export class ShapeLayerRow extends Gtk.ListBoxRow {

    constructor({shapeLayer, ...params}) {
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

export class LayersPopover extends Gtk.PopoverMenu {

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

        this._layersSectionBox.visible = this._mapView.shapeLayerStore.n_items > 0;
        this._mapView.shapeLayerStore.connect('items-changed', (model) => {
            this._layersSectionBox.visible = model.n_items > 0;
            this._layersListBox.visible = model.n_items > 0;
        });
    }

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
        return row;
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/layers-popover.ui',
    InternalChildren: [ /*'streetLayerButton',
                        'aerialLayerButton',
                        'streetLayerImage',
                        'aerialLayerImage',*/
                        'layersSectionBox',
                        'layersListBox' ]
}, LayersPopover);
