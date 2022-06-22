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


import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {Application} from './application.js';
import {OSMAccountDialog} from './osmAccountDialog.js';
import {OSMEditDialog} from './osmEditDialog.js';
import * as OSMUtils from './osmUtils.js';
import {PlaceStore} from './placeStore.js';
import {SendToDialog} from './sendToDialog.js';

export class PlaceButtons extends Gtk.Box {
    constructor(params) {
        let place = params.place;
        delete params.place;

        let mapView = params.mapView;
        delete params.mapView;

        super(params);

        this._mapView = mapView;

        this._initSignals();

        if (place) {
            this.place = place;
        }
    }

    get place() {
        return this._place;
    }

    set place(newPlace) {
        this._place = newPlace;
        /* Use the PlaceStore's version of a place, if available. */
        if (Application.placeStore.exists(newPlace, null)) {
            this._place = Application.placeStore.get(newPlace);
        } else {
            this._place = newPlace;
        }

        this._updateFavoriteButton(!!this._place.store);

        this._editButton.visible = !!this._place.osm_id;

        this._routeButton.visible = !this._place.isCurrentLocation;
    }

    initSendToButton(button) {
        button.connect('clicked', () => {
            let dialog = new SendToDialog({ transient_for: this.get_toplevel(),
                                            modal: true,
                                            mapView: this._mapView,
                                            place: this._place });
            dialog.connect('response', () => dialog.destroy());
            dialog.show();
        });
    }

    _initSignals() {
        let placeStore = Application.placeStore;
        let query = Application.routeQuery;

        this._favoriteButton.connect('clicked', () => {
            if (placeStore.exists(this._place,
                                  PlaceStore.PlaceType.FAVORITE)) {
                this._favoriteButtonImage.icon_name = 'non-starred-symbolic';
                placeStore.removePlace(this._place,
                                       PlaceStore.PlaceType.FAVORITE);
            } else {
                this._favoriteButtonImage.icon_name = 'starred-symbolic';
                placeStore.addPlace(this._place,
                                    PlaceStore.PlaceType.FAVORITE);
            }
        });

        this._routeButton.connect('clicked', () => {
            let from = query.points[0];
            let to = query.points[query.points.length - 1];

            query.freeze_notify();
            query.reset();
            Application.routingDelegator.reset();

            if (Application.geoclue.place)
                from.place = Application.geoclue.place;
            to.place = this._place;

            Application.application.selected_place = null;

            query.thaw_notify();
        });

        this._editButton.connect('clicked', this._onEditClicked.bind(this));

        this.initSendToButton(this._sendToButton);
    }

    _updateFavoriteButton(visible) {
        let placeStore = Application.placeStore;
        this._favoriteButton.visible = visible;

        if (placeStore.exists(this._place,
                              PlaceStore.PlaceType.FAVORITE)) {
            this._favoriteButtonImage.icon_name = 'starred-symbolic';
        } else {
            this._favoriteButtonImage.icon_name = 'non-starred-symbolic';
        }
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
                this.emit('place-edited');
                break;
            default:
                break;
            }
        });
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/place-buttons.ui',
    InternalChildren: [ 'routeButton',
                        'sendToButton',
                        'favoriteButton',
                        'editButton',
                        'favoriteButtonImage' ],
    Signals: {
        /* Emitted when the Edit dialog is closed, because the place details
           might have changed and the parent PlaceBar/PlaceView needs
           refreshing */
        'place-edited': {}
    }
}, PlaceButtons);
