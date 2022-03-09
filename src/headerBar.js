/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2011, 2012, 2013 Red Hat, Inc.
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
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>.
 *
 * Author: Cosimo Cecchi <cosimoc@redhat.com>
 *         Zeeshan Ali (Khattak) <zeeshanak@gnome.org>
 */

const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const FavoritesPopover = imports.favoritesPopover;
const LayersPopover = imports.layersPopover;
const MapView = imports.mapView;

var HeaderBarLeft = GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/headerbar-left.ui',
    InternalChildren: [ 'layersButton' ]
}, class HeaderBarLeft extends Gtk.Box {
    _init(params) {
        this._application = params.application;
        delete params.application;

        this._mapView = params.mapView;
        delete params.mapView;

        super._init(params);

        this._layersPopover = new LayersPopover.LayersPopover({
            mapView: this._mapView
        });
        this._layersButton.popover = this._layersPopover;
    }

    popdownLayersPopover() {
        this._layersPopover.popdown();
    }
});

var HeaderBarRight = GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/headerbar-right.ui',
    InternalChildren: [ 'toggleSidebarButton',
                        'favoritesButton',
                        'printRouteButton' ]
}, class HeaderBarRight extends Gtk.Box {
    _init(params) {
        this._application = params.application;
        delete params.application;

        this._mapView = params.mapView;
        delete params.mapView;

        super._init(params);

        this._favoritesButton.popover = new FavoritesPopover.FavoritesPopover({
            mapView: this._mapView
        });
        let favoritesPopover = this._favoritesButton.popover;
        this._favoritesButton.sensitive = favoritesPopover.rows > 0;
        favoritesPopover.connect('notify::rows', () => {
            this._favoritesButton.sensitive = favoritesPopover.rows > 0;
        });

        this._mapView.bind_property('routeShowing', this._printRouteButton,
                                    'visible', GObject.BindingFlags.DEFAULT);
    }
});
