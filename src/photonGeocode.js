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
const Soup = imports.gi.Soup;

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
        let name = feature.properties.name;
        Utils.debug('name: ' + name);
        let type = Geocode.PlaceType.MISCELLANEOUS; // TODO: parse this
        let place = new Geocode.Place({name:       name,
                                       place_type: type,
                                       location:   location });

        return new Place.Place({ place: place });
    }

    _buildURL(string, latitude, longitude) {
        let query = new HTTP.Query({ q:       string,
                                     lat:     latitude,
                                     lon:     longitude
                                   });
        return _BASE_URL + query.toString();
    }
}
