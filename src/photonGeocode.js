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

const Geocode = imports.gi.GeocodeGlib;
const GWeather = imports.gi.GWeather;
const Soup = imports.gi.Soup;

const Address = imports.address;
const HTTP = imports.http;
const Place = imports.place;
const Utils = imports.utils;

const _BASE_URL = 'https://photon.komoot.de/api/?';

var PhotonGeocode = class {
    constructor() {
        this._session = new Soup.Session({ user_agent : 'gnome-maps/' + pkg.version });
    }

    search(string, latitude, longitude, callback) {
        Utils.debug('photon search: ' + string);
        let url = this._buildURL(string, latitude, longitude);
        let msg = Soup.Message.new('GET', url);
        Utils.debug('URL: ' + url);
        this._session.queue_message(msg, (session, message) => {
            try {
                Utils.debug('message: ' + message.response_body.data);
                let result = this._parseMessage(message.response_body.data);
                if (!result)
                    callback(null, null);
                else
                    callback(result, null);
            } catch (e) {
                Utils.debug('Error: ' + e);
                callback(null, e);
            }
        });
    }

    _parseMessage(message) {
        let json = JSON.parse(message);
        let result = [];
        let features = json.features;

        if (!features) {
            Utils.debug('No features in response');
            return null;
        }

        Utils.debug('number of results: ' + features.length);

        features.forEach(feature => result.push(this._parseFeature(feature)));

        Utils.debug('results: ' + result.length);

        return result;
    }

    _parseFeature(feature) {
        Utils.debug('_parseFeature');
        Utils.debug('feature: ' + JSON.stringify(feature, null, 2));
        let [lon, lat] = feature.geometry.coordinates;
        let location = new Geocode.Location({ latitude:  lat,
                                              longitude: lon,
                                              accuracy:  0.0 });
        let type = this._parsePlaceType(feature);
        let name = this._parseName(feature);
        let place = new Geocode.Place({ name:       name,
                                        place_type: type,
                                        location:   location });
        let street = feature.properties.street;
        let housenumber = feature.properties.housenumber;
        let countryCode = this._getCountryCode(lat, lon);

        if (feature.properties.osm_id && feature.properties.osm_type) {
            place.osm_id = feature.properties.osm_id + ''; // Geocode-glib needs this as a string
            place.osm_type = this._parseOsmType(feature.properties.osm_type);
        }

        if (housenumber && street) {
            place.street_address =
                Address.streetAddressForCountryCode(street, housenumber,
                                                    countryCode);
        }

        if (feature.properties.street)
            place.street = feature.properties.street;

        if (feature.properties.city)
            place.town = feature.properties.city;

        if (feature.properties.postcode)
            place.postal_code = feature.properties.postcode;

        if (feature.properties.state)
            place.state = feature.properties.state;

        Utils.debug('Country: ' + countryCode);

        if (countryCode)
            place.country_code = countryCode;

        if (!countryCode && feature.properties.country)
            place.country = feature.properties.country;

        return new Place.Place({ place: place });
    }

    _getCountryCode(lat, lon) {
        let location = GWeather.Location.new_detached('', null, lat, lon);

        return location.get_country();
    }

    _parseName(feature) {
        let properties = feature.properties;

        if (!properties)
            return '';

        if (properties.name)
            return properties.name;
        else if (properties.housenumber)
            return properties.housenumber;
        else
            return '';
    }

    _parseOsmType(osmType) {
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

    _parsePlaceType(feature) {
        let properties = feature.properties;

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
                        return Geocode.PlaceType.TOWN;
                    case 'suburb':
                        return Geocode.PlaceType.SUBURB;
                    case 'house':
                        return Geocode.PlaceType.BUILDING;
                    case 'island':
                        return Geocode.PlaceType.ISLAND;
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
                        return Geocode.PlaceType.RESTAURANT;
                    case 'school':
                    case 'kindergarten':
                        return Geocode.PlaceType.SCHOOL;
                    case 'place_of_worship':
                        return Geocode.PlaceType.PLACE_OF_WORSHIP;
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
                        return Geocode.PlaceType.RAILWAY_STATION;
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
                    default:
                        return Geocode.PlaceType.MISCELLANEOUS;
                }
            default:
                return Geocode.PlaceType.MISCELLANEOUS;

        }
    }

    _buildURL(string, latitude, longitude) {
        let query = new HTTP.Query({ q:       string,
                                     lat:     latitude,
                                     lon:     longitude
                                   });
        return _BASE_URL + query.toString();
    }
}
