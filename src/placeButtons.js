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


import GeocodeGlib from 'gi://GeocodeGlib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {Application} from './application.js';
import {OSMAccountDialog} from './osmAccountDialog.js';
import {OSMEditDialog} from './osmEditDialog.js';
import {PlaceStore} from './placeStore.js';
import {SendToDialog} from './sendToDialog.js';
import * as Utils from './utils.js';

export class PlaceButtons extends Gtk.Box {
    constructor({place, mapView, ...params}) {
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
        this._place = Application.placeStore.get(newPlace) ?? newPlace;

        this._updateFavoriteButton(!!this._place.store);

        this._editButton.visible =
            !!this._place.osmId && this._place.osmType !== GeocodeGlib.PlaceOsmType.UNKNOWN;

        if (Utils.isLefthandTrafficForCountry(this._place.countryCode))
            this._routeButton.child.icon_name = 'route-button-lht-symbolic';

        this._routeButton.visible = !this._place.isCurrentLocation;
    }

    initSendToButton(button) {
        button.connect('clicked', () => {
            let dialog = new SendToDialog({ transient_for: this.get_root(),
                                            modal: true,
                                            mapView: this._mapView,
                                            place: this._place });
            dialog.connect('response', () => {
                dialog.destroy();
                this._popup();
            });
            /* on GTK 4 the popover gets overlayead over the dialog,
             * so close the popover when not in adaptive mode
             */
            this._popdown();
            dialog.show();
        });
    }

    _initSignals() {
        let placeStore = Application.placeStore;

        this._favoriteButton.connect('clicked', () => {
            let placeItem = placeStore.getPlaceItem(this._place);

            if (placeItem && placeItem.isFavorite) {
                this._favoriteButton.icon_name = 'unstarred-symbolic';
                this._favoriteButton.remove_css_class('starred');
                this._favoriteButton.add_css_class('unstarred');
                placeItem.isFavorite = false;
            } else {
                if (!placeItem) {
                    placeItem = placeStore.addPlace(this._place);
                }
                placeItem.isFavorite = true;
                this._favoriteButton.icon_name = 'starred-symbolic';
                this._favoriteButton.remove_css_class('unstarred')
                this._favoriteButton.add_css_class('starred');
            }
        });

        this._routeButton.connect('clicked',
                                  () => { this._onRouteButtonClicked(); });

        this._editButton.connect('clicked', this._onEditClicked.bind(this));

        this.initSendToButton(this._sendToButton);
    }

    _onRouteButtonClicked() {
        const query = Application.routeQuery;
        const from = query.points[0];
        const to = query.points[query.points.length - 1];

        query.freeze_notify();

        if (!from.place && !to.place) {
            /* if neither from or to is filled in,
             * route from current location (if known) to the the displayed
             * place
             */
            query.reset();
            Application.routingDelegator.reset();

            if (Application.geoclue.place)
                from.place = Application.geoclue.place;
            to.place = this._place;
        } else if (from.place) {
            // if only start is filled in, route from start to the displayed place
            to.place = this.place;
        } else {
            // if only to is filled in, route from the displayed place
            from.place = this.place;
        }

        Application.application.selected_place = null;

        query.thaw_notify();
    }

    _updateFavoriteButton(visible) {
        this._favoriteButton.visible = visible;

        const place = Application.placeStore.getPlaceItem(this._place);
        this._favoriteButton.icon_name = place?.isFavorite ? 'starred-symbolic' : 'unstarred-symbolic';
    }

    _onEditClicked() {
        let osmEdit = Application.osmEdit;
        /* if the user is not already signed in, show the account dialog */
        if (!osmEdit.isSignedIn) {
            let dialog = osmEdit.createAccountDialog(true);

            /* on GTK 4 the popover gets overlayead over the dialog,
             * so close the popover when not in adaptive mode
             */
            this._popdown();
            dialog.present(Application.application.mainWindow);
            dialog.connect('response', (dialog, response) => {
                if (osmEdit.isSignedIn)
                    this._edit();
                else
                    this._popup();
            });

            return;
        }

        this._edit();
    }

    // popdown the parent popove(when not in adaptive mode)
    _popdown() {
        if (!Application.application.adaptive_mode)
            this.get_ancestor(Gtk.Popover).popdown();
    }

    _popup() {
        if (!Application.application.adaptive_mode) {
            const popover = this.get_ancestor(Gtk.Popover);

            if (!popover.get_parent())
                popover.set_parent(this._mapView);
            popover.popup();
        }
    }

    _edit() {
        let osmEdit = Application.osmEdit;
        let dialog = osmEdit.createEditDialog(this._place);

        /* on GTK 4 the popover gets overlayead over the dialog,
         * so close the popover when not in adaptive mode
         */
        this._popdown();
        dialog.present(Application.application.mainWindow);
        dialog.connect('closed', () => {
            switch (dialog.response) {
            case OSMEditDialog.Response.UPLOADED:
                // update place
                this._place.osmTags = osmEdit.object.get_tags();
                Application.placeStore.addPlace(this._place);
                // refresh place view
                this.emit('place-edited');
                break;
            default:
                break;
            }

            this._popup();
        });
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/place-buttons.ui',
    InternalChildren: [ 'routeButton',
                        'sendToButton',
                        'favoriteButton',
                        'editButton' ],
    Signals: {
        /* Emitted when the Edit dialog is closed, because the place details
           might have changed and the parent PlaceBar/PlaceView needs
           refreshing */
        'place-edited': {}
    }
}, PlaceButtons);
