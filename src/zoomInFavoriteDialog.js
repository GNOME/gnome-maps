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
 */

const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const FavoriteEdit = imports.favoriteEditDialog;

var ZoomInFavoriteDialog = GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/zoom-in-favorite-dialog.ui',
    InternalChildren: ['cancelButton',
        'zoomInButton'],
}, class ZoomInFavoriteDialog extends Gtk.Dialog {

        _init(params) {
            this._latitude = params.latitude;
            delete params.latitude;
            this._longitude = params.longitude;
            delete params.longitude;
            this._view = params.view;
            delete params.view;

            /* This is a construct-only property and cannot be set by GtkBuilder */
            params.use_header_bar = true;

            super._init(params);

            this._zoomInButton.connect('clicked', () => this._onZoomIn());
            this._cancelButton.connect('clicked', () => this._onCancel());
        }

        _onZoomIn() {
            this._view.zoom_level = FavoriteEdit.MIN_ADD_LOCATION_ZOOM_LEVEL;

            /* center on the position first selected */
            this._view.center_on(this._latitude, this._longitude);
            this.response(Gtk.ResponseType.OK);
        }

        _onCancel() {
            this.response(Gtk.ResponseType.CANCEL);
        }
    });