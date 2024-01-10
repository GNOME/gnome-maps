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

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {FavoritesPopover} from './favoritesPopover.js';
import {LayersPopover} from './layersPopover.js';
import {MapView} from './mapView.js';

export class HeaderBarLeft extends Gtk.Box {
    constructor({mapView, ...params}) {
        super(params);

        this._layersPopover = new LayersPopover({ mapView: mapView });
        this._layersButton.popover = this._layersPopover;
    }

    popdownLayersPopover() {
        this._layersPopover.popdown();
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/headerbar-left.ui',
    InternalChildren: [ 'layersButton' ]
}, HeaderBarLeft);

export class HeaderBarRight extends Gtk.Box {
    constructor(params) {
        let mapView = params.mapView;
        delete params.mapView;

        super(params);

        this._favoritesButton.popover = new FavoritesPopover({ mapView: mapView });

        mapView.bind_property('routeShowing', this._printRouteButton,
                              'visible', GObject.BindingFlags.DEFAULT);
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/headerbar-right.ui',
    InternalChildren: [ 'toggleSidebarButton',
                        'favoritesButton',
                        'printRouteButton' ]
}, HeaderBarRight);
