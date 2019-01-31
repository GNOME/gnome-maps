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
const Gdk = imports.gi.Gdk;
const Geocode = imports.gi.GeocodeGlib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;

const Application = imports.application;
const ExportViewDialog = imports.exportViewDialog;
const Location = imports.location;
const OSMAccountDialog = imports.osmAccountDialog;
const OSMEdit = imports.osmEdit;
const OSMEditDialog = imports.osmEditDialog;
const FavoriteEditDialog = imports.favoriteEditDialog;
const Place = imports.place;
const PlaceStore = imports.placeStore;
const RouteQuery = imports.routeQuery;
const Utils = imports.utils;
const ZoomInDialog = imports.zoomInDialog;

var ContextMenu = GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/context-menu.ui',
    InternalChildren: [ 'whatsHereItem',
                        'geoURIItem',
                        'exportItem',
                        'addOSMLocationItem',
                        'routeItem',
                        'createFavorite' ],
}, class ContextMenu extends Gtk.Menu {
    _init(params) {
        this._mapView = params.mapView;
        delete params.mapView;

        this._mainWindow = params.mainWindow;
        delete params.mainWindow;

        super._init(params);

        this._mapView.connect('button-release-event',
                              this._onButtonReleaseEvent.bind(this));

        this._whatsHereItem.connect('activate',
                                    this._onWhatsHereActivated.bind(this));
        this._geoURIItem.connect('activate',
                                 this._onGeoURIActivated.bind(this));
        this._exportItem.connect('activate',
                                 this._onExportActivated.bind(this));
        this._addOSMLocationItem.connect('activate',
                                         this._onAddOSMLocationActivated.bind(this));
        this._routeItem.connect('activate',
                                this._onRouteActivated.bind(this));
        this._createFavorite.connect('activate',
                                    this._onCreateFavoriteActivated.bind(this));
        Application.routeQuery.connect('notify::points',
                                       this._routingUpdate.bind(this));
        this._routeItem.visible = false;
        this._routingUpdate();
    }

    _onButtonReleaseEvent(widget, event) {
        let [, button] = event.get_button();
        let [, x, y] = event.get_coords();
        this._longitude = this._mapView.view.x_to_longitude(x);
        this._latitude = this._mapView.view.y_to_latitude(y);

        if (button === Gdk.BUTTON_SECONDARY) {
            // Need idle to avoid Clutter dead-lock on re-entrance
            Mainloop.idle_add(() => this.popup_at_pointer(event));
        }
    }

    _routingUpdate() {
        let query = Application.routeQuery;

        this._routeItem.sensitive = query.points.length < RouteQuery.MAX_QUERY_POINTS;

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
    }

    _onRouteActivated() {
        let query = Application.routeQuery;
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
    }

    _onWhatsHereActivated() {
        let location = new Location.Location({ latitude: this._latitude,
                                               longitude: this._longitude,
                                               accuracy: 0 });

        Application.geocodeService.reverse(location, null, (place) => {
            if (place) {
                this._mapView.showPlace(place, false);
            } else {
                let msg = _("Nothing found here!");

                Utils.showDialog(msg, Gtk.MessageType.INFO, this._mainWindow);
            }
        });
    }

    _onCreateFavoriteActivated() {
        if (this._mapView.view.get_zoom_level() < FavoriteEditDialog.MIN_ADD_LOCATION_ZOOM_LEVEL) {
            let zoomInDialog =
                new ZoomInDialog.ZoomInDialog({
                    longitude: this._longitude,
                    latitude: this._latitude,
                    view: this._mapView.view,
                    transient_for: this._mainWindow,
                    description: 'Zoom in to mark a location as favorite!',
                    modal: true
                });
            zoomInDialog.connect('response', () => zoomInDialog.destroy());
            zoomInDialog.show_all();
            return;
        }

        let dialog = new FavoriteEditDialog.FavoriteEditDialog({
            transient_for: this._mainWindow,
            modal: true,
            latitude: this._latitude,
            longitude: this._longitude
        });

        dialog.show();
        dialog.connect('response', (dialog) => {
            dialog.destroy();
        });
    }

    _onGeoURIActivated() {
        let location = new Location.Location({ latitude: this._latitude,
                                               longitude: this._longitude,
                                               accuracy: 0 });
        let display = Gdk.Display.get_default();
        let clipboard = Gtk.Clipboard.get_default(display);
        let uri = location.to_uri(Geocode.LocationURIScheme.GEO);

        clipboard.set_text(uri, uri.length);
    }

    _onAddOSMLocationActivated() {
        let osmEdit = Application.osmEdit;
        /* if the user is not alread signed in, show the account dialog */
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
                new ZoomInDialog.ZoomInDialog({ longitude: this._longitude,
                                                latitude: this._latitude,
                                                view: this._mapView.view,
                                                transient_for: this._mainWindow,
                                                description: 'Zoom in to add location!',
                                                modal: true, });

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

    _activateExport() {
        let view = this._mapView.view;
        let surface = view.to_surface(true);
        let bbox = view.get_bounding_box();
        let [latitude, longitude] = bbox.get_center();

        let dialog = new ExportViewDialog.ExportViewDialog({
            transient_for: this._mainWindow,
            modal: true,
            surface: surface,
            latitude: latitude,
            longitude: longitude,
            mapView: this._mapView
        });

        dialog.connect('response', () => dialog.destroy());
        dialog.show_all();
    }

    _onExportActivated() {
        if (this._mapView.view.state === Champlain.State.DONE) {
            this._activateExport();
        } else {
            let notifyId = this._mapView.view.connect('notify::state', () => {
                if (this._mapView.view.state === Champlain.State.DONE) {
                    this._mapView.view.disconnect(notifyId);
                    this._activateExport();
                }
            });
        }
    }
});
