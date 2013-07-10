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

const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const Geocode = imports.gi.GeocodeGlib;
const GClue = imports.gi.Geoclue;

const Lang = imports.lang;
const Mainloop = imports.mainloop;

const Application = imports.application;
const Utils = imports.utils;
const Path = imports.path;
const Signals = imports.signals;
const _ = imports.gettext.gettext;

const Geoclue = new Lang.Class({
    Name: 'Geoclue',

    _init: function() {
        let lastLocation = Application.settings.get_value('last-location');
        if (lastLocation.n_children() >= 3) {
            let lat = lastLocation.get_child_value(0);
            let lng = lastLocation.get_child_value(1);
            let accuracy = lastLocation.get_child_value(2);

            this.location = new Geocode.Location({ latitude: lat.get_double(),
                                                   longitude: lng.get_double(),
                                                   accuracy: accuracy.get_double() });
            let lastLocationDescription = Application.settings.get_string('last-location-description');
            this.location.set_description(lastLocationDescription);
        }

        this._findLocation();
    },

    _findLocation: function() {
        GClue.ManagerProxy.new_for_bus(Gio.BusType.SESSION,
                                       Gio.DBusProxyFlags.NONE,
                                       "org.freedesktop.GeoClue2",
                                       "/org/freedesktop/GeoClue2/Manager",
                                       null,
                                       this._onManagerProxyReady.bind(this));
    },

    _onManagerProxyReady: function(sourceObject, res) {
        try {
            this._managerProxy = GClue.ManagerProxy.new_for_bus_finish(res);

            this._managerProxy.call_get_client(null, this._onGetClientReady.bind(this));
        } catch (e) {
            log ("Failed to connect to GeoClue2 service: " + e.message);
        }
    },

    _onGetClientReady: function(sourceObject, res) {
        try {
            let [ret, clientPath] = this._managerProxy.call_get_client_finish(res);

            GClue.ClientProxy.new_for_bus(Gio.BusType.SESSION,
                                          Gio.DBusProxyFlags.NONE,
                                          "org.freedesktop.GeoClue2",
                                          clientPath,
                                          null,
                                          this._onClientProxyReady.bind(this));
        } catch (e) {
            log ("Failed to connect to GeoClue2 service: " + e.message);
        }
    },

    _onClientProxyReady: function(sourceObject, res) {
        try {
            this._clientProxy = GClue.ClientProxy.new_for_bus_finish(res);

            this._clientProxy.connect("location-updated", (function(client, oldPath, newPath) {
                GClue.LocationProxy.new_for_bus(Gio.BusType.SESSION,
                                                Gio.DBusProxyFlags.NONE,
                                                "org.freedesktop.GeoClue2",
                                                newPath,
                                                null,
                                                this._onLocationProxyReady.bind(this));
            }).bind(this));

            this._clientProxy.call_start(null, this._onStartReady.bind(this));
        } catch (e) {
            log ("Failed to connect to GeoClue2 service: " + e.message);
        }
    },

    _onStartReady: function(sourceObject, res) {
        try {
            this._clientProxy.call_start_finish(res);
        } catch (e) {
            log ("Failed to connect to GeoClue2 service: " + e.message);
        }
    },

    _onLocationProxyReady: function(sourceObject, res) {
        try {
            this.location = GClue.LocationProxy.new_for_bus_finish(res);

            let variant = GLib.Variant.new('ad', [this.location.latitude,
                                                  this.location.longitude,
                                                  this.location.accuracy]);
            Application.settings.set_value('last-location', variant);
            Application.settings.set_string('last-location-description', this.location.description);

            this.emit('location-changed');
            log("Found location: " + this.location.description);
        } catch (e) {
            log("Failed to find your location: " + e);
        }
    }
});
Signals.addSignalMethods(Geoclue.prototype);
