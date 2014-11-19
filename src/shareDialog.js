/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
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
 * Author: Jonas Danielson <jonas@threetimestwo.org>
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const GWeather = imports.gi.GWeather;
const Lang = imports.lang;

const Application = imports.application;
const Utils = imports.utils;

const _WEATHER_APPID = 'org.gnome.Weather.Application';
const _CLOCKS_APPID = 'org.gnome.clocks';

const Response = {
    SUCCESS: 0,
    CANCEL: 1
};

const _NUM_VISIBLE = 6;

const ShareDialog = new Lang.Class({
    Name: 'ShareDialog',
    Extends: Gtk.Dialog,
    Template: 'resource:///org/gnome/maps/share-dialog.ui',
    InternalChildren: [ 'list',
                        'weatherRow',
                        'clocksRow',
                        'headerBar',
                        'cancelButton',
                        'chooseButton',
                        'scrolledWindow' ],

    _init: function(params) {
        this._place = params.place;
        delete params.place;

        params.use_header_bar = true;
        this.parent(params);

        this._scrolledWindow.min_content_height = 40 * _NUM_VISIBLE;
        this._headerBar.subtitle = this._place.name;

        this._cancelButton.connect('clicked',
                                   this.response.bind(this, Response.CANCEL));

        this._chooseButton.connect('clicked',
                                   this._onChooseButtonClicked.bind(this));

        this._list.set_header_func(function(row, before) {
            let horizontal = Gtk.Orientation.HORIZONTAL;

            if (before)
                row.set_header(new Gtk.Separator({ orientation: horizontal }));
            else
                row.set_header(null);
        });
    },

    ensureShares: function() {
        let shareWeather = this._checkWeather();
        let shareClocks = this._checkClocks();

        if (!shareWeather)
            this._weatherRow.hide();

        if (!shareClocks)
            this._clocksRow.hide();

        return shareWeather || shareClocks;
    },

    _onChooseButtonClicked: function() {
        let rows = this._list.get_selected_rows();
        if (rows.length === 0)
            this.response(Response.CANCEL);

        if (rows[0] === this._weatherRow || rows[0] === this._clocksRow) {
            let world = GWeather.Location.get_world();
            let city = world.find_nearest_city(this._place.location.latitude,
                                               this._place.location.longitude);
            let appId;
            let action;
            if (rows[0] === this._weatherRow) {
                action = 'show-location';
                appId = _WEATHER_APPID;
            } else {
                action = 'add-location';
                appId = _CLOCKS_APPID;
            }

            Utils.activateAction(appId,
                                 action,
                                 new GLib.Variant('v', city.serialize()),
                                 Gtk.get_current_event_time());

            this.response(Response.SUCCESS);
        }
    },

    _checkApp: function(appId) {
        let info = Gio.DesktopAppInfo.new(appId + '.desktop');
        return info !== null;
    },

    _checkWeather: function() {
        return (GWeather !== null && this._checkApp(_WEATHER_APPID));
    },

    _checkClocks: function() {
        return (GWeather !== null && this._checkApp(_CLOCKS_APPID));
    }
});
