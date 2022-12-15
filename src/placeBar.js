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

import Gdk from 'gi://Gdk';
import GeocodeGlib from 'gi://GeocodeGlib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {Application} from './application.js';
import {PlaceButtons} from './placeButtons.js';
import {PlaceDialog} from './placeDialog.js';
import {PlaceFormatter} from './placeFormatter.js';
import {PlaceView} from './placeView.js';
import * as Utils from './utils.js';

export class PlaceBar extends Gtk.Revealer {
    constructor(params) {
        let mapView = params.mapView;
        delete params.mapView;

        let mainWindow = params.mainWindow;
        delete params.mainWindow;

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

        this._mapClick = new Gtk.GestureSingle();
        this._mapView.add_controller(this._mapClick);

        this._mapClick.connect('begin', this._onMapClickEvent.bind(this));
    }

    _updatePlace() {
        this._updateVisibility();

        if (this._dialog) {
            this._dialog.destroy();
            delete this._dialog;
        }

        if (!this.place) {
            return;
        }

        /* set a formatted title when relevant for the place
         * e.g. not for pure coordinate-based places (geo: URIs for example)
         * which are not stored in the place store
         */
        if (this.place.store) {
            let formatter = new PlaceFormatter(this.place);
            this._title.label = formatter.title;
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
            this._dialog = new PlaceDialog ({ transient_for: this._mainWindow,
                                              modal: true,
                                              mapView: this._mapView,
                                              place: this.place });
            this._dialog.connect('response', () => {
                this._dialog.destroy();
                delete this._dialog;
            });
            this._dialog.show();
        }
    }

    _onPlaceEdited() {
        _updatePlace();
    }

    _onMapClickEvent(view, event) {
       Application.application.selected_place = null;
       this.reveal_child = false;
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/place-bar.ui',
    InternalChildren: [ 'actionbar',
                        'altSendToButton',
                        'box',
                        'title' ],
    Properties: {
        'place': GObject.ParamSpec.object('place',
                                          'Place',
                                          'The place to show information about',
                                          GObject.ParamFlags.READABLE |
                                          GObject.ParamFlags.WRITABLE,
                                          GeocodeGlib.Place)
    },
}, PlaceBar);

