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
 * Author: Jonas Danielsson <jonas@threetimestwo.org>
 *         Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>
 */

const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Utils = imports.utils;

const ZoomControl = new Lang.Class({
    Name: 'ZoomControl',
    Extends: Gtk.Bin,
    Template: 'resource:///org/gnome/Maps/ui/zoom-control.ui',
    InternalChildren: [ 'zoomInButton',
                        'zoomOutButton' ],

    _init: function (mapView) {
        this.parent();

        this._view = mapView.view;

        this._zoomInButton.connect('clicked',
                                   this._view.zoom_in.bind(this._view));
        this._zoomOutButton.connect('clicked',
                                    this._view.zoom_out.bind(this._view));

        this._view.connect('notify::zoom-level',
                           this._updateSensitive.bind(this));
        this._view.connect('notify::max-zoom-level',
                           this._updateSensitive.bind(this));
        this._view.connect('notify::min-zoom-level',
                           this._updateSensitive.bind(this));
    },

    _updateSensitive: function () {
        let zoomLevel = this._view.zoom_level;
        let maxZoomLevel = this._view.max_zoom_level;
        let minZoomLevel = this._view.min_zoom_level;

        if (zoomLevel >= maxZoomLevel)
            this._zoomInButton.set_sensitive(false);
        else
            this._zoomInButton.set_sensitive(true);

        if (zoomLevel <= minZoomLevel)
            this._zoomOutButton.set_sensitive(false);
        else
            this._zoomOutButton.set_sensitive(true);
    }
});
