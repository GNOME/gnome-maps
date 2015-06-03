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
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>.
 *
 * Author: Zeeshan Ali (Khattak) <zeeshanak@gnome.org>
 */

const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

const Application = imports.application;
const Place = imports.place;
const Location = imports.location;
const Settings = imports.settings;
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

const LocationInterface = '<node> \
<interface name="org.freedesktop.GeoClue2.Location"> \
    <property name="Latitude" type="d" access="read"/> \
    <property name="Longitude" type="d" access="read"/> \
    <property name="Accuracy" type="d" access="read"/> \
    <property name="Description" type="s" access="read"/> \
    <property name="Heading" type="d" access="read"/> \
</interface> \
</node>';
const LocationProxy = Gio.DBusProxy.makeProxyWrapper(LocationInterface);

const AccuracyLevel = {
    COUNTRY: 1,
    CITY: 4,
    NEIGHBORHOOD: 5,
    STREET: 6,
    EXACT: 8
};

const State = {
    INITIAL: 0,
    ON: 1,
    OFF: 2,
    FAILED: 3,
    TIMEOUT: 4
};

const _TIMEOUT = 5000;
const _LOCATION_SETTINGS = 'org.gnome.system.location';

const Geoclue = new Lang.Class({
    Name: 'Geoclue',
    Extends: GObject.Object,
    Signals: {
        'location-changed': { }
    },
    Properties: {
        'state': GObject.ParamSpec.int('state',
                                       '',
                                       '',
                                       GObject.ParamFlags.READABLE |
                                       GObject.ParamFlags.WRITABLE,
                                       State.INITIAL,
                                       State.TIMEOUT,
                                       State.INITIAL)
    },

    set state(s) {
        this._state = s;
        this.notify('state');
    },

    get state() {
        return this._state;
    },

    _init: function() {
        this.parent();
        this.place = null;
        this._state = State.INITIAL;
        this._timeoutId = 0;

        // Check the system Location settings
        this._locationSettings = Settings.getSettings(_LOCATION_SETTINGS);
        if (this._locationSettings) {
            this._locationSettings.connect('changed::enabled',
                                           this._updateFromSettings.bind(this));
            this._updateFromSettings();
        } else {
            this._initLocationService();
        }
    },

    _updateFromSettings: function() {
        if (this._locationSettings.get('enabled')) {
            if (this._state !== State.ON)
                Mainloop.idle_add(this._initLocationService.bind(this));
        } else {
            this.state = State.OFF;
        }
    },

    _initLocationService: function() {
        try {
            this._managerProxy = new ManagerProxy(Gio.DBus.system,
                                                  "org.freedesktop.GeoClue2",
                                                  "/org/freedesktop/GeoClue2/Manager");
            this._managerProxy.GetClientRemote(this._onGetClientReady.bind(this));
        } catch (e) {
            Utils.debug("Failed to connect to GeoClue2 service: " + e.message);
            this.state = State.FAILED;
        }
    },

    _onGetClientReady: function(result, e) {
        if (e) {
            Utils.debug("Failed to connect to GeoClue2 service: " + e.message);
            this.state = State.FAILED;
            return;
        }

        let [clientPath] = result;

        this._clientProxy = new ClientProxy(Gio.DBus.system,
                                            "org.freedesktop.GeoClue2",
                                            clientPath);
        this._clientProxy.DesktopId = "org.gnome.Maps";
        this._clientProxy.RequestedAccuracyLevel = AccuracyLevel.EXACT;

        this._updatedId = this._clientProxy.connectSignal('LocationUpdated',
                                                          this._onLocationUpdated.bind(this));

        if (this._timeoutId !== 0)
            Mainloop.source_remove(this._timeoutId);

        this._timeoutId = Mainloop.timeout_add(_TIMEOUT, (function() {
            if (this.state !== State.ON || this.state !== State.OFF) {
                this.state = State.TIMEOUT;
                return true;
            }

            this._timeoutId = 0;
            return false;
        }).bind(this));

        this._clientProxy.StartRemote((function(result, e) {
            if (e)
                this.state = State.FAILED;
        }).bind(this));
    },

    _onLocationUpdated: function(proxy, sender, [oldPath, newPath]) {
        let geoclueLocation = new LocationProxy(Gio.DBus.system,
                                                "org.freedesktop.GeoClue2",
                                                newPath);
        let location = new Location.Location({ latitude: geoclueLocation.Latitude,
                                               longitude: geoclueLocation.Longitude,
                                               accuracy: geoclueLocation.Accuracy,
                                               heading: geoclueLocation.Heading,
                                               description: geoclueLocation.Description });
        this._updateLocation(location);
        if (this._timeoutId !== 0) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        this.state = State.ON;
    },

    _updateLocation: function(location) {
        if (!this.place)
            this.place = new Place.Place({ name: _("Current location") });

        this.place.location = location;
        this.emit('location-changed');
        Utils.debug("Updated location: " + location.description);
    }
});
