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
 * with GNOME Maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Zeeshan Ali (Khattak) <zeeshanak@gnome.org>
 */

const Gtk = imports.gi.Gtk;
const Clutter = imports.gi.Clutter;
const Geocode = imports.gi.GeocodeGlib;

const Application = imports.application;
const Lang = imports.lang;
const Utils = imports.utils;

const ContextMenu = new Lang.Class({
    Name: 'ContextMenu',

    _init: function(mapView) {
        this._mapView = mapView;

        let ui = Utils.getUIObject('context-menu', ['context-menu',
                                                    'whats-here-item',
                                                    'i-am-here-item']);
        this._menu = ui.contextMenu;

        this._mapView.view.connect('button-release-event',
                                   this._onButtonReleaseEvent.bind(this));

        ui.whatsHereItem.connect('activate',
                                 this._onWhatsHereActivated.bind(this));

        ui.iAmHereItem.connect('activate',
                               this._onIAmHereActivated.bind(this));
    },

    _onButtonReleaseEvent: function(actor, event) {
        let button = event.get_button();
        let [x, y] = event.get_coords();
        this._longitude = this._mapView.view.x_to_longitude(x);
        this._latitude = this._mapView.view.y_to_latitude(y);

        if (button === Clutter.BUTTON_SECONDARY) {
            this._menu.popup(null, null, null, button, event.get_time());
        }
    },

    _onWhatsHereActivated: function() {
        let location = new Geocode.Location({ latitude: this._latitude,
                                              longitude: this._longitude,
                                              accuracy: 0 });

        this._reverseGeocode(location, (function(place) {
            this._mapView.showSearchResult(place);
        }).bind(this));
    },

    _onIAmHereActivated: function() {
        let location = new Geocode.Location({ latitude: this._latitude,
                                              longitude: this._longitude,
                                              accuracy: 0,
                                              description: "" });
        this._reverseGeocode(location, (function(place) {
            location.description = place.name;
            Application.geoclue.overrideLocation(location);
        }).bind(this));
    },

    _reverseGeocode: function(location, resultCallback) {
        let reverse = Geocode.Reverse.new_for_location(location);

        Application.application.mark_busy();
        reverse.resolve_async (null, (function(reverse, res) {
            Application.application.unmark_busy();
            try {
                let place = reverse.resolve_finish(res);

                resultCallback(place);
            } catch (e) {
                log ("Error finding place at " +
                     this._latitude + ", " +
                     this._longitude + ": " +
                     e.message);
            }
        }).bind(this));
    }
});
Utils.addSignalMethods(ContextMenu.prototype);
