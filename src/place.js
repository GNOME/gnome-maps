/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
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
 * with GNOME Maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Jonas Danielsson <jonas@threetimestwo.org>
 */

const Geocode = imports.gi.GeocodeGlib;
const Lang = imports.lang;

const Place = new Lang.Class({
    Name: 'Place',
    Extends: Geocode.Place,

    _init: function(params) {
        this._population = params.population;
        delete params.population;

        this._wiki = params.wiki;
        delete params.wiki;

        this._openingHours = params.openingHours;
        delete params.openingHours;

        this._wheelchair = params.wheelchair;
        delete params.wheelchair;

        if (params.place) {
            params = { osm_id: params.place.osm_id,
                       name: params.place.name,
                       location: params.place.location,
                       bounding_box: params.place.bounding_box,
                       place_type: params.place.place_type,
                       street_address: params.place.street_address,
                       street: params.place.street,
                       building: params.place.building,
                       postal_code: params.place.postal_code,
                       area: params.place.area,
                       town: params.place.town,
                       state: params.place.state,
                       county: params.place.county,
                       country: params.place.country,
                       country_code: params.place.contry_code,
                       continent: params.place.continent };
        }

        for (let prop in params)
            if (!params[prop])
                delete params[prop];

        this.parent(params);
    },

    set population(v) {
        this._population = v;
    },

    get population() {
        return this._population;
    },

    set wiki(v) {
        this._wiki = v;
    },

    get wiki() {
        return this._wiki;
    },

    set openingHours(v) {
        this._openingHours = v;
    },

    get openingHours() {
        return this._openingHours;
    },

    set wheelchair(v) {
        this._wheelchair = v;
    },

    get wheelchair() {
        return this._wheelchair;
    }
});
