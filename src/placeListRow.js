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
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const PlaceFormatter = imports.placeFormatter;

const ROW_HEIGHT = 50;

const PlaceListRow = new Lang.Class({
    Name: 'PlaceListRow',
    Extends: Gtk.ListBoxRow,
    Template: 'resource:///org/gnome/maps/place-list-row.ui',
    InternalChildren: [ 'icon',
                        'name',
                        'details' ],

    _init: function(params) {
        this.place = params.place;
        delete params.place;

        let searchString = params.searchString || '';
        delete params.searchString;

        let maxChars = params.maxChars || 40;
        delete params.maxChars;

        params.height_request = ROW_HEIGHT;
        this.parent(params);

        let formatter = new PlaceFormatter.PlaceFormatter(this.place);
        this.title = formatter.title;
        let markup = GLib.markup_escape_text(formatter.title, -1);

        this._name.label = this._boldMatch(markup, searchString);
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
