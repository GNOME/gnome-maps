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

export class ContextMenu extends Gtk.Menu {
    constructor(params) {
        let mapView = params.mapView;
        delete params.mapView;

        let mainWindow = params.mainWindow;
        delete params.mainWindow;

        super(params);

        this._mapView = mapView;
        this._mainWindow = mainWindow;
        this._buttonGesture =
            new Gtk.GestureSingle({ widget: this._mapView,
                                    button: Gdk.BUTTON_SECONDARY });
        this._buttonGesture.connect('end', this._onButtonRelease.bind(this));

        this._whatsHereItem.connect('activate',
                                    this._onWhatsHereActivated.bind(this));
        this._geoURIItem.connect('activate',
                                 this._onGeoURIActivated.bind(this));
        this._addOSMLocationItem.connect('activate',
                                         this._onAddOSMLocationActivated.bind(this));
        this._routeFromHereItem.connect('activate',
                                        this._onRouteFromHereActivated.bind(this));
        this._addIntermediateDestinationItem.connect('activate',
                                        this._onAddIntermediateDestinationActivated.bind(this));
        this._routeToHereItem.connect('activate',
                                      this._onRouteToHereActivated.bind(this));
        Application.routeQuery.connect('notify::points',
                                       this._routingUpdate.bind(this));
        this._routingUpdate();
    }

    _onButtonRelease(gesture, sequence) {
        let event = gesture.get_last_event(sequence);
        let [, x, y] = event.get_coords();
        this._longitude = this._mapView.view.x_to_longitude(x);
        this._latitude = this._mapView.view.y_to_latitude(y);

        // Need idle to avoid Clutter dead-lock on re-entrance
        GLib.idle_add(null, () => this.popup_at_pointer(event));
    }

    _routingUpdate() {
        let query = Application.routeQuery;
        let numPoints = query.points.length;

        this._routeFromHereItem.sensitive = numPoints < RouteQuery.MAX_QUERY_POINTS;
        this._routeToHereItem.sensitive = numPoints < RouteQuery.MAX_QUERY_POINTS;
        this._addIntermediateDestinationItem.sensitive =
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
                this._mapView.showPlace(place, false);
            } else {
                let msg = _("Nothing found here!");

                Utils.showDialog(msg, Gtk.MessageType.INFO, this._mainWindow);
            }
        });
    }

    _onGeoURIActivated() {
        let location = new Location({ latitude: this._latitude,
                                      longitude: this._longitude,
                                      accuracy: 0 });
        let display = Gdk.Display.get_default();
        let clipboard = Gtk.Clipboard.get_default(display);
        let uri = location.to_uri(GeocodeGlib.LocationURIScheme.GEO);

        clipboard.set_text(uri, uri.length);
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

        if (this._mapView.view.get_zoom_level() < OSMEdit.MIN_ADD_LOCATION_ZOOM_LEVEL) {
            let zoomInDialog =
                new ZoomInDialog({ longitude: this._longitude,
                                   latitude: this._latitude,
                                   view: this._mapView.view,
                                   transient_for: this._mainWindow,
                                   modal: true });

            zoomInDialog.connect('response', () => zoomInDialog.destroy());
            zoomInDialog.show_all();
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
    Template: 'resource:///org/gnome/Maps/ui/context-menu.ui',
    InternalChildren: [ 'whatsHereItem',
                        'geoURIItem',
                        'addOSMLocationItem',
                        'routeFromHereItem',
                        'addIntermediateDestinationItem',
                        'routeToHereItem' ],
}, ContextMenu);
