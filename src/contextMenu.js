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

const Champlain = imports.gi.Champlain;
const Clutter = imports.gi.Clutter;
const Gdk = imports.gi.Gdk;
const Geocode = imports.gi.GeocodeGlib;
const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;

const Application = imports.application;
const ExportViewDialog = imports.exportViewDialog;
const Lang = imports.lang;
const Location = imports.location;
const Place = imports.place;
const Utils = imports.utils;

const ContextMenu = new Lang.Class({
    Name: 'ContextMenu',
    Extends: Gtk.Menu,
    Template: 'resource:///org/gnome/Maps/ui/context-menu.ui',
    InternalChildren: [ 'whatsHereItem',
                        'geoURIItem',
                        'exportItem',
                        'routeItem' ],

    _init: function(params) {
        this._mapView = params.mapView;
        delete params.mapView;

        this.parent(params);

        this._mapView.view.connect('button-release-event',
                                   this._onButtonReleaseEvent.bind(this));

        this._whatsHereItem.connect('activate',
                                    this._onWhatsHereActivated.bind(this));
        this._geoURIItem.connect('activate',
                                 this._onGeoURIActivated.bind(this));
        this._exportItem.connect('activate',
                                 this._onExportActivated.bind(this));
        this._routeItem.connect('activate',
                                this._onRouteActivated.bind(this));
        Application.routeService.query.connect('notify::points',
                                               this._routingUpdate.bind(this));
        this._routeItem.visible = false;
        this._routingUpdate();
    },

    _onButtonReleaseEvent: function(actor, event) {
        let button = event.get_button();
        let [x, y] = event.get_coords();
        this._longitude = this._mapView.view.x_to_longitude(x);
        this._latitude = this._mapView.view.y_to_latitude(y);

        if (button === Clutter.BUTTON_SECONDARY) {
            Mainloop.idle_add((function() {
                // Need idle to avoid Clutter dead-lock on re-entrance
                this.popup(null, null, null, button, event.get_time());
            }).bind(this));
        }
    },

    _routingUpdate: function() {
        let query = Application.routeService.query;

        if (query.points.length === 0)
            return;

        this._routeItem.visible = true;
        if (!query.points[0].place) {
            this._routeItem.label = _("Route from here");
        } else if (query.filledPoints.length > 1) {
            this._routeItem.label = _("Add destination");
        } else {
            this._routeItem.label = _("Route to here");
        }
    },

    _onRouteActivated: function() {
        let query = Application.routeService.query;
        let location = new Location.Location({ latitude: this._latitude,
                                               longitude: this._longitude,
                                               accuracy: 0 });
        let place = new Place.Place({ location: location });

        if (!query.points[0].place) {
            query.points[0].place = place;
        } else if (query.filledPoints.length > 1) {
            query.addPoint(-1).place = place;
        } else {
            query.points[query.points.length - 1].place = place;
        }
    },

    _onWhatsHereActivated: function() {
        let location = new Location.Location({ latitude: this._latitude,
                                               longitude: this._longitude,
                                               accuracy: 0 });

        Application.geocodeService.reverse(location, null, (function(place) {
            this._mapView.showPlace(place, false);
        }).bind(this));
    },

    _onGeoURIActivated: function() {
        let location = new Location.Location({ latitude: this._latitude,
                                               longitude: this._longitude,
                                               accuracy: 0 });
        let display = Gdk.Display.get_default();
        let clipboard = Gtk.Clipboard.get_default(display);
        let uri = location.to_uri(Geocode.LocationURIScheme.GEO);

        clipboard.set_text(uri, uri.length);
    },

    _activateExport: function() {
        let view = this._mapView.view;
        let surface = view.to_surface(true);
        let bbox = view.get_bounding_box();
        let [latitude, longitude] = bbox.get_center();

        let dialog = new ExportViewDialog.ExportViewDialog({
            transient_for: this.get_toplevel(),
            surface: surface,
            latitude: latitude,
            longitude: longitude,
            mapView: this._mapView
        });

        dialog.connect('response', function() {
            dialog.destroy();
        });
        dialog.show_all();
    },

    _onExportActivated: function() {
        if (this._mapView.view.state === Champlain.State.DONE) {
            this._activateExport();
        } else {
            let notifyId = this._mapView.view.connect('notify::state', (function() {
                if (this._mapView.view.state === Champlain.State.DONE) {
                    this._mapView.view.disconnect(notifyId);
                    this._activateExport();
                }
            }).bind(this));
        }
    }
});
