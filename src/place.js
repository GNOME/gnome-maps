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

import gettext from 'gettext';

import GeocodeGlib from 'gi://GeocodeGlib';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import {Location} from './location.js';
import {Overpass} from './overpass.js';
import * as PlaceIcons from './placeIcons.js';
import * as URIS from './uris.js';
import * as Utils from './utils.js';

const _ = gettext.gettext;

// Matches coordinates string in 'Decimal Degrees' format
const DECIMAL_COORDINATES_REGEX = (
    /^\s*(\-?\d+(?:\.\d+)?)°?\s*,\s*(\-?\d+(?:\.\d+)?)°?\s*$/
);

// Matches coordinates string in 'Degrees, Minutes, Seconds' format
const DMS_COORDINATES_REGEX = new RegExp(
    /^\s*(\d+)°?\s*(\d+)['′]?\s*(\d+(?:.\d+)?)["″]?\s*(N|S)\s*,?/.source
    + /\s*(\d+)°?\s*(\d+)['′]?\s*(\d+(?:.\d+)?)["″]?\s*(W|E)\s*$/.source,
    "i"
);

export class Place extends GeocodeGlib.Place {

    constructor(params) {
        let originalParams = {};

        Object.assign(originalParams, params);

        delete params.population;
        delete params.website;
        delete params.email;
        delete params.phone;
        delete params.wiki;
        delete params.wikidata;
        delete params.openingHours;
        delete params.internetAccess;
        delete params.religion;
        delete params.takeaway;
        delete params.note;
        delete params.isCurrentLocation;
        delete params.initialZoom;
        delete params.prefilled;
        delete params.store;
        delete params.wheelchair;
        delete params.nativeName;
        delete params.osmKey;
        delete params.osmValue;

        if (originalParams.place) {
            params = { osm_id: originalParams.place.osm_id,
                       osm_type: originalParams.place.osm_type,
                       name: originalParams.place.name,
                       location: originalParams.place.location,
                       bounding_box: originalParams.place.bounding_box,
                       place_type: originalParams.place.place_type,
                       street_address: originalParams.place.street_address,
                       street: originalParams.place.street,
                       building: originalParams.place.building,
                       postal_code: originalParams.place.postal_code,
                       area: originalParams.place.area,
                       town: originalParams.place.town,
                       state: originalParams.place.state,
                       county: originalParams.place.county,
                       country: originalParams.place.country,
                       country_code: originalParams.place.country_code,
                       continent: originalParams.place.continent };
        }

        for (let prop in params)
            if (!params[prop])
                delete params[prop];

        super(params);

        this.updateFromTags(originalParams);

        this._isCurrentLocation = originalParams.isCurrentLocation;
        this._initialZoom = originalParams.initialZoom;

        /* set to true if the instance is pre-filled with Overpass data,
         * at the time of creation, as will be the case when loading a place
         * from an OSM object URL
         */
        this._prefilled = originalParams.prefilled;

        /* Determines if the place should be added to the place store */
        if (typeof(originalParams.store) === 'undefined') {
            this._store = true;
        } else {
            this._store = originalParams.store;
        }

        this._nativeName = originalParams.nativeName;
        this._osmKey = originalParams.osmKey;
        this._osmValue = originalParams.osmValue;
    }

    /**
     * Update place with values from OSM tags.
     */
    updateFromTags(tags) {
        /* special handle tags where we use a different name compared to
         * OSM, to remain backwards-compatible with the place store
         */
        let wiki = tags.wiki ?? tags.wikipedia;
        let openingHours = tags.openingHours ?? tags.opening_hours;
        let internetAccess = tags.internetAccess ?? tags.internet_access;

        if (tags.name)
            this.nativeName = tags.name;
        if (tags.population)
            this.population = tags.population;
        if (tags['contact:website'])
            this.website = tags['contact:website'];
        if (tags.website)
            this.website = tags.website;
        if (tags['contact:email'])
            this.email = tags['contact:email'];
        if (tags.email)
            this.email = tags.email;
        if (tags['contact:phone'])
            this.phone = tags['contact:phone'];
        if (tags.phone)
            this.phone = tags.phone;
        if (wiki)
            this.wiki = wiki;
        if (tags.wikidata)
            this.wikidata = tags.wikidata;
        if (tags.wheelchair)
            this.wheelchair = tags.wheelchair;
        if (openingHours)
            this.openingHours = openingHours;
        if (internetAccess)
            this.internetAccess = internetAccess;
        if (tags.ele && this.location)
            this.location.altitude = parseFloat(tags.ele);
        else if (tags.ele && tags.location)
            tags.location.altitude = tags.ele;
        if (tags.religion)
            this.religion = tags.religion
        if (tags.toilets)
            this.toilets = tags.toilets;
        if (tags.takeaway)
            this.takeaway = tags.takeaway;
        if (tags.note)
            this.note = tags.note;
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

    get isCurrentLocation() {
        return this._isCurrentLocation;
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

    set email(v) {
        this._email = v;
    }

    get email() {
        return this._email;
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

    set wikidata(v) {
        this._wikidata = v;
    }

    get wikidata() {
        return this._wikidata;
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

    get internetAccess() {
        return this._internetAccess;
    }

    set religion(v) {
        this._religion = v;
    }

    get religion() {
        return this._religion;
    }

    set toilets(v) {
        this._toilets = v;
    }

    get toilets() {
        return this._toilets;
    }

    set takeaway(v) {
        this._takeaway = v;
    }

    get takeaway() {
        return this._takeaway;
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

    get initialZoom() {
        return this._initialZoom;
    }

    get prefilled() {
        return this._prefilled;
    }

    set prefilled(prefilled) {
        this._prefilled = prefilled;
    }

    get nativeName() {
        return this._nativeName;
    }

    set nativeName(nativeName) {
        this._nativeName = nativeName;
    }

    /**
     * Most important OSM tag for the place ('amenity', 'shop', and so on).
     * This corresponds to the osm_key parameter in Photon geocoder
     */
    get osmKey() {
        return this._osmKey;
    }

    /**
     * Value for the most important OSM tag.
     * This corresponds to the osm_value parameter in Photon geocoder.
     */
    get osmValue() {
        return this._osmValue;
    }

    get icon() {
        return Gio.Icon.new_for_string(this._getIconName());
    }

    _getIconName() {
        return PlaceIcons.getIconForPlace(this);
    }

    /**
     * This property is true for places related to eating and/or drinking,
     * such as restaurants, cafes, pubs and similar
     */
    get isEatingAndDrinking() {
        return this._osmKey === 'amenity' &&
               ['bar', 'biergarten', 'cafe', 'fast_food', 'food_court',
                'restaurant', 'pub'].indexOf(this._osmValue) !== -1;
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
                 osmKey: this._osmKey,
                 osmValue: this._osmValue,
                 place_type: this.place_type,
                 name: this.name,
                 nativeName: this.nativeName,
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
                 country_code: this.country_code,
                 continent: this.continent,
                 population: this.population,
                 website: this.website,
                 email: this.email,
                 phone: this.phone,
                 wiki: this.wiki,
                 wikidata: this.wikidata,
                 wheelchair: this.wheelchair,
                 openingHours: this.openingHours,
                 internetAccess: this.internetAccess,
                 religion: this.religion,
                 toilets: this.toilets,
                 takeaway: this.takeaway,
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

    static fromJSON(obj) {
        let props = { };

        for (let key in obj) {
            let prop = obj[key];

            switch(key) {
                case 'id':
                    props.osm_id = prop;
                    break;

                case 'location':
                    props.location = new Location(prop);
                    break;

                case 'bounding_box':
                    if (prop)
                        props.bounding_box = new GeocodeGlib.BoundingBox(prop);
                    break;

                default:
                    if (prop !== null && prop !== undefined)
                        props[key] = prop;
                    break;
            }
        }
        return new Place(props);
    }

    static validateCoordinates(lat, lon) {
        return lat <= 90 && lat >= -90 && lon <= 180 && lon >= -180;
    }

    static parseDecimalCoordinates(text) {
        let match = text.match(DECIMAL_COORDINATES_REGEX);

        if (match) {
            let latitude = parseFloat(match[1]);
            let longitude = parseFloat(match[2]);

            return [latitude, longitude];
        } else {
            return null;
        }
    }

    static parseDmsCoordinates(text) {
        let match = text.match(DMS_COORDINATES_REGEX);

        if (match) {
            let degrees = parseFloat(match[1]);
            let minutes = parseFloat(match[2]);
            let seconds = parseFloat(match[3]);
            let latitude = degrees + minutes / 60 + seconds / 3600;

            if (match[4].toUpperCase() === "S")
                latitude *= -1;

            degrees = parseFloat(match[5]);
            minutes = parseFloat(match[6]);
            seconds = parseFloat(match[7]);
            let longitude = degrees + minutes / 60 + seconds / 3600;

            if (match[8].toUpperCase() === "W")
                longitude *= -1;

            return [latitude, longitude];
        } else {
            return null;
        }
    };

    static parseCoordinates(text) {
        let coords = Place.parseDecimalCoordinates(text) ||
            Place.parseDmsCoordinates(text);

        if (coords && Place.validateCoordinates(coords[0], coords[1])) {
            return new Location({ latitude: coords[0], longitude: coords[1] });
        } else {
            return null;
        }
    }

    static parseHttpURL(text, callback) {
        _parseHttpURL(text, callback);
    }
}

GObject.registerClass(Place);

let overpass = null;

/* we can't import Application before the Place class has been defined
 * since it's used via PlaceStore
 */
import {Application} from './application.js';

function _parseHttpURL(text, callback) {
    let [type, id] = URIS.parseAsObjectURL(text);

    if (type && id) {
        let storedPlace = Application.placeStore.existsWithOsmTypeAndId(type, id);

        if (storedPlace) {
            callback(storedPlace, null);
            return;
        }

        if (overpass === null)
            overpass = new Overpass();

        Application.application.mark_busy();
        overpass.fetchPlace(type, id, (place) => {
            Application.application.unmark_busy();
            if (place)
                callback(place, null);
            else
                callback(null, _("Place not found in OpenStreetMap"));
        });
    } else {
        let [lat, lon, zoom] = URIS.parseAsCoordinateURL(text);

        if (lat && lon) {
            if (!Place.validateCoordinates(lat, lon)) {
                callback(null, _("Coordinates in URL are not valid"));
            } else {
                let location = new Location({ latitude: lat, longitude: lon });
                let place = zoom ? new Place({ location: location, initialZoom: zoom }) :
                                   new Place({ location: location });

                callback(place, null);
            }
        } else {
            callback(null, _("URL is not supported"));
        }
    }
}

