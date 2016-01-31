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

const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const ShapeLayer = imports.shapeLayer;
const Utils = imports.utils;

const ShapeLayerRow = new Lang.Class({
    Name: 'ShapeLayerRow',
    Extends: Gtk.ListBoxRow,
    Template: 'resource:///org/gnome/Maps/ui/shape-layer-row.ui',
    Children: ['closeButton'],
    InternalChildren: ['layerLabel', 'visibleButton'],

    _init: function(params) {
        this.shapeLayer = params.shapeLayer;
        delete params.shapeLayer;

        this.parent(params);

        this._layerLabel.label = this.shapeLayer.getName();
        this._layerLabel.tooltip_text = this.shapeLayer.file.get_parse_name();
        this._visibleButton.connect('clicked', (function() {
            let image = this._visibleButton.get_child();

            this.shapeLayer.visible = !this.shapeLayer.visible;
            this.activatable = this.shapeLayer.visible;
            if (this.shapeLayer.visible)
                image.icon_name = 'layer-visible-symbolic';
            else
                image.icon_name = 'layer-not-visible-symbolic';
        }).bind(this));
    }
});

const ShapeLayerFileChooser = new Lang.Class({
    Name: 'ShapeLayerFileChooser',
    Extends: Gtk.FileChooserDialog,
    Template: 'resource:///org/gnome/Maps/ui/shape-layer-file-chooser.ui',

    _init: function(params) {
        this.parent(params);
        let allFilter = new Gtk.FileFilter();
        allFilter.set_name(_("All Layer Files"));
        this.add_filter(allFilter);
        this.set_filter(allFilter);

        ShapeLayer.SUPPORTED_TYPES.forEach((function(layerClass) {
            let filter = new Gtk.FileFilter();
            [filter, allFilter].forEach(function(f) {
                layerClass.mimeTypes.forEach(f.add_mime_type.bind(f));
            });
            filter.set_name(layerClass.displayName);
            this.add_filter(filter);
        }).bind(this));
    }
});

const LayersPopover = new Lang.Class({
    Name: 'LayersPopover',
    Extends: Gtk.Popover,
    Template: 'resource:///org/gnome/Maps/ui/layers-popover.ui',
    InternalChildren: [ 'streetLayerButton',
                        'aerialLayerButton',
                        'layersListBox',
                        'loadLayerButton' ],

    _init: function(params) {
        this._mapView = params.mapView;
        delete params.mapView;

        this.parent({ width_request: 200,
                      no_show_all: true,
                      transitions_enabled: false,
                      visible: false });

        this._aerialLayerButton.join_group(this._streetLayerButton);

        this.get_style_context().add_class('maps-popover');

        this._layersListBox.bind_model(this._mapView.shapeLayerStore,
                                         this._listBoxCreateWidget.bind(this));
        this._layersListBox.connect('row-activated', (function(lb, row) {
            this._mapView.gotoBBox(row.shapeLayer.bbox);
        }).bind(this));

        this._layersListBox.set_header_func(function(row, before) {
            let header = before ? new Gtk.Separator() : null;
            row.set_header(header);
        });

        this._loadLayerButton.connect('clicked',
                                      this._onLoadLayerClicked.bind(this));
    },

    _onRemoveClicked: function(row, button) {
        this._mapView.removeShapeLayer(row.shapeLayer);
        if (this._layersListBox.get_children().length <= 0)
            this._layersListBox.hide();
    },

    _onLoadLayerClicked: function(button) {
        let fileChooser = new ShapeLayerFileChooser({
            transient_for: this.get_parent()
        });

        if (fileChooser.run() === Gtk.ResponseType.OK) {
            this._mapView.openShapeLayers(fileChooser.get_files());
            this.hide();
        }

        fileChooser.destroy();
    },

    _listBoxCreateWidget: function(shapeLayer) {
        let row = new ShapeLayerRow({ shapeLayer: shapeLayer });
        row.closeButton.connect('clicked',
                                this._onRemoveClicked.bind(this, row));
        this._layersListBox.show();
        return row;
    }
});
