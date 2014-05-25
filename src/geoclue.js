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

const Lang = imports.lang;
const Mainloop = imports.mainloop;

const Application = imports.application;
const Utils = imports.utils;
const Path = imports.path;
const Signals = imports.signals;
const _ = imports.gettext.gettext;

const ManagerInterface = '<node> \
<interface name="org.freedesktop.GeoClue2.Manager"> \
    <method name="GetClient"> \
        <arg name="client" type="o" direction="out"/> \
    </method> \
</interface> \
</node>';
const ManagerProxy = Gio.DBusProxy.makeProxyWrapper(ManagerInterface);

const ClientInterface = '<node> \
<interface name="org.freedesktop.GeoClue2.Client"> \
    <property name="Location" type="o" access="read"/> \
    <property name="DesktopId" type="s" access="readwrite"/> \
    <property name="RequestedAccuracyLevel" type="u" access="readwrite"/> \
    <property name="DistanceThreshold" type="u" access="readwrite"/> \
    <method name="Start"/> \
    <method name="Stop"/> \
    <signal name="LocationUpdated"> \
        <arg name="old" type="o"/> \
        <arg name="new" type="o"/> \
    </signal> \
</interface> \
</node>';
const ClientProxy = Gio.DBusProxy.makeProxyWrapper(ClientInterface);

const AccuracyLevel = {
    COUNTRY: 1,
    CITY: 4,
    NEIGHBORHOOD: 5,
    STREET: 6,
    EXACT: 8
};

const LocationInterface = '<node> \
<interface name="org.freedesktop.GeoClue2.Location"> \
    <property name="Latitude" type="d" access="read"/> \
    <property name="Longitude" type="d" access="read"/> \
    <property name="Accuracy" type="d" access="read"/> \
    <property name="Description" type="s" access="read"/> \
</interface> \
</node>';
const LocationProxy = Gio.DBusProxy.makeProxyWrapper(LocationInterface);

const Geoclue = new Lang.Class({
    Name: 'Geoclue',
    Extends: GObject.Object,
    Properties: {
        'connected': GObject.ParamSpec.boolean('connected',
                                               'Connected',
                                               'Connected to DBus service',
                                               GObject.ParamFlags.READABLE,
                                               false)
    },

    get connected() {
        return this._connected;
    },

    overrideLocation: function(location) {
        if (this._clientProxy && this._locationUpdatedId > 0) {
            this._clientProxy.disconnectSignal(this._locationUpdatedId);
            this._locationUpdatedId = 0;
            this._clientProxy.StopRemote(function(result, e) {
                if (e) {
                    log ("Failed to connect to GeoClue2 service: " + e.message);
                }
            });
        }

        this._updateLocation(location, true);
    },

    findLocation: function() {
        if (!this._clientProxy)
            return;

        this._locationUpdatedId =
            this._clientProxy.connectSignal("LocationUpdated",
                                            this._onLocationUpdated.bind(this));

        this._clientProxy.StartRemote(function(result, e) {
            if (e) {
                log ("Failed to connect to GeoClue2 service: " + e.message);
            }
        });
    },

    _init: function() {
        this.parent();
        this._connected = false;

        let lastLocation = Application.settings.get('last-location');
        if (lastLocation.length >= 3) {
            let [lat, lng, accuracy] = lastLocation;
            this.location = new Geocode.Location({ latitude: lat,
                                                   longitude: lng,
                                                   accuracy: accuracy });
            let lastLocationDescription = Application.settings.get('last-location-description');
            this.location.set_description(lastLocationDescription);
            this.userSetLocation = Application.settings.get('last-location-user-set');
        }

        try {
            this._managerProxy = new ManagerProxy(Gio.DBus.system,
                                                  "org.freedesktop.GeoClue2",
                                                  "/org/freedesktop/GeoClue2/Manager");
            this._managerProxy.GetClientRemote(this._onGetClientReady.bind(this));
        } catch (e) {
            Utils.debug("Failed to connect to GeoClue2 service: " + e.message);
            log('Connection with GeoClue failed, we are not able to find your location!');
        }
    },

    _onGetClientReady: function(result, e) {
        if (e) {
            log ("Failed to connect to GeoClue2 service: " + e.message);
            return;
        }

        let [clientPath] = result;

        this._clientProxy = new ClientProxy(Gio.DBus.system,
                                            "org.freedesktop.GeoClue2",
                                            clientPath);
        this._clientProxy.DesktopId = "gnome-maps";
        this._clientProxy.RequestedAccuracyLevel = AccuracyLevel.EXACT;

        if (!this.userSetLocation)
            this.findLocation();

        this._connected = true;
        this.notify('connected');
    },

    _onLocationUpdated: function(proxy, sender, [oldPath, newPath]) {
        let geoclueLocation = new LocationProxy(Gio.DBus.system,
                                                "org.freedesktop.GeoClue2",
                                                newPath);
        let location = new Geocode.Location({ latitude: geoclueLocation.Latitude,
                                              longitude: geoclueLocation.Longitude,
                                              accuracy: geoclueLocation.Accuracy,
                                              description: geoclueLocation.Description });
        this._updateLocation(location, false);
    },

    _updateLocation: function(location, userSet) {
        this.location = location;

        Application.settings.set('last-location', [location.latitude,
                                                   location.longitude,
                                                   location.accuracy]);
        if (location.description !== null)
            Application.settings.set('last-location-description', location.description);
        Application.settings.set('last-location-user-set', userSet);
        this.userSetLocation = userSet;

        this.emit('location-changed');
        Utils.debug("Updated location: " + location.description);
    }
});
Utils.addSignalMethods(Geoclue.prototype);
