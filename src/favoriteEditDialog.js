/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 *
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
 */

const _ = imports.gettext.gettext;

const Geocode = imports.gi.GeocodeGlib;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Soup = imports.gi.Soup;

const Application = imports.application;
const Maps = imports.gi.GnomeMaps;
const Place = imports.place;
const PlaceStore = imports.placeStore;
const Location = imports.location;
const Utils = imports.utils;

var MIN_ADD_LOCATION_ZOOM_LEVEL = 16;

var Response = {
    UPLOADED: 0,
    CANCELLED: 2,
    ERROR: 3
};

var FavoriteEditDialog = GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/favorite-edit-dialog.ui',
    InternalChildren: ['cancelButton',
        'saveButton',
        'stack',
        'editorGrid',
        'headerBar'],
}, class FavoriteEditDialog extends Gtk.Dialog {

        _init(params) {

            this._latitude = params.latitude;
            delete params.latitude;

            this._longitude = params.longitude;
            delete params.longitude;

            this._location = new Location.Location({
                latitude: this._latitude,
                longitude: this._longitude,
                accuracy: 0
            });

            this._place = new Place.Place({ location: this._location });

            /* This is a construct-only property and cannot be set by GtkBuilder */
            params.use_header_bar = true;

            super._init(params);

            let label = new Gtk.Label({
                label: 'Name',
                use_markup: true
            });
            label.halign = Gtk.Align.END;
            label.get_style_context().add_class('dim-label');
            this._editorGrid.attach(label, 0, 1, 1, 1);
            label.show();

            let entry = new Gtk.Entry();
            entry.hexpand = true;
            entry.connect('changed', () => {
                this._place.name = entry.text;
                this._saveButton.sensitive = true;
            });
            this._editorGrid.attach(entry, 1, 1, 1, 1);
            entry.show();
            entry.grab_focus();

            this._stack.visible_child_name = 'editor';

            this._saveButton.connect('clicked', () => this._onSaveClicked());
            this._cancelButton.connect('clicked', () => this._onCancelClicked());
            this._headerBar.title = C_("dialog title", "Mark as favorite");
        }

        _onSaveClicked() {
            let placeStore = Application.placeStore;
            placeStore.addPlace(this._place, PlaceStore.PlaceType.FAVORITE);
            this.response(Response.CANCELLED);
        }

        _onCancelClicked() {
            this.response(Response.CANCELLED);
        }
});