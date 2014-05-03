/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2013 Mattias Bengtsson.
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
 * Author: Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>
 */

const Geocode = imports.gi.GeocodeGlib;
const GObject = imports.gi.GObject;

const Lang = imports.lang;

const Utils = imports.utils;

const Transportation = {
    CAR:        0,
    BIKE:       1,
    PEDESTRIAN: 2,

    toString: function (transportation) {
        switch(transportation) {
        case Transportation.CAR:        return 'car';
        case Transportation.BIKE:       return 'bike';
        case Transportation.PEDESTRIAN: return 'foot';
        default:                        return null;
        }
    }
};

const RouteQuery = new Lang.Class({
    Name: 'RouteQuery',
    Extends: GObject.Object,
    Signals: {
        'updated': { }
    },
    Properties: {
        'from': GObject.ParamSpec.object('from',
                                         '',
                                         '',
                                         GObject.ParamFlags.READWRITE,
                                         Geocode.Place),
        'to': GObject.ParamSpec.object('to',
                                       '',
                                       '',
                                       GObject.ParamFlags.READWRITE,
                                       Geocode.Place),
        'transportation': GObject.ParamSpec.int('transportation',
                                                '',
                                                '',
                                                GObject.ParamFlags.READWRITE,
                                                Transportation.CAR,
                                                Transportation.PEDESTRIAN,
                                                Transportation.CAR)
    },

    set from(place) {
        this._from = place;
        this.notify("from");
    },
    get from() {
        return this._from;
    },

    set to(place) {
        this._to = place;
        this.notify("to");
    },
    get to() {
        return this._to;
    },

    set transportation(transportation) {
        this._transportation = transportation;
        this.notify("transportation");
    },
    get transportation() {
        return this._transportation;
    },

    _init: function(args) {
        this.parent(args);
        this._connectSignals();
        this.reset();
    },

    _connectSignals: function() {
        this._updatedId = this.connect('notify', (function() {
            this.emit('updated');
        }).bind(this));
    },

    _disconnectSignals: function() {
        this.disconnect(this._updatedId);
    },

    reset: function() {
        this.setMany({ from: null,
                       to: null,
                       transportation: Transportation.CAR });
    },

    setMany: function(obj) {
        this._disconnectSignals();

        // Only set properties actually defined on this object
        ["from", "to", "transportation"].forEach((function(prop) {
            if (obj.hasOwnProperty(prop))
                this[prop] = obj[prop];
        }).bind(this));

        this._connectSignals();
        this.emit('updated');
    },

    toString: function() {
        return "From: " + this.from +
            "\nTo: " + this.to +
            "\nTransportation" + this.transportation;
    }
});
