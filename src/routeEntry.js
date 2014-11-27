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

const Gdk = imports.gi.Gdk;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Application = imports.application;
const PlaceEntry = imports.placeEntry;

const Type = {
    FROM: 0,
    TO: 1,
    VIA: 2
};

const RouteEntry = new Lang.Class({
    Name: 'RouteEntry',
    Extends: Gtk.Grid,
    Template: 'resource:///org/gnome/maps/route-entry.ui',
    Children: [ 'iconEventBox' ],
    InternalChildren: [ 'entryGrid',
                        'icon',
                        'button',
                        'buttonImage' ],

    _init: function(params) {
        this._type = params.type;
        delete params.type;

        this._point = params.point || null;
        delete params.point;

        this._mapView = params.mapView || null;
        delete params.mapView;

        this.parent(params);

        this.entry = this._createEntry();
        this._entryGrid.add(this.entry);

        // There is no GdkWindow on the widget until it is realized
        this._icon.connect('realize', function(icon) {
            if (icon.window.get_cursor())
                return;

            icon.window.set_cursor(Gdk.Cursor.new(Gdk.CursorType.HAND1));
        });

        switch (this._type) {
        case Type.FROM:
            this._buttonImage.icon_name = 'list-add-symbolic';
            this._icon.icon_name = 'maps-point-start-symbolic';
            this._button.show();
            break;
        case Type.VIA:
            this._buttonImage.icon_name = 'list-remove-symbolic';
            this._icon.icon_name = 'maps-point-end-symbolic';
            this._button.show();
            break;
        case Type.TO:
            this._icon.icon_name = 'maps-point-end-symbolic';
            this._button.hide();
            break;
        }
    },

    get button() {
        return this._button;
    },

    get point() {
        return this._point;
    },

    _createEntry: function() {
        let entry = new PlaceEntry.PlaceEntry({ visible: true,
                                                can_focus: true,
                                                hexpand: true,
                                                receives_default: true,
                                                mapView: this._mapView,
                                                parseOnFocusOut: true,
                                                maxChars: 15 });
        if (this._point) {
            entry.bind_property('place',
                                this._point, 'place',
                                GObject.BindingFlags.BIDIRECTIONAL);
        }

        return entry;
    }
});
