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

const _ = imports.gettext.gettext;

const Geocode = imports.gi.GeocodeGlib;
const GWeather = imports.gi.GWeather;

const Address = imports.address;
const OSMTypes = imports.osmTypes;
const Place = imports.place;

function parsePlace(latitude, longitude, properties) {
    let location = new Geocode.Location({ latitude:  latitude,
                                          longitude: longitude,
                                          accuracy:  0.0 });
    let type = _parsePlaceType(properties);
    let name = _parseName(properties);

    if (!name)
        return null;

    let street = properties.street;
    let housenumber = properties.housenumber;
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

    let place = new Geocode.Place({ name:       name,
                                    place_type: type,
                                    location:   location });

    if (streetAddress)
        place.street_address = streetAddress;

    let countryCode = _getCountryCode(latitude, longitude);

    if (properties.osm_id && properties.osm_type) {
        place.osm_id = properties.osm_id + ''; // Geocode-glib needs this as a string
        place.osm_type = _parseOsmType(properties.osm_type);
    }

    if (properties.street)
        place.street = properties.street;

    if (properties.city)
        place.town = properties.city;

    if (properties.postcode)
        place.postal_code = properties.postcode;

    if (properties.state)
        place.state = properties.state;

    if (countryCode)
        place.country_code = countryCode;

    if (!countryCode && properties.country)
        place.country = properties.country;

    return new Place.Place({ place: place });
}

function _getCountryCode(lat, lon) {
    let location = GWeather.Location.new_detached('', null, lat, lon);

    return location.get_country();
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
            return Geocode.PlaceOsmType.NODE;
        case 'W':
            return Geocode.PlaceOsmType.WAY;
        case 'R':
            return Geocode.PlaceOsmType.RELATION;
        default:
            return Geocode.PlaceOsmType.UNKNOWN;
    }
}

function _parsePlaceType(properties) {
    if (!properties)
        return Geocode.PlaceType.UNKNOWN;

    let key = properties.osm_key;
    let value = properties.osm_value;

    switch (key) {
        case 'place':
            switch (value) {
                case 'continent':
                    return Geocode.PlaceType.CONTINENT;
                case 'country':
                    return Geocode.PlaceType.COUNTRY;
                case 'city':
                case 'town':
                case 'village':
                    return Geocode.PlaceType.TOWN;
                case 'suburb':
                    return Geocode.PlaceType.SUBURB;
                case 'house':
                    return Geocode.PlaceType.BUILDING;
                case 'island':
                    return Geocode.PlaceType.ISLAND;
                case 'municipality':
                    return Geocode.PlaceType.COUNTY;
                default:
                    return Geocode.PlaceType.MISCELLANEOUS;
            }
        case 'amenity':
            switch (value) {
                case 'bar':
                case 'pub':
                case 'nightclub':
                    return Geocode.PlaceType.BAR;
                case 'restaurant':
                case 'fast_food':
                    return Geocode.PlaceType.RESTAURANT;
                case 'school':
                case 'kindergarten':
                    return Geocode.PlaceType.SCHOOL;
                case 'place_of_worship':
                    return Geocode.PlaceType.PLACE_OF_WORSHIP;
                case 'bus_station':
                    return Geocode.PlaceType.BUS_STOP;
                default:
                    return Geocode.PlaceType.MISCELLANEOUS;
            }
        case 'highway':
            switch (value) {
                case 'bus_stop':
                    return Geocode.PlaceType.BUS_STOP;
                case 'motorway':
                    return Geocode.PlaceType.MOTORWAY;
                default:
                    return Geocode.PlaceType.STREET;
            }
        case 'railway':
            switch (value) {
                case 'station':
                case 'stop':
                case 'halt':
                    return Geocode.PlaceType.RAILWAY_STATION;
                case 'tram_stop':
                    return Geocode.PlaceType.LIGHT_RAIL_STATION;
                default:
                    return Geocode.PlaceType.MISCELLANEOUS;
            }
        case 'aeroway':
            switch (value) {
                case 'aerodrome':
                    return Geocode.PlaceType.AIRPORT;
                default:
                    return Geocode.PlaceType.MISCELLANEOUS;
            }
        case 'building':
            switch (value) {
                case 'yes':
                    return Geocode.PlaceType.BUILDING;
                case 'railway_station':
                    return Geocode.PlaceType.RAILWAY_STATION;
                default:
                    return Geocode.PlaceType.MISCELLANEOUS;
            }
        default:
            return Geocode.PlaceType.MISCELLANEOUS;
    }
}
