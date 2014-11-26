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
const Gdk = imports.gi.Gdk;
const Geocode = imports.gi.GeocodeGlib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

const Application = imports.application;
const Notification = imports.notification;
const Settings = imports.settings;
const Utils = imports.utils;

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
    ENABLED: 0,
    DISABLED: 1,
    NOTIFICATION: 2
};

const _NOT_AVAILABLE_MSG = _("Location service not available");
const _NOT_AVAILABLE_NOTIFICATION = new Notification.Plain(_NOT_AVAILABLE_MSG);

const LocationServiceNotification = new Lang.Class({
    Name: 'LocationServiceNotification',
    Extends: Notification.Notification,
    
    _init: function() {
        this.parent();

        let ui = Utils.getUIObject('location-service-notification',
                                   [ 'button', 'grid' ]);
        ui.button.connect('clicked', (function() {

            let privacyInfo = Gio.DesktopAppInfo.new('gnome-privacy-panel.desktop');
            try {
                let display = Gdk.Display.get_default();
                privacyInfo.launch([], display.get_app_launch_context());
            } catch(e) {
                Utils.debug('launching privacy panel failed: ' + e);
            }
        }).bind(this));

        this._ui.body.add(ui.grid);
    }
});

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
                                       State.ENABLED,
                                       State.NOTIFICATION,
                                       State.DISABLED)
    },

    set state(s) {
        this._state = s;
        this.notify('state');
    },

    get state() {
        return this._state;
    },

    get serviceNotification() {
        if (!this._serviceNotification)
            this._serviceNotification = new LocationServiceNotification();

        return this._serviceNotification;
    },


    _init: function() {
        this.parent();
        this.place = null;
        this._state = State.DISABLED;

        this._locationSettings = new Settings.Settings('org.gnome.system.location');
        if (this._locationSettings) {
            this._locationSettings.connect('changed::enabled',
                                           this._updateFromSettings.bind(this));
            this._updateFromSettings();
        } else {
            this._initLocationService();
        }
    },

    readNotification: function() {
        this.state = State.DISABLED;
        return this._notification;
    },

    _updateFromSettings: function() {
        if (this._locationSettings.get('enabled')) {
            if (this._state !== State.ENABLED)
                this._initLocationService();
        } else {
            if (this._state !== State.NOTIFICATION) {
                this._notification = this.serviceNotification;
                this.state = State.NOTIFICATION;
            }
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
            this._notification = _NOT_AVAILABLE_NOTIFICAITON;
            this.state = State.NOTIFICATION;
        }
    },

    _onGetClientReady: function(result, e) {
        if (e) {
            this._notification = _NOT_AVAILABLE_NOTIFICAITON;
            this.state = State.NOTIFICATION;
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
        this._clientProxy.StartRemote((function(result, e) {
            if (e) {
                this._notification = _NOT_AVAILABLE_MSG;
                this.state = State.NOTIFICATION;
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

        this.state = this._clientProxy.Active ? State.ENABLED : State.DISABLED;
        this._changedId = this._clientProxy.connect('g-properties-changed', (function() {
            if (this._clientProxy.Active === true)
                this.state = State.ENABLED;
            else
                this.state = State.DISABLED;
        }).bind(this));
    },

    _updateLocation: function(location) {
        if (!this.place)
            this.place = new Geocode.Place();

        this.place.location = location;
        this.emit('location-changed');
        Utils.debug("Updated location: " + location.description);
    }
});
