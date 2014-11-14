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

const PlaceFormatter = imports.placeFormatter;
const Utils = imports.utils;

const _PLACE_ICON_SIZE = 20;
const _ROW_HEIGHT = 50;

const SearchPopupRow = new Lang.Class({
    Name: 'SearchPopupRow',
    Extends: Gtk.ListBoxRow,
    Template: 'resource:///org/gnome/maps/search-popup-row.ui',
    InternalChildren: [ 'icon',
                        'name',
                        'details' ],

    _init: function(params) {
        this.place = params.place;
        delete params.place;

        let searchString = params.searchString;
        delete params.searchString;

        let maxChars = params.maxChars || 40;
        delete params.maxChars;

        params.height_request = _ROW_HEIGHT;
        this.parent(params);

        let formatter = new PlaceFormatter.PlaceFormatter(this.place);
        let title = GLib.markup_escape_text(formatter.title, -1);

        this._name.label = this._boldMatch(title, searchString);
        this._details.max_width_chars = maxChars;
        this._details.label = formatter.getDetailsString();
        this._icon.gicon = this.place.icon;
    },

    _boldMatch: function(title, string) {
        string = string.toLowerCase();

        let index = title.toLowerCase().indexOf(string);

        if (index !== -1) {
            let substring = title.substring(index, index + string.length);
            title = title.replace(substring, substring.bold());
        }
        return title;
    }
});

const SearchPopup = new Lang.Class({
    Name: 'SearchPopup',
    Extends: Gtk.Popover,
    Signals : {
        'selected' : { param_types: [ GObject.TYPE_OBJECT ] }
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

        this._scrolledWindow.min_content_height = numVisible * _ROW_HEIGHT;
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

        places.forEach((function(place) {
            if (!place.location)
                return;
            let row = new SearchPopupRow({ place: place,
                                           searchString: searchString,
                                           maxChars: this._maxChars,
                                           can_focus: true });
            this._list.add(row);
        }).bind(this));
    }
});
