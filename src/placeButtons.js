/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2020 James Westman
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
 * Author: James Westman <james@flyingpimonster.net>
 */


const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const Application = imports.application;
const OSMAccountDialog = imports.osmAccountDialog;
const OSMEditDialog = imports.osmEditDialog;
const OSMUtils = imports.osmUtils;
const PlaceStore = imports.placeStore;
const SendToDialog = imports.sendToDialog;

var Button = {
    NONE: 0,
    ROUTE: 2,
    SEND_TO: 4,
    FAVORITE: 8,
    CHECK_IN: 16,
    EDIT_ON_OSM: 32,
};

var PlaceButtons = GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/place-buttons.ui',
    InternalChildren: [ 'routeButton',
                        'sendToButton',
                        'favoriteButton',
                        'editButton',
                        'favoriteButtonImage' ],
}, class PlaceButtons extends Gtk.Box {
    _init(params) {
        let buttonFlags = params.buttonFlags;
        delete params.buttonFlags;

        this._place = params.place;
        delete params.place;

        this._mapView = params.mapView;
        delete params.mapView;

        super._init(params);

        if (buttonFlags & Button.ROUTE)
            this._initRouteButton(this._routeButton);
        if (buttonFlags & Button.SEND_TO)
            this.initSendToButton(this._sendToButton, buttonFlags & Button.CHECK_IN);
        if (buttonFlags & Button.FAVORITE)
            this._initFavoriteButton(this._favoriteButton, this._favoriteButtonImage);
        if (buttonFlags & Button.EDIT_ON_OSM)
            this._initEditButton(this._editButton);
    }

    initSendToButton(button, showCheckIn) {
        button.visible = true;
        button.connect('clicked', () => {
            let dialog = new SendToDialog.SendToDialog({ transient_for: this.get_toplevel(),
                                                         modal: true,
                                                         mapView: this._mapView,
                                                         place: this._place,
                                                         showCheckIn });
            dialog.connect('response', () => dialog.destroy());
            dialog.show();
        });
    }

    _initFavoriteButton(button, image) {
        let placeStore = Application.placeStore;
        button.visible = true;

        if (placeStore.exists(this._place,
                              PlaceStore.PlaceType.FAVORITE)) {
            image.icon_name = 'starred-symbolic';
        } else {
            image.icon_name = 'non-starred-symbolic';
        }

        button.connect('clicked', () => {
            if (placeStore.exists(this._place,
                                  PlaceStore.PlaceType.FAVORITE)) {
                image.icon_name = 'non-starred-symbolic';
                placeStore.removePlace(this._place,
                                       PlaceStore.PlaceType.FAVORITE);
            } else {
                image.icon_name = 'starred-symbolic';
                placeStore.addPlace(this._place,
                                    PlaceStore.PlaceType.FAVORITE);
            }
        });
    }

    _initRouteButton(button) {
        let query = Application.routeQuery;
        let from = query.points[0];
        let to = query.points[query.points.length - 1];

        button.visible = true;

        button.connect('clicked', () => {
            query.freeze_notify();
            query.reset();
            Application.routingDelegator.reset();

            if (Application.geoclue.place)
                from.place = Application.geoclue.place;
            to.place = this._place;

            query.thaw_notify();
        });
    }

    _initEditButton(button) {
        button.visible = true;
        button.connect('clicked', this._onEditClicked.bind(this));
    }

    _onEditClicked() {
        let osmEdit = Application.osmEdit;
        /* if the user is not already signed in, show the account dialog */
        if (!osmEdit.isSignedIn) {
            let dialog = osmEdit.createAccountDialog(this.get_toplevel(), true);

            dialog.show();
            dialog.connect('response', (dialog, response) => {
                dialog.destroy();
                if (response === OSMAccountDialog.Response.SIGNED_IN)
                    this._edit();
            });

            return;
        }

        this._edit();
    }

    _edit() {
        let osmEdit = Application.osmEdit;
        let dialog = osmEdit.createEditDialog(this.get_toplevel(), this._place);

        dialog.show();
        dialog.connect('response', (dialog, response) => {
            dialog.destroy();

            switch (response) {
            case OSMEditDialog.Response.UPLOADED:
                // update place
                let object = osmEdit.object;
                OSMUtils.updatePlaceFromOSMObject(this._place, object);
                // refresh place view
                this._clearView();
                this._populate(this._place);
                break;
            default:
                break;
            }
        });
    }
});
