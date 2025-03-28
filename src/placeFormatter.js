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
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>.
 *
 * Author: Damián Nohales <damiannohales@gmail.com>
 */

import gettext from 'gettext';

import GeocodeGlib from 'gi://GeocodeGlib';

import {StoredRoute} from './storedRoute.js';

const _ = gettext.gettext;

export class PlaceFormatter {

    constructor(place) {
        this._place = place;
        this._rows = [];
        this._titleProperty = 'name';

        this._update();
    }

    get place() {
        return this._place;
    }

    get title() {
        return this.place[this._titleProperty];
    }

    get rows() {
        return this._rows;
    }

    getDetailsString() {
        if (this._place instanceof StoredRoute)
            return this._place.viaString;

        if (this._place.isRawCoordinates)
            return _("Coordinates");

        return this.rows.map((row) => {
            return row.map((prop) => {
                return this._place[prop];
            }).join(', ');
        }).join(', ');
    }

    _update() {
        switch (this._place.placeType) {
        case GeocodeGlib.PlaceType.COUNTRY:
            if (this._place.country)
                this._titleProperty = 'country';

            this._addRow(['countryCode']);
            break;

        case GeocodeGlib.PlaceType.STATE:
            if (this._place.state)
                this._titleProperty = 'state';
            break;

        case GeocodeGlib.PlaceType.COUNTY:
            if (this._place.county)
                this._titleProperty = 'county';
            break;

        case GeocodeGlib.PlaceType.TOWN:
            if (this._place.county)
                this._addRow(['county']);
            else if (this._place.state)
                this._addRow(['state']);
            else if (this._place.area)
                this._addRow(['area']);
            break;

        default:
            if (this._place.streetAddress)
                this._addRow(['streetAddress']);
            else if (this._place.street)
                this._addRow(['street']);

            if (this._place.town !== this._place[this._titleProperty])
                this._addRow(['postalCode', 'town']);
            break;
        }
    }

    _addRow(properties) {
        properties = properties.filter((prop) => this._place[prop] ? true : false);

        if (properties.length > 0)
            this._rows.push(properties);
    }
};
