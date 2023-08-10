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

import GObject from 'gi://GObject';
import GClue from 'gi://Geoclue';
import Gio from 'gi://Gio';

import {Place} from './place.js';
import {Location} from './location.js';
import * as Utils from './utils.js';

export const State = {
    INITIAL: 0,
    ON: 1,
    DENIED: 2,
    FAILED: 3
};

export class Geoclue extends GObject.Object {

    set state(s) {
        this._state = s;
        this.notify('state');
    }

    get state() {
        return this._state;
    }

    constructor() {
        super();
        this.place = null;
        this._state = State.INITIAL;

        this.start(null);
    }

    start(callback) {
        let id = pkg.name;
        let level = GClue.AccuracyLevel.EXACT;

        GClue.Simple.new(id, level, null, (object, result) => {
            try {
                this._simple = GClue.Simple.new_finish(result);
            }
            catch (e) {
                Utils.debug("GeoClue2 service: " + e.message);
                if (e.matches(Gio.DBusError, Gio.DBusError.ACCESS_DENIED))
                    this.state = State.DENIED;
                else
                    this.state = State.FAILED;
                if (callback)
                    callback(false);
                return;
            }

            this._simple.connect('notify::location',
                                 () => this._onLocationNotify(this._simple));

            // geoclue doesn't use a client proxy inside the flatpak sandbox
            if (this._simple.client) {
                this._simple.client.connect('notify::active', () => {
                    this.state = this._simple.client.active ? State.ON : State.DENIED;
                });
            }

            this.state = State.ON;
            this._onLocationNotify(this._simple);
            if (callback)
                callback(true);
        });
    }

    _onLocationNotify(simple) {
        let geoclueLocation = simple.get_location();
        let location = new Location({
            latitude: geoclueLocation.latitude,
            longitude: geoclueLocation.longitude,
            accuracy: geoclueLocation.accuracy,
            heading: geoclueLocation.heading,
            description: geoclueLocation.description
        });
        this._updateLocation(location);
    }

    _updateLocation(location) {
        if (!this.place)
            this.place = new Place({ name: _("Current Location"),
                                     store: false,
                                     isCurrentLocation: true });

        this.place.location = location;
        this.emit('location-changed');
        Utils.debug("Updated location: " + location.description +
                    " (" + location.latitude + ", " + location.longitude +
                    ", accuracy = " + location.accuracy + " m)");
    }
}

GObject.registerClass({
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
                                       State.FAILED,
                                       State.INITIAL)
    },
}, Geoclue);
