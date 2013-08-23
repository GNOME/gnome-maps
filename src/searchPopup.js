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

const Gtk = imports.gi.Gtk;

const Lang = imports.lang;
const Utils = imports.utils;

const Columns = {
    TEXT: 0
};

const SearchPopup = new Lang.Class({
    Name: 'SearchPopup',
    Extends: Gtk.Bin,

    _init: function(numVisible) {
        this._numVisible = numVisible;

        let ui = Utils.getUIObject('search-popup', ['frame',
                                                    'scrolled-window',
                                                    'treeview']);
        this._scrolledWindow = ui.scrolledWindow;
        this._treeView = ui.treeview;
        this._treeView.connect('button-press-event',
                               this._onListButtonPress.bind(this));
        this._initList();

        this.height_request = this._cellHeight * this._numVisible;
        this._scrolledWindow.set_min_content_height(this.height_request);

        this.parent({ width_request: 500,
                      halign: Gtk.Align.CENTER,
                      valign: Gtk.Align.START,
                      margin_top: 10,
                      no_show_all: true,
                      visible: true });

        this.add(ui.frame);
        this.hide();
    },

    _initList: function() {
        let cell = new Gtk.CellRendererText({ xpad: 16,
                                              ypad: 8 });
        let column = new Gtk.TreeViewColumn();

        this._treeView.append_column(column);
        column.pack_start(cell, true);
        column.add_attribute(cell, 'markup', Columns.TEXT);

        this._cellHeight = column.cell_get_size(null)[3];
    },

    _onListButtonPress: function(widget, event) {
        let path_valid, path;
        let bool, coordX, coordY;

        [bool, coordX, coordY] = event.get_coords();
        [path_valid, path] = this._treeView.get_path_at_pos(coordX, coordY,
                                                            null, null, null);
        if (path_valid) {
            let model = this.getModel();
            let iter_valid, iter;

            if (model === null)
                return;

            [iter_valid, iter] = model.get_iter(path);
            if (!iter_valid)
                return;

            this.emit('selected', iter);
        }
    },

    vfunc_show: function() {
        this._treeView.columns_autosize();
        this.parent();
    },

    setModel: function(model) {
        this._treeView.set_model(model);
    },

    getModel: function() {
        return this._treeView.get_model();
    },
});
Utils.addSignalMethods(SearchPopup.prototype);
