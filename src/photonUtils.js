/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2019 Marcus Lundblad.
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
 * Author: Marcus Lundblad <ml@update.uu.se>
 */

import gettext from 'gettext';

import GeocodeGlib from 'gi://GeocodeGlib';

import * as Address from './address.js';
import * as OSMTypes from './osmTypes.js';
import {Place} from './place.js';
import * as Utils from './utils.js';

const _ = gettext.gettext;

/* Define location bias scale parameter to adjust prominance of search results
 * with respect to location.
 * See: https://github.com/komoot/photon/issues/600
 */
export const LOCATION_BIAS_SCALE = 0.5;

export function parsePlace(latitude, longitude, properties) {
    let location = new GeocodeGlib.Location({ latitude:  latitude,
                                          longitude: longitude,
                                          accuracy:  0.0 });
    let type = _parsePlaceType(properties);
    let name = _parseName(properties);

    if (!name)
        return null;

    let street = properties.street;
    let housenumber = properties.housenumber;
    let countryCode = properties.countrycode ??
                      Utils.getCountryCodeForCoordinates(latitude, longitude);
    let streetAddress;

    if (housenumber && street) {
        streetAddress = Address.streetAddressForCountryCode(street, housenumber,
                                                            countryCode);

        /* in some cases Photon seems to give housenumber or street as name,
         * in that case set the name as the formatted street address
         */
        if (name === housenumber || name === street)
            name = streetAddress;
    }

    let params = { name: name, placeType: type, location: location };

    if (streetAddress)
        params.streetAddress = streetAddress;

    if (properties.osm_id && properties.osm_type) {
        params.osmId = properties.osm_id + ''; // Geocode-glib needs this as a string
        params.osmType = _parseOsmType(properties.osm_type);
    }

    if (properties.street)
        params.street = properties.street;

    if (properties.city)
        params.town = properties.city;

    if (properties.postcode)
        params.postalCode = properties.postcode;

    if (properties.state)
        params.state = properties.state;

    if (countryCode)
        params.countryCode = countryCode;

    if (!countryCode && properties.country)
        params.country = properties.country;

    if (properties.extent)
        params.boundingBox = _parseBoundingBox(properties.extent);

    if (properties.osm_key)
        params.osmKey = properties.osm_key;

    if (properties.osm_value)
        params.osmValue = properties.osm_value;

    return new Place(params);
}

function _parseName(properties) {
    if (!properties)
        return '';

    if (properties.name) {
        return properties.name;
    } else if (properties.housenumber) {
        return properties.housenumber;
    } else {
        let typeTitle =
            OSMTypes.lookupType(properties.osm_key, properties.osm_value);

        return typeTitle || _("Unnamed place");
    }
}

function _parseOsmType(osmType) {
    switch (osmType) {
        case 'N':
            return GeocodeGlib.PlaceOsmType.NODE;
        case 'W':
            return GeocodeGlib.PlaceOsmType.WAY;
        case 'R':
            return GeocodeGlib.PlaceOsmType.RELATION;
        default:
            return GeocodeGlib.PlaceOsmType.UNKNOWN;
    }
}

function _parsePlaceType(properties) {
    if (!properties)
        return GeocodeGlib.PlaceType.UNKNOWN;

    let key = properties.osm_key;
    let value = properties.osm_value;

    switch (key) {
        case 'place':
            switch (value) {
                case 'continent':
                    return GeocodeGlib.PlaceType.CONTINENT;
                case 'country':
                    return GeocodeGlib.PlaceType.COUNTRY;
                case 'city':
                case 'town':
                case 'village':
                case 'hamlet':
                    return GeocodeGlib.PlaceType.TOWN;
                case 'suburb':
                    return GeocodeGlib.PlaceType.SUBURB;
                case 'house':
                    return GeocodeGlib.PlaceType.BUILDING;
                case 'island':
                    return GeocodeGlib.PlaceType.ISLAND;
                case 'municipality':
                    return GeocodeGlib.PlaceType.COUNTY;
                default:
                    return GeocodeGlib.PlaceType.MISCELLANEOUS;
            }
        case 'amenity':
            switch (value) {
                case 'bar':
                case 'pub':
                case 'nightclub':
                    return GeocodeGlib.PlaceType.BAR;
                case 'restaurant':
                case 'fast_food':
                    return GeocodeGlib.PlaceType.RESTAURANT;
                case 'school':
                case 'kindergarten':
                    return GeocodeGlib.PlaceType.SCHOOL;
                case 'place_of_worship':
                    return GeocodeGlib.PlaceType.PLACE_OF_WORSHIP;
                case 'bus_station':
                    return GeocodeGlib.PlaceType.BUS_STOP;
                default:
                    return GeocodeGlib.PlaceType.MISCELLANEOUS;
            }
        case 'highway':
            switch (value) {
                case 'bus_stop':
                    return GeocodeGlib.PlaceType.BUS_STOP;
                case 'motorway':
                    return GeocodeGlib.PlaceType.MOTORWAY;
                default:
                    return GeocodeGlib.PlaceType.STREET;
            }
        case 'railway':
            switch (value) {
                case 'station':
                case 'stop':
                case 'halt':
                    return GeocodeGlib.PlaceType.RAILWAY_STATION;
                case 'tram_stop':
                    return GeocodeGlib.PlaceType.LIGHT_RAIL_STATION;
                default:
                    return GeocodeGlib.PlaceType.MISCELLANEOUS;
            }
        case 'aeroway':
            switch (value) {
                case 'aerodrome':
                    return GeocodeGlib.PlaceType.AIRPORT;
                default:
                    return GeocodeGlib.PlaceType.MISCELLANEOUS;
            }
        case 'building':
            switch (value) {
                case 'yes':
                    return GeocodeGlib.PlaceType.BUILDING;
                case 'railway_station':
                    return GeocodeGlib.PlaceType.RAILWAY_STATION;
                default:
                    return GeocodeGlib.PlaceType.MISCELLANEOUS;
            }
        default:
            return GeocodeGlib.PlaceType.MISCELLANEOUS;
    }
}

function _parseBoundingBox(extent) {
    if (!Array.isArray(extent) || extent.length !== 4 ||
        !_isValidLongitude(extent[0]) || !_isValidLatitude(extent[1]) ||
        !_isValidLongitude(extent[2]) || !_isValidLatitude(extent[3])) {
        Utils.debug('invalid extents in response: ' +
                    JSON.stringify(extent, null, 2));
        return null;
    }

    /* it seems GraphHopper geocode swaps order of bottom and top compared
     * to stock Photon, so just in case "clamp" both pairs
     */
    return new GeocodeGlib.BoundingBox({ left:   Math.min(extent[0], extent[2]),
                                         bottom: Math.min(extent[1], extent[3]),
                                         right:  Math.max(extent[0], extent[2]),
                                         top:    Math.max(extent[1], extent[3]) });
}

/* check if an extent value is a valid latitude (clamp to the maximum latitude
 * supported by the map view
 */
function _isValidLatitude(number) {
    return Number.isFinite(number) && number >= -85.0511287798 &&
           number <= 85.0511287798;
}

// check if an extent value is a valid longitude
function _isValidLongitude(number) {
    return Number.isFinite(number) && number >= -180 && number <= 180;
}
