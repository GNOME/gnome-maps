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

const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const PlaceListRow = imports.placeListRow;

const _PLACE_ICON_SIZE = 20;

const SearchPopup = new Lang.Class({
    Name: 'SearchPopup',
    Extends: Gtk.Popover,
    Signals: {
        'selected': { param_types: [ GObject.TYPE_OBJECT ] }
    },
    Template: 'resource:///org/gnome/maps/search-popup.ui',
    InternalChildren: [ 'scrolledWindow',
                        'stack',
                        'spinner',
                        'list' ],

    _init: function(props) {
        let numVisible = props.num_visible;
        delete props.num_visible;

        this._maxChars = props.maxChars;
        delete props.maxChars;

        this.parent(props);

        this._list.connect('row-activated', (function(list, row) {
            if (row)
                this.emit('selected', row.place);
        }).bind(this));

        this._list.set_header_func(function(row, before) {
            let header = new Gtk.Separator();
            if (before)
                row.set_header(header);
            else
                row.set_header(null);
        });

        let rowHeight = PlaceListRow.ROW_HEIGHT + 6; // For the header
        this._scrolledWindow.min_content_height = numVisible * rowHeight;
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

        this.grab_focus();
    },

    vfunc_hide: function() {
        if (this._spinner.active)
            this._spinner.stop();

        this.parent();
    },

    updateResult: function(places, searchString) {
        this._list.forall(function(row) {
            row.destroy();
        });

        places.forEach(this._addPlace.bind(this, searchString));
    },

    _addPlace: function(searchString, place) {
        if (!place.location)
            return;

        let row = new PlaceListRow.PlaceListRow({ place: place,
                                                  searchString: searchString,
                                                  maxChars: this._maxChars,
                                                  can_focus: true });
        this._list.add(row);
    }
});
