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

import * as Address from './address.js';
import {Location} from './location.js';
import * as OSMNames from './osmNames.js';
import {Overpass} from './overpass.js';
import * as PlaceIcons from './placeIcons.js';
import {spriteSource} from './mapSource.js';
import * as URIS from './uris.js';
import * as Utils from './utils.js';

const _ = gettext.gettext;
const C_ = gettext.dgettext;

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
        this._osmId = params.osmId;
        this._osmType = params.osmType;
        this._name = params.name;
        this._description = params.description;
        this._source = params.source;
        this._location = params.location;
        this._boundingBox = params.boundingBox ?? null;
        this._placeType = params.placeType;
        this._streetAddress = params.streetAddress;
        this._street = params.street;
        this._building = params.building;
        this._postalCode = params.postalCode;
        this._area = params.area;
        this._town = params.town;
        this._state = params.state;
        this._county = params.county;
        this._country = params.country;
        this._countryCode = params.countryCode;
        this._continent = params.continent;
        this._originalJson = params.originalJson;

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
        this._osmTags = params.osmTags;
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

    get osmTags() {
        return this._osmTags;
    }

    set osmTags(osmTags) {
        this._osmTags = osmTags;

        if (osmTags.ele && this.location)
            this.location.altitude = parseFloat(osmTags.ele);
    }

    get name() {
        if (this.osmTags) {
            const language = Utils.getLanguage();

            return OSMNames.getNameForLanguageAndCountry(
                this.osmTags, language, this.countryCode
            );
        }

        return this._name ?? this.coordinatesDescription;
    }

    set name(name) {
        this._name = name;
    }

    get description() {
        return this._description;
    }

    set description(description) {
        this._description = description;
    }

    get source() {
        return this._source;
    }

    set source(source) {
        this._source = source;
    }

    get location() {
        return this._location;
    }

    set location(location) {
        this._location = location;
        this.notify('location');
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
        if (this.houseNumber && this.street) {
            return Address.streetAddressForCountryCode(
                this.street, this.houseNumber, this.countryCode
            );
        }

        return this._streetAddress;
    }

    get street() {
        return this.osmTags?.['contact:street'] ??
               this.osmTags?.['addr:street'] ??
               this._street;
    }

    get houseNumber() {
        return this.osmTags?.['contact:housenumber'] ??
               this.osmTags?.['addr:housenumber'];
    }

    get building() {
        return this._building;
    }

    set building(building) {
        this._building = building;
    }

    get postalCode() {
        return this.osmTags?.['contact:postcode'] ??
               this.osmTags?.['addr:postcode'] ??
               this._postalCode;
    }

    get area() {
        return this._area;
    }

    get town() {
        return this.osmTags?.['contact:city'] ??
               this.osmTags?.['addr:city'] ??
               this._town;
    }

    get state() {
        return this._state;
    }

    get county() {
        return this._county;
    }

    get country() {
        return this._country;
    }

    get countryCode() {
        let result = this.osmTags?.['contact:country'] ??
                     this.osmTags?.['addr:country'] ??
                     this._countryCode;
        if (result)
            return result;

        this._countryCode = Utils.getCountryCodeForCoordinates(
            this.location.latitude,
            this.location.longitude
        );
        return this._countryCode;
    }

    get continent() {
        return this._continent;
    }

    set continent(continent) {
        this._continent = continent;
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

    // true if the place is not connected to an OSM object
    get isRawCoordinates() {
        return !this._osmType && !this._osmId;
    }

    get coordinatesDescription() {
        const lat =
            this.location.latitude.toLocaleString(undefined,
                                                  { minimumFractionDigits: 5,
                                                    maximumFractionDigits: 5 });
        const lon =
            this.location.longitude.toLocaleString(undefined,
                                                   { minimumFractionDigits: 5,
                                                     maximumFractionDigits: 5 });

        /* Translators: this is a format template string for a pair of raw
         * coordinates, the comma can be adapted to local conventions if needed.
         */
        return C_("coordinates", "%s, %s").format(lat, lon);
    }

    get population() {
        return this.osmTags?.population;
    }

    get website() {
        return this.osmTags?.['contact:website'] ?? this.osmTags?.website;
    }

    get email() {
        return this.osmTags?.['contact:email'] ?? this.osmTags?.email;
    }

    get phone() {
        return this.osmTags?.['contact:phone'] ?? this.osmTags?.phone;
    }

    get wiki() {
        return this.osmTags?.wikipedia ?? this.osmTags?.wiki;
    }

    get wikidata() {
        return this.osmTags?.wikidata;
    }

    get brandWikidata() {
        return this.osmTags?.['brand:wikidata'];
    }

    get networkWikidata() {
        return this.osmTags?.['network:wikidata'];
    }

    get openingHours() {
        return this.osmTags?.opening_hours ?? this.osmTags?.openingHours;
    }

    get internetAccess() {
        return this.osmTags?.internet_access ?? this.osmTags?.internetAccess;
    }

    get religion() {
        return this.osmTags?.religion;
    }

    get sport() {
        return this.osmTags?.sport;
    }

    get toilets() {
        return this.osmTags?.toilets;
    }

    get takeaway() {
        return this.osmTags?.takeaway;
    }

    get note() {
        return this.osmTags?.note;
    }

    get wheelchair() {
        return this.osmTags?.wheelchair;
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
        return this.osmTags?.name;
    }

    get hiraganaName() {
        return this.osmTags?.['name:ja-Hira'];
    }

    /**
     * Gets an array of objects with {shield, name, network, ref}
     * from the route_x_[network|ref] tags
     */
    get routes() {
        return [1, 2, 3, 4, 5].map(i => {
                                   const network =
                                    this.osmTags?.['route_' + i + '_network'] ?? '';

                                   return { shield:  spriteSource.get_shield_for_network(network),
                                            name:    this.osmTags?.['route_' + i + '_name'],
                                            network: network,
                                            ref:     this.osmTags?.['route_' + i + '_ref']
                                           }
                                   })
                              .filter(e => e.shield);
    }

    /**
     * Most important OSM tag for the place ('amenity', 'shop', and so on).
     */
    get osmKey() {
        const osmTags = this.osmTags;

        if (osmTags) {
            const tag = [
                'place', 'amenity', 'leisure', 'shop', 'tourism', 'highway',
                'railway', 'aeroway', 'office', 'building', 'historic', 'barrier',
                'landuse'
            ].find(key => key in osmTags);

            if (tag)
                return tag;
        }

        return this._osmKey;
    }

    /**
     * Value for the most important OSM tag.
     * This corresponds to the osm_value parameter in Photon geocoder.
     */
    get osmValue() {
        return this.osmTags?.[this.osmKey] ?? this._osmValue;
    }

    get icon() {
        return Gio.Icon.new_for_string(this._getIconName());
    }

    _getIconName() {
        return this.isRawCoordinates ? 'pin-location-symbolic' :
                                        PlaceIcons.getIconForPlace(this);
    }

    /**
     * This property is true for places related to eating and/or drinking,
     * such as restaurants, cafes, pubs and similar
     */
    get isEatingAndDrinking() {
        return this.osmKey === 'amenity' &&
               ['bar', 'biergarten', 'cafe', 'fast_food', 'food_court',
                'restaurant', 'pub'].indexOf(this.osmValue) !== -1;
    }

    get level() {
        return this.osmTags?.level;
    }

    get floor() {
        return this.osmTags?.['addr:floor'] ?? this.osmTags?.['level:ref'];
    }

    get ref() {
        return this.osmTags?.ref;
    }

    /**
     * Return true if the place is a motorway junction ("highway exit")
     */
    get isMotorwayJunction() {
        return this.osmTags?.highway === 'motorway_junction';
    }

    get station() {
        return this.osmTags?.station;
    }

    toJSON() {
        let boundingBox = null;

        if (this.boundingBox) {
            boundingBox = { top: this.boundingBox.top,
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
                 osmTags: this._osmTags,
                 placeType: this._placeType,
                 name: this._name,
                 description: this._description,
                 source: this._source,
                 nativeName: this._nativeName,
                 boundingBox,
                 location: location,
                 streetAddress: this._streetAddress,
                 street: this._street,
                 building: this._building,
                 postalCode: this._postalCode,
                 area: this._area,
                 town: this._town,
                 state: this._state,
                 county: this._county,
                 country: this._country,
                 countryCode: this._countryCode,
                 continent: this._continent };
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
                case 'location':
                    props.location = new Location(prop);
                    break;

                case 'boundingBox':
                    if (prop)
                        props.boundingBox = new GeocodeGlib.BoundingBox(prop);
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

GObject.registerClass({
    Properties: {
        'location': GObject.ParamSpec.object('location',
                                             'location',
                                             'The location of the place',
                                             GObject.ParamFlags.READABLE |
                                             GObject.ParamFlags.WRITABLE,
                                             GeocodeGlib.Location)
}}, Place);

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

