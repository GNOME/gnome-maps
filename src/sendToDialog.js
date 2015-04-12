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
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>.
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

const SendToDialog = new Lang.Class({
    Name: 'SendToDialog',
    Extends: Gtk.Dialog,
    Template: 'resource:///org/gnome/Maps/ui/send-to-dialog.ui',
    InternalChildren: [ 'list',
                        'weatherRow',
                        'weatherLabel',
                        'clocksRow',
                        'clocksLabel',
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

    ensureApplications: function() {
        let weatherInfo = Gio.DesktopAppInfo.new(_WEATHER_APPID + '.desktop');
        let clocksInfo = Gio.DesktopAppInfo.new(_CLOCKS_APPID + '.desktop');
        let appWeather = this._checkWeather(weatherInfo);
        let appClocks = this._checkClocks(clocksInfo);

        if (!appWeather)
            this._weatherRow.hide();
        else
            this._weatherLabel.label = weatherInfo.get_name();

        if (!appClocks)
            this._clocksRow.hide();
        else
            this._clocksLabel.label = clocksInfo.get_name();

        return appWeather || appClocks;
    },

    _onChooseButtonClicked: function() {
        let rows = this._list.get_selected_rows();
        if (rows.length === 0)
            this.response(Response.CANCEL);

        if (rows[0] === this._weatherRow || rows[0] === this._clocksRow) {
            let location = this._place.location;
            let city = GWeather.Location.new_detached(this._place.name,
                                                      null,
                                                      location.latitude,
                                                      location.longitude);
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

    _checkWeather: function(appInfo) {
        return (GWeather !== null && appInfo !== null);
    },

    _checkClocks: function(appInfo) {
        return (GWeather !== null && appInfo !== null);
    }
});
