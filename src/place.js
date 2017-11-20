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
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>.
 *
 * Author: Jonas Danielsson <jonas@threetimestwo.org>
 */

const Geocode = imports.gi.GeocodeGlib;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Location = imports.location;
const Translations = imports.translations;
const Utils = imports.utils;

// Matches coordinates string with the format "<lat>, <long>"
const COORDINATES_REGEX = /^\s*(\-?\d+(?:\.\d+)?)\s*,\s*(\-?\d+(?:\.\d+)?)\s*$/;

var Place = GObject.registerClass(
class Place extends Geocode.Place {

    _init(params) {
        this._population = params.population;
        delete params.population;

        this._website = params.website;
        delete params.website;

        this._phone = params.phone;
        delete params.phone;

        this._wiki = params.wiki;
        delete params.wiki;

        this._openingHours = params.openingHours;
        delete params.openingHours;

        this._internetAccess = params.internetAccess;
        delete params.internetAccess;

        this._religion = params.religion;
        delete params.religion;

        this._toilets = params.toilets;
        delete params.toilets;

        this._note = params.note;
        delete params.note;

        /* Determines if the place should be added to the place store */
        if (typeof(params.store) === 'undefined') {
            this._store = true;
        } else {
            this._store = params.store;
            delete params.store;
        }

        this._wheelchair = params.wheelchair;
        delete params.wheelchair;

        if (params.place) {
            params = { osm_id: params.place.osm_id,
                       osm_type: params.place.osm_type,
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

        super._init(params);
    }

    set store(v) {
        this._store = v;
    }

    get store() {
        return this._store;
    }

    get uniqueID() {
        return this.osm_type + '-' + this.osm_id;
    }

    set population(v) {
        this._population = v;
    }

    get population() {
        return this._population;
    }

    set website(v) {
        this._website = v;
    }

    get website() {
        return this._website;
    }

    set phone(v) {
        this._phone = v;
    }

    get phone() {
        return this._phone;
    }

    set wiki(v) {
        this._wiki = v;
    }

    get wiki() {
        return this._wiki;
    }

    set openingHours(v) {
        this._openingHours = v;
    }

    get openingHours() {
        return this._openingHours;
    }

    set internetAccess(v) {
        this._internetAccess = v;
    }

    get openingHoursTranslated() {
        return Translations.translateOpeningHours(this._openingHours);
    }

    get internetAccess() {
        return this._internetAccess;
    }

    get internetAccessTranslated() {
        return Translations.translateInternetAccess(this._internetAccess);
    }

    set religion(v) {
        this._religion = v;
    }

    get religion() {
        return this._religion;
    }

    get religionTranslated() {
        return Translations.translateReligion(this._religion);
    }

    set toilets(v) {
        this._toilets = v;
    }

    get toilets() {
        return this._toilets;
    }

    get toiletsTranslated() {
        return Translations.translateYesNo(this._toilets);
    }

    set note(v) {
        this._note = v;
    }

    get note() {
        return this._note;
    }

    set wheelchair(v) {
        this._wheelchair = v;
    }

    get wheelchair() {
        return this._wheelchair;
    }

    get wheelchairTranslated() {
        return this._translateWheelchair(this._wheelchair);
    }

    _translateWheelchair(string) {
        switch(string) {
            /* Translators:
             * This means wheelchairs have full unrestricted access.
             */
            case 'yes': return _("yes");

            /* Translators:
             * This means wheelchairs have partial access (e.g some areas
             * can be accessed and others not, areas requiring assistance
             * by someone pushing up a steep gradient).
             */
            case 'limited': return _("limited");

            /* Translators:
             * This means wheelchairs have no unrestricted access
             * (e.g. stair only access).
             */
            case 'no': return _("no");

            /* Translators:
             * This means that the way or area is designated or purpose built
             * for wheelchairs (e.g. elevators designed for wheelchair access
             * only). This is rarely used.
             */
            case 'designated': return _("designated");

            default: return null;
        }
    }


    toJSON() {
        let bounding_box = null;

        if (this.bounding_box) {
            bounding_box = { top: this.bounding_box.top,
                             bottom: this.bounding_box.bottom,
                             left: this.bounding_box.left,
                             right: this.bounding_box.right };
        }

        let location = { latitude: this.location.latitude,
                         longitude: this.location.longitude,
                         altitude: this.location.altitude,
                         accuracy: this.location.accuracy };

        return { id: this.osm_id,
                 osm_type: this.osm_type,
                 place_type: this.place_type,
                 name: this.name,
                 bounding_box: bounding_box,
                 this_type: this.this_type,
                 location: location,
                 street_address: this.street_address,
                 street: this.street,
                 building: this.building,
                 postal_code: this.postal_code,
                 area: this.area,
                 town: this.town,
                 state: this.state,
                 county: this.county,
                 country: this.country,
                 country_code: this.contry_code,
                 continent: this.continent,
                 population: this.population,
                 website: this.website,
                 phone: this.phone,
                 wiki: this.wiki,
                 wheelchair: this.wheelchair,
                 openingHours: this.openingHours,
                 internetAccess: this.internetAccess,
                 religion: this.religion,
                 toilets: this.toilets,
                 note: this.note };
    }

    match(searchString) {
        let name = this.name;
        if (!name)
            return false;

        searchString = Utils.normalizeString(searchString);
        if (searchString === null)
            return false;

        if (searchString.length === 0)
            return true;

        name = Utils.normalizeString(name);
        if (name === null)
            return false;

        /* the search method takes a regex, make sure we have a valid one */
        try {
            return name.toLowerCase().search(searchString.toLowerCase()) !== -1;
        } catch(e) {
            /* not valid regex */
            return false;
        }
    }
});

Place.fromJSON = function(obj) {
    let props = { };

    for (let key in obj) {
        let prop = obj[key];

        switch(key) {
            case 'id':
                props.osm_id = prop;
                break;

            case 'location':
                props.location = new Location.Location(prop);
                break;

            case 'bounding_box':
                if (prop)
                    props.bounding_box = new Geocode.BoundingBox(prop);
                break;

            default:
                if (prop !== null && prop !== undefined)
                    props[key] = prop;
                break;
        }
    }
    return new Place(props);
};

Place.validateCoordinates = function(lat, lon) {
    return lat <= 90 && lat >= -90 && lon <= 180 && lon >= -180;
}

Place.parseCoordinates = function(text) {
    let match = text.match(COORDINATES_REGEX);

    if (match) {
        let latitude = parseFloat(match[1]);
        let longitude = parseFloat(match[2]);

        if (Place.validateCoordinates(latitude, longitude)) {
            return new Location.Location({ latitude: latitude,
                                           longitude: longitude });
        } else
            return null;
    } else
        return null;
};
