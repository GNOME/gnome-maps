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

import Clutter from 'gi://Clutter';
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

        super(params);

        this._mapView = mapView;
        this._buttons = new PlaceButtons({ mapView: this._mapView });
        this._buttons.initSendToButton(this._altSendToButton);
        this._buttons.connect('place-edited', this._onPlaceEdited.bind(this));
        this._box.add(this._buttons);

        this._multipress = new Gtk.GestureMultiPress({ widget: this._eventbox });
        this._multipress.connect('released', this._onEventBoxClicked.bind(this));

        Application.application.connect('notify::adaptive-mode', this._updateVisibility.bind(this));
        this.connect('notify::place', this._updatePlace.bind(this));

        this._mapView.view.connect('touch-event', this._onMapClickEvent.bind(this));
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

        let formatter = new PlaceFormatter(this.place);
        this._title.label = formatter.title;

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

    _onEventBoxClicked() {
        if (this.place.isCurrentLocation) {
            if (this._currentLocationView) {
                this._box.remove(this._currentLocationView);
                delete this._currentLocationView;
            } else {
                this._currentLocationView = new PlaceView({ place: this.place,
                                                            mapView: this._mapView,
                                                            inlineMode: true,
                                                            visible: true });
                this._box.add(this._currentLocationView);
            }
        } else {
            this._dialog = new PlaceDialog ({ transient_for: this.get_toplevel(),
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
        switch (event.type()) {
            case Clutter.EventType.TOUCH_BEGIN:
                this._tapped = true;
                break;
            case Clutter.EventType.TOUCH_UPDATE:
                this._tapped = false;
            case Clutter.EventType.TOUCH_END:
            case Clutter.EventType.TOUCH_CANCEL:
                if (this._tapped) {
                    Application.application.selected_place = null;
                }
                break;
        }

        return Clutter.EVENT_PROPAGATE;
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/place-bar.ui',
    InternalChildren: [ 'actionbar',
                        'altSendToButton',
                        'box',
                        'eventbox',
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
