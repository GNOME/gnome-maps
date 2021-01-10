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

const Clutter = imports.gi.Clutter;
const Gdk = imports.gi.Gdk;
const Geocode = imports.gi.GeocodeGlib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const Application = imports.application;
const ContactPlace = imports.contactPlace;
const PlaceButtons = imports.placeButtons;
const PlaceDialog = imports.placeDialog;
const PlaceFormatter = imports.placeFormatter;
const Utils = imports.utils;

var PlaceBar = GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/place-bar.ui',
    InternalChildren: [ 'actionbar',
                        'altSendToButton',
                        'box',
                        'eventbox',
                        'contactAvatar',
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
        this._mapView = params.mapView;
        delete params.mapView;

        super._init(params);

        this._buttons = new PlaceButtons.PlaceButtons({ mapView: this._mapView });
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

        if (!this.place) {
            return;
        }

        let formatter = new PlaceFormatter.PlaceFormatter(this.place);
        this._title.label = formatter.title;

        if (this.place instanceof ContactPlace.ContactPlace) {
            this._contactAvatar.visible = true;
            this._contactAvatar.text = formatter.title;

            this._contactAvatar.set_image_load_func(null);
            Utils.load_icon(this.place.icon, 32, (pixbuf) => {
                this._contactAvatar.set_image_load_func((size) => Utils.loadAvatar(pixbuf, size));
            });
        } else {
            this._contactAvatar.visible = false;
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

    _onEventBoxClicked() {
        let dialog = new PlaceDialog.PlaceDialog ({ transient_for: this.get_toplevel(),
                                                    modal: true,
                                                    mapView: this._mapView,
                                                    place: this.place });
        dialog.connect('response', () => dialog.destroy());
        dialog.show();
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
});
