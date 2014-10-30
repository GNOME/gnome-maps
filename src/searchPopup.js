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

const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Utils = imports.utils;

const Columns = {
    ICON:         0,
    PLACE:        1,
    DESCRIPTION:  2
};

const _PLACE_ICON_SIZE = 20;

const SearchPopup = new Lang.Class({
    Name: 'SearchPopup',
    Extends: Gtk.Popover,
    Signals : {
        'selected' : { param_types: [ GObject.TYPE_OBJECT ] }
    },

    _init: function(props) {
        this._numVisible = props.num_visible;
        delete props.num_visible;

        let ui = Utils.getUIObject('search-popup', ['scrolled-window',
                                                    'stack',
                                                    'spinner',
                                                    'treeview',
                                                    'text-column',]);
        this._stack = ui.stack;
        this._scrolledWindow = ui.scrolledWindow;
        this._spinner = ui.spinner;
        this._treeView = ui.treeview;

        let model = new Gtk.ListStore();
        model.set_column_types([GdkPixbuf.Pixbuf,
                                GObject.TYPE_OBJECT,
                                GObject.TYPE_STRING]);
        this._treeView.model = model;

        this._treeView.connect('row-activated',
                               this._onRowActivated.bind(this));
        let cellHeight = ui.textColumn.cell_get_size(null)[3];
        this.height_request = cellHeight * this._numVisible;
        this._scrolledWindow.set_min_content_height(this.height_request);

        this.parent(props);

        this.get_style_context().add_class('maps-popover');
        this.add(this._stack);
        this.hide();
    },

    _onRowActivated: function(widget, path, column) {
        let model = this._treeView.model;
        let iter_valid, iter;

        if (model === null)
            return;

        [iter_valid, iter] = model.get_iter(path);
        if (!iter_valid)
            return;

        this.emit('selected', model.get_value(iter, Columns.PLACE));
    },

    showSpinner: function() {
        this._spinner.start();
        this._stack.set_visible_child(this._spinner);

        if (!this.get_visible())
            this.show();
    },

    showResult: function() {
        if (this._spinner.active)
            this._spinner.stop();

        this._stack.set_visible_child(this._scrolledWindow);

        if (!this.get_visible())
            this.show();

        this._treeView.grab_focus();
    },

    vfunc_show: function() {
        this._treeView.columns_autosize();
        this.parent();
    },

    vfunc_hide: function() {
        if (this._spinner.active)
            this._spinner.stop();

        this.parent();
    },

    updateResult: function(places, searchString) {
        let model = this._treeView.get_model();

        model.clear();

        places.forEach((function(place) {
            if (!place.location)
                return;

            let iter = model.append();
            let location = place.get_location();
            let icon = place.icon;

            let description = GLib.markup_escape_text(location.description, -1);
            description = this._boldMatch(description, searchString);

            model.set(iter,
                      [Columns.DESCRIPTION,
                       Columns.PLACE],
                      [description,
                       place]);

            if (icon !== null) {
                Utils.load_icon(icon, _PLACE_ICON_SIZE, function(pixbuf) {
                    model.set(iter, [Columns.ICON], [pixbuf]);
                });
            }
        }).bind(this));
    },

    _boldMatch: function(description, searchString) {
        searchString = searchString.toLowerCase();

        let index = description.toLowerCase().indexOf(searchString);

        if (index !== -1) {
            let substring = description.substring(index,
                                                  index + searchString.length);
            description = description.replace(substring, substring.bold());
        }
        return description;
    }
});
