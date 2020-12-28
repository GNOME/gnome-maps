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

const Gdk = imports.gi.Gdk;
const Geocode = imports.gi.GeocodeGlib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const Application = imports.application;
const PlaceButtons = imports.placeButtons;
const PlaceFormatter = imports.placeFormatter;

var PlaceBar = GObject.registerClass({
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
                                          Geocode.Place)
    },
}, class PlaceBar extends Gtk.Revealer {
    _init(params) {
        let mapView = params.mapView;
        delete params.mapView;

        super._init(params);

        this._buttons = new PlaceButtons.PlaceButtons({ mapView });
        this._buttons.initSendToButton(this._altSendToButton);
        this._box.add(this._buttons);

        Application.application.connect('notify::adaptive-mode', this._updateVisibility.bind(this));
        this.connect('notify::place', this._updatePlace.bind(this));
    }

    _updatePlace() {
        this._updateVisibility();

        if (!this.place) {
            return;
        }

        let formatter = new PlaceFormatter.PlaceFormatter(this.place);
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
});
