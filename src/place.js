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

export class Place extends GObject.Object {

    constructor(params) {
        super();

        /* Some of these properties are read as snake_case for backward compatibility
        with the place store. */
        this._osmId = params.osm_id;
        this._osmType = params.osm_type;
        this._name = params.name;
        this._location = params.location;
        this._boundingBox = params.bounding_box ?? null;
        this._placeType = params.place_type;
        this._streetAddress = params.street_address;
        this._street = params.street;
        this._building = params.building;
        this._postalCode = params.postal_code;
        this._area = params.area;
        this._town = params.town;
        this._state = params.state;
        this._county = params.county;
        this._country = params.country;
        this._countryCode = params.country_code;
        this._continent = params.continent;
        this._originalJson = params.originalJson;

        this.updateFromTags(params);

        this._isCurrentLocation = params.isCurrentLocation;
        this._initialZoom = params.initialZoom;

        /* set to true if the instance is pre-filled with Overpass data,
         * at the time of creation, as will be the case when loading a place
         * from an OSM object URL
         */
        this._prefilled = params.prefilled;

        /* Determines if the place should be added to the place store */
        if (typeof(params.store) === 'undefined') {
            this._store = true;
        } else {
            this._store = params.store;
        }

        this._nativeName = params.nativeName;
        this._osmKey = params.osmKey;
        this._osmValue = params.osmValue;
    }

    get osmId() {
        return this._osmId;
    }

    set osmId(osmId) {
        this._osmId = osmId;
    }

    get osmType() {
        return this._osmType;
    }

    set osmType(osmType) {
        this._osmType = osmType;
    }

    get name() {
        return this._name;
    }

    set name(name) {
        this._name = name;
    }

    get location() {
        return this._location;
    }

    set location(location) {
        this._location = location;
    }

    get boundingBox() {
        return this._boundingBox;
    }

    set boundingBox(boundingBox) {
        this._boundingBox = boundingBox;
    }

    get placeType() {
        return this._placeType;
    }

    set placeType(placeType) {
        this._placeType = placeType;
    }

    get streetAddress() {
        return this._streetAddress;
    }

    set streetAddress(streetAddress) {
        this._streetAddress = streetAddress;
    }

    get street() {
        return this._street;
    }

    set street(street) {
        this._street = street;
    }

    get building() {
        return this._building;
    }

    set building(building) {
        this._building = building;
    }

    get postalCode() {
        return this._postalCode;
    }

    set postalCode(postalCode) {
        this._postalCode = postalCode;
    }

    get area() {
        return this._area;
    }

    set area(area) {
        this._area = area;
    }

    get town() {
        return this._town;
    }

    set town(town) {
        this._town = town;
    }

    get state() {
        return this._state;
    }

    set state(state) {
        this._state = state;
    }

    get county() {
        return this._county;
    }

    set county(county) {
        this._county = county;
    }

    get country() {
        return this._country;
    }

    set country(country) {
        this._country = country;
    }

    get countryCode() {
        return this._countryCode;
    }

    set countryCode(countryCode) {
        this._countryCode = countryCode;
    }

    get continent() {
        return this._continent;
    }

    set continent(continent) {
        this._continent = continent;
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
        return this.osmType + '-' + this.osmId;
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

        if (this.boundingBox) {
            bounding_box = { top: this.boundingBox.top,
                             bottom: this.boundingBox.bottom,
                             left: this.boundingBox.left,
                             right: this.boundingBox.right };
        }

        let location = {
            latitude: this.location.latitude,
            longitude: this.location.longitude,
            altitude: this.location.altitude > -1000000 ? this.location.altitude : undefined,
            accuracy: this.location.accuracy >= 0 ? this.location.accuracy : undefined,
        };

        return { ...this._originalJson,
                 osmId: this._osmId,
                 osmType: this._osmType,
                 osmKey: this._osmKey,
                 osmValue: this._osmValue,
                 place_type: this.placeType,
                 name: this.name,
                 nativeName: this.nativeName,
                 bounding_box: bounding_box,
                 this_type: this.this_type,
                 location: location,
                 street_address: this.streetAddress,
                 street: this.street,
                 building: this.building,
                 postal_code: this.postalCode,
                 area: this.area,
                 town: this.town,
                 state: this.state,
                 county: this.county,
                 country: this.country,
                 country_code: this.countryCode,
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
        if (searchString.length === 0)
            return true;

        searchString = Utils.normalizeString(searchString);
        if (searchString === null)
            return false;

        let name = this.name;
        if (!name)
            return false;

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
                case 'osmId':
                    props.osm_id = prop;
                    break;

                case 'osmType':
                    props.osm_type = prop;
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
        props.originalJson = obj;
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
        let storedPlace = Application.placeStore.getByOsmId(Utils.osmTypeFromString(type), id);

        if (storedPlace) {
            callback(storedPlace.place, null);
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

