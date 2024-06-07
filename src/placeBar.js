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
import { lookupType } from './osmTypes.js';
import {PlaceButtons} from './placeButtons.js';
import {PlaceDialog} from './placeDialog.js';
import {PlaceFormatter} from './placeFormatter.js';
import * as PlaceIcons from './placeIcons.js';
import {PlaceView} from './placeView.js';
import * as Utils from './utils.js';
import { Place } from './place.js';

export class PlaceBar extends Gtk.Revealer {
    constructor({mapView, mainWindow, ...params}) {
        super(params);

        this._mapView = mapView;
        this._mainWindow = mainWindow;
        this._buttons = new PlaceButtons({ mapView: this._mapView });
        this._buttons.initSendToButton(this._altSendToButton);
        this._buttons.connect('place-edited', this._onPlaceEdited.bind(this));
        this._box.append(this._buttons);

        this._click = new Gtk.GestureClick();
        this._box.add_controller(this._click);
        this._click.connect('released', this._onBoxClicked.bind(this));

        Application.application.connect('notify::adaptive-mode', this._updateVisibility.bind(this));
        this.connect('notify::place', this._updatePlace.bind(this));

        this._mapClick = new Gtk.GestureClick();
        this._mapView.add_controller(this._mapClick);

        let lat, lon;
        this._mapClick.connect('pressed', () => {
            lat = this._mapView.map.viewport.latitude;
            lon = this._mapView.map.viewport.longitude;
        });
        this._mapClick.connect('released', () => {
            const lat2 = this._mapView.map.viewport.latitude;
            const lon2 = this._mapView.map.viewport.longitude;
            /* Hide the place bar if the user clicks the map, but not if they
               pan. */
            if (Math.abs(lat - lat2) < 0.00001 && Math.abs(lon - lon2) < 0.00001) {
                Application.application.selected_place = null;
                this.reveal_child = false;
            }
        });
    }

    _updatePlace() {
        this._updateVisibility();

        if (this._dialog) {
            this._dialog.close();
        }

        if (!this.place) {
            return;
        }

        /* set a formatted title when relevant for the place
         * e.g. not for pure coordinate-based places (geo: URIs for example)
         * which are not stored in the place store
         */
        if (this.place.store) {
            const title = new PlaceFormatter(this.place).title;
            const typeName = lookupType(this.place.osmKey, this.place.osmValue);

            this._title.label = title ?? typeName;

            if (typeName) {
                this._icon.icon_name = PlaceIcons.getIconForPlace(this.place);
                this._icon.visible = true;
            } else {
                this._icon.visible = false;
            }
        } else if (this.place.isCurrentLocation) {
            this._title.label = _('Current Location');
        } else {
            this._title.label = '';
        }

        this._buttons.place = this.place;

        this._altSendToButton.visible = this.place.isCurrentLocation;
        this._buttons.visible = !this.place.isCurrentLocation;
    }

    _updateVisibility() {
        if (Application.application.adaptive_mode) {
            this.reveal_child = (this.place != null);
        } else {
            this.reveal_child = false;
        }
    }

    _onBoxClicked() {
        if (this.place.isCurrentLocation) {
            if (this._currentLocationView) {
                this._box.remove(this._currentLocationView);
                delete this._currentLocationView;
            } else {
                this._currentLocationView = new PlaceView({ place: this.place,
                                                            mapView: this._mapView,
                                                            inlineMode: true,
                                                            visible: true });
                this._box.append(this._currentLocationView);
            }
        } else {
            this._dialog = new PlaceDialog ({ mapView: this._mapView,
                                              place: this.place });
            this._dialog.connect('closed', () => {
                delete this._dialog;
            });
            this._dialog.present(this._mainWindow);
        }
    }

    _onPlaceEdited() {
        _updatePlace();
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/place-bar.ui',
    InternalChildren: [ 'altSendToButton',
                        'box',
                        'icon',
                        'title' ],
    Properties: {
        'place': GObject.ParamSpec.object('place',
                                          'Place',
                                          'The place to show information about',
                                          GObject.ParamFlags.READABLE |
                                          GObject.ParamFlags.WRITABLE,
                                          Place)
    },
}, PlaceBar);

