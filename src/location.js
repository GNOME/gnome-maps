/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2015 Red Hat Inc.
 * Copyright (c) 2014 Jonas Danielsson
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
 * Authors: Zeeshan Ali (Khattak) <zeeshanak@gnome.org>
 *          Jonas Danielsson <jonas@threetimestwo.org>
 */

const Geocode = imports.gi.GeocodeGlib;
const Lang = imports.lang;

/* Adds heading to Geocode.Location */
const Location = new Lang.Class({
    Name: 'Location',
    Extends: Geocode.Location,

    _init: function(params) {
        this._heading = params.heading;
        delete params.heading;

        this.parent(params);
    },

    get heading() {
        return this._heading;
    },

    set heading(v) {
        this._heading = v;
    }
});
