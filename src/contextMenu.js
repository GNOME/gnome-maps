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
 * Author: Zeeshan Ali (Khattak) <zeeshanak@gnome.org>
 */

import Gdk from 'gi://Gdk';
import GeocodeGlib from 'gi://GeocodeGlib';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {Application} from './application.js';
import * as GeocodeFactory from './geocode.js';
import {Location} from './location.js';
import {OSMAccountDialog} from './osmAccountDialog.js';
import {OSMEdit} from './osmEdit.js';
import {OSMEditDialog} from './osmEditDialog.js';
import {Place} from './place.js';
import {RouteQuery} from './routeQuery.js';
import * as Utils from './utils.js';
import {ZoomInDialog} from './zoomInDialog.js';

export class ContextMenu extends Gtk.PopoverMenu {
    constructor(params) {
        let mapView = params.mapView;
        delete params.mapView;

        let mainWindow = params.mainWindow;
        delete params.mainWindow;

        super(params);

        this._mapView = mapView;
        this._mainWindow = mainWindow;
        this._buttonGesture =
            new Gtk.GestureSingle({ button: Gdk.BUTTON_SECONDARY });
        this._mapView.add_controller(this._buttonGesture);
        this._buttonGesture.connect('begin', (g, s) => this._onOpenMenu(g, s));

        this._routeFromHereAction =
            this._mainWindow.lookup_action('route-from-here');
        this._addIntermediateDestinationAction =
            this._mainWindow.lookup_action('add-intermediate-destination');
        this._routeToHereAction =
            this._mainWindow.lookup_action('route-to-here');

        let whatsHereAction =
            this._mainWindow.lookup_action('whats-here');
        let copyLocationAction =
            this._mainWindow.lookup_action('copy-location');
        let addOSMLocationAction =
            this._mainWindow.lookup_action('add-osm-location');

        whatsHereAction.connect('activate',
                                 () => this._onWhatsHereActivated());
        copyLocationAction.connect('activate',
                                   () => this._onCopyLocationActivated());
        addOSMLocationAction.connect('activate',
                                     () => this._onAddOSMLocationActivated());
        this._routeFromHereAction.connect('activate',
                                     () => this._onRouteFromHereActivated());
        this._addIntermediateDestinationAction.connect('activate',
                         () => this._onAddIntermediateDestinationActivated());
        this._routeToHereAction.connect('activate',
                                        () => this._onRouteToHereActivated());
        Application.routeQuery.connect('notify::points',
                                       () => this._routingUpdate());
        this._routingUpdate();
        this.set_parent(this._mapView);
    }

    _onOpenMenu(gesture, sequence) {
        let [_, x, y] = gesture.get_point(sequence);
        let viewport = this._mapView.map.viewport;
        /* we can't get the allocated width before showing, so use a
         * best-effort offset to get the top-left corner close to the pointer
         */
        let rect = new Gdk.Rectangle({ x: x, y: y, width: 200, height: 0 });

        [this._latitude, this._longitude] = viewport.widget_coords_to_location(this._mapView, x, y);

        this.pointing_to = rect;
        this.popup();
    }

    _routingUpdate() {
        let query = Application.routeQuery;
        let numPoints = query.points.length;

        this._routeFromHereAction.enabled = numPoints < RouteQuery.MAX_QUERY_POINTS;
        this._routeToHereAction.enabled = numPoints < RouteQuery.MAX_QUERY_POINTS;
        this._addIntermediateDestinationAction.enabled =
            query.filledPoints.length >= 2 && numPoints < RouteQuery.MAX_QUERY_POINTS;
    }

    _onRouteFromHereActivated() {
        let query = Application.routeQuery;
        let location = new Location({ latitude: this._latitude,
                                      longitude: this._longitude,
                                      accuracy: 0 });
        let place = new Place({ location: location, store: false });

        query.points[0].place = place;
    }

    _onRouteToHereActivated() {
        let query = Application.routeQuery;
        let location = new Location({ latitude: this._latitude,
                                      longitude: this._longitude,
                                      accuracy: 0 });
        let place = new Place({ location: location, store: false });

        query.points.last().place = place;
    }

    _onAddIntermediateDestinationActivated() {
        let query = Application.routeQuery;
        let location = new Location({ latitude: this._latitude,
                                      longitude: this._longitude,
                                      accuracy: 0 });
        let place = new Place({ location: location, store: false });

        query.addPoint(-1).place = place;
    }

    _onWhatsHereActivated() {
        GeocodeFactory.getGeocoder().reverse(this._latitude, this._longitude,
                                      (place) => {
            if (place) {
                this._mapView.showPlace(place, true);
            } else {
                let msg = _("Nothing found here!");

                Utils.showDialog(msg, Gtk.MessageType.INFO, this._mainWindow);
            }
        });
    }

    _onCopyLocationActivated() {
        let location = new Location({ latitude: this._latitude,
                                      longitude: this._longitude,
                                      accuracy: 0 });
        let clipboard = this.get_clipboard();
        let uri = location.to_uri(GeocodeGlib.LocationURIScheme.GEO);

        clipboard.set(uri);
    }

    _onAddOSMLocationActivated() {
        let osmEdit = Application.osmEdit;
        /* if the user is not already signed in, show the account dialog */
        if (!osmEdit.isSignedIn) {
            let dialog = osmEdit.createAccountDialog(this._mainWindow, true);

            dialog.show();
            dialog.connect('response', (dialog, response) => {
                dialog.destroy();
                if (response === OSMAccountDialog.Response.SIGNED_IN)
                    this._addOSMLocation();
            });

            return;
        }

        this._addOSMLocation();
    }

    _addOSMLocation() {
        let osmEdit = Application.osmEdit;
        let viewport = this._mapView.map.viewport;

        if (viewport.zoom_level < OSMEdit.MIN_ADD_LOCATION_ZOOM_LEVEL) {
            let zoomInDialog =
                new ZoomInDialog({ longitude: this._longitude,
                                   latitude: this._latitude,
                                   map: this._mapView.map,
                                   transient_for: this._mainWindow,
                                   modal: true });

            zoomInDialog.connect('response', () => zoomInDialog.destroy());
            zoomInDialog.show();
            return;
        }

        let dialog =
            osmEdit.createEditNewDialog(this._mainWindow,
                                        this._latitude, this._longitude);

        dialog.show();
        dialog.connect('response', (dialog, response) => {
            dialog.destroy();
            if (response === OSMEditDialog.Response.UPLOADED) {
                Utils.showDialog(_("Location was added to the map, note that it may take a while before it shows on the map and in search results."),
                                 Gtk.MessageType.INFO, this._mainWindow);
            }
        });
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/context-menu.ui'
}, ContextMenu);
