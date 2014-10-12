/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2014 Damián Nohales
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
 * Author: Damián Nohales <damiannohales@gmail.com>
 */

const Geocode = imports.gi.GeocodeGlib;

const Lang = imports.lang;

const PlaceFormatter = new Lang.Class({
    Name: "PlaceFormatter",

    _init: function(place) {
        this._place = place;
        this._rows = [];
        this._titleProperty = 'name';

        this._update();
    },

    get place() {
        return this._place;
    },

    get title() {
        let title;
        // For the 'name' property we split after comma to avoid
        // duplicating information in the title from the Geocode
        // display name.
        if (this._titleProperty === 'name')
            title = this._place[this._titleProperty].split(',')[0];
        else
            title = this.place[this._titleProperty];

        return title;
    },

    get rows() {
        return this._rows;
    },

    _update: function() {
        switch (this._place.place_type) {
        case Geocode.PlaceType.COUNTRY:
            if (this._place.country)
                this._titleProperty = 'country';

            this._addRow(['country_code']);
            break;

        case Geocode.PlaceType.STATE:
            if (this._place.state)
                this._titleProperty = 'state';

            this._addRow(['country']);
            break;

        case Geocode.PlaceType.COUNTY:
            if (this._place.county)
                this._titleProperty = 'county';

            this._addRow(['state', 'country']);
            break;

        case Geocode.PlaceType.TOWN:
            if (this._place.town)
                this._titleProperty = 'town';

            this._addRow(['postal_code']);
            if (this._place.county !== this._place.state)
                this._addRow(['county']);
            this._addRow(['state', 'country']);
            break;

        default:
            if (this._place.street_address)
                this._addRow(['street_address']);
            else if (this._place.street)
                this._addRow(['street']);

            if (this._place.town !== this._place[this._titleProperty])
                this._addRow(['area', 'town']);
            else
                this._addRow(['area']);

            this._addRow(['postal_code']);
            if (this._place.county !== this._place.state)
                this._addRow(['county']);
            this._addRow(['state', 'country']);
            break;
        }
    },

    _addRow: function(properties) {
        properties = properties.filter((function(prop) {
            return this._place[prop] ? true : false;
        }).bind(this));

        if (properties.length > 0)
            this._rows.push(properties);
    }
});
