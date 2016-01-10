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
const GClue = imports.gi.Geoclue;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

const Place = imports.place;
const Location = imports.location;
const Settings = imports.settings;
const Utils = imports.utils;

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

        GClue.Simple.new("org.gnome.Maps",
                         GClue.AccuracyLevel.EXACT,
                         null,
                         this._onSimpleReady.bind(this));
    },

    _onSimpleReady: function(object, result) {
        try {
            this._simple = GClue.Simple.new_finish(result);
        }
        catch (e) {
            Utils.debug("Failed to connect to GeoClue2 service: " + e.message);
            this.state = State.FAILED;
            return;
        }

        this._notifyId = this._simple.connect('notify::location',
                                              this._onLocationNotify.bind(this));
        if (this._timeoutId !== 0) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        this.state = State.ON;

        this._onLocationNotify(this._simple);
    },

    _onLocationNotify: function(simple) {
        let geoclueLocation = simple.get_location();
        let location = new Location.Location({ latitude: geoclueLocation.latitude,
                                               longitude: geoclueLocation.longitude,
                                               accuracy: geoclueLocation.accuracy,
                                               heading: geoclueLocation.heading,
                                               description: geoclueLocation.description });
        this._updateLocation(location);
    },

    _updateLocation: function(location) {
        if (!this.place)
            this.place = new Place.Place({ name: _("Current location") });

        this.place.location = location;
        this.emit('location-changed');
        Utils.debug("Updated location: " + location.description);
    }
});
