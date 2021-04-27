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

const _ = imports.gettext.gettext;

const Geocode = imports.gi.GeocodeGlib;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

const Location = imports.location;
const Overpass = imports.overpass;
const PlaceIcons = imports.placeIcons;
const URLS = imports.urls;
const Utils = imports.utils;

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

var Place = GObject.registerClass(
class Place extends Geocode.Place {

    _init(params) {
        this._isCurrentLocation = params.isCurrentLocation;
        delete params.isCurrentLocation;

        this._population = params.population;
        delete params.population;

        this._website = params.website;
        delete params.website;

        this._email = params.email;
        delete params.email;

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

        this._initialZoom = params.initialZoom;
        delete params.initialZoom;

        /* set to true if the instance is pre-filled with Overpass data,
         * at the time of creation, as will be the case when loading a place
         * from an OSM object URL
         */
        this._prefilled = params.prefilled;
        delete params.prefilled;

        /* Determines if the place should be added to the place store */
        if (typeof(params.store) === 'undefined') {
            this._store = true;
        } else {
            this._store = params.store;
            delete params.store;
        }

        this._wheelchair = params.wheelchair;
        delete params.wheelchair;

        this._nativeName = params.nativeName;
        delete params.nativeName;

        this._osmKey = params.osmKey;
        delete params.osmKey;

        this._osmValue = params.osmValue;
        delete params.osmValue;

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
                       country_code: params.place.country_code,
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
                 country_code: this.contry_code,
                 continent: this.continent,
                 population: this.population,
                 website: this.website,
                 email: this.email,
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
};

Place.parseDecimalCoordinates = function(text) {
    let match = text.match(DECIMAL_COORDINATES_REGEX);

    if (match) {
        let latitude = parseFloat(match[1]);
        let longitude = parseFloat(match[2]);

        return [latitude, longitude];
    } else {
        return null;
    }
};

Place.parseDmsCoordinates = function(text) {
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

Place.parseCoordinates = function(text) {
    let coords = Place.parseDecimalCoordinates(text) ||
        Place.parseDmsCoordinates(text);

    if (coords && Place.validateCoordinates(coords[0], coords[1])) {
        return new Location.Location({ latitude: coords[0],
                                       longitude: coords[1] });
    } else {
        return null;
    }
};

let overpass = null;

/* we can't import Application before the Place class has been defined
 * since it's used via PlaceStore
 */
const Application = imports.application;

function parseHttpURL(text, callback) {
    let [type, id] = URLS.parseAsObjectURL(text);

    if (type && id) {
        let storedPlace = Application.placeStore.existsWithOsmTypeAndId(type, id);

        if (storedPlace) {
            callback(storedPlace, null);
            return;
        }

        if (overpass === null)
            overpass = new Overpass.Overpass();

        Application.application.mark_busy();
        overpass.fetchPlace(type, id, (place) => {
            Application.application.unmark_busy();
            if (place)
                callback(place, null);
            else
                callback(null, _("Place not found in OpenStreetMap"));
        });
    } else {
        let [lat, lon, zoom] = URLS.parseAsCoordinateURL(text);

        if (lat && lon) {
            if (!Place.validateCoordinates(lat, lon)) {
                callback(null, _("Coordinates in URL are not valid"));
            } else {
                let location = new Location.Location({ latitude: lat, longitude: lon });
                let place = zoom ? new Place({ location: location, initialZoom: zoom }) :
                                   new Place({ location: location });

                callback(place, null);
            }
        } else {
            callback(null, _("URL is not supported"));
        }
    }
}

