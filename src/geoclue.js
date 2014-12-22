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

const GObject = imports.gi.GObject;
const Geocode = imports.gi.GeocodeGlib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

const Application = imports.application;
const Place = imports.place;
const Utils = imports.utils;

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
    <property name="Active" type="b" access="read"/> \
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
    Signals: {
        'location-changed': { }
    },
    Properties: {
        'connected': GObject.ParamSpec.boolean('connected',
                                               'Connected',
                                               'Connected to DBus service',
                                               GObject.ParamFlags.READABLE |
                                               GObject.ParamFlags.WRITABLE,
                                               false)
    },

    set connected(c) {
        this._connected = c;
        this.notify('connected');
    },

    get connected() {
        return this._connected;
    },

    _init: function() {
        this.parent();
        this.connected = false;
        this.place = null;

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
        this._clientProxy.DesktopId = "org.gnome.Maps";
        this._clientProxy.RequestedAccuracyLevel = AccuracyLevel.EXACT;

        this._clientProxy.connectSignal('LocationUpdated',
                                        this._onLocationUpdated.bind(this));
        this._clientProxy.StartRemote((function(result, e) {
            if (e) {
                log ("Failed to connect to GeoClue2 service: " + e.message);
            }
        }).bind(this));
    },

    _onLocationUpdated: function(proxy, sender, [oldPath, newPath]) {
        let geoclueLocation = new LocationProxy(Gio.DBus.system,
                                                "org.freedesktop.GeoClue2",
                                                newPath);
        let location = new Geocode.Location({ latitude: geoclueLocation.Latitude,
                                              longitude: geoclueLocation.Longitude,
                                              accuracy: geoclueLocation.Accuracy,
                                              description: geoclueLocation.Description });

        this._updateLocation(location);

        this.connected = this._clientProxy.Active;
        this._clientProxy.connect('g-properties-changed', (function() {
            this.connected = this._clientProxy.Active;
        }).bind(this));
    },

    _updateLocation: function(location) {
        if (!this.place)
            this.place = new Place.Place({ name: _("Current location") });

        this.place.location = location;
        this.emit('location-changed');
        Utils.debug("Updated location: " + location.description);
    }
});
