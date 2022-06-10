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

import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

import {Application} from './application.js';
import * as HTTP from './http.js';
import * as PhotonUtils from './photonUtils.js';
import * as Service from './service.js';
import * as Utils from './utils.js';

// HTTP session timeout (in seconds)
const TIMEOUT = 5;

export class GraphHopperGeocode {
    constructor() {
        this._session =
            new Soup.Session({ user_agent : 'gnome-maps/' + pkg.version,
                               timeout:     TIMEOUT });
        this._readService();
        this._limit = Application.settings.get('max-search-results');
    }

    search(string, latitude, longitude, cancellable, callback) {
        let url = this._buildURL(string, latitude, longitude);
        let msg = Soup.Message.new('GET', url);

        let handler = cancellable.connect(() => {
            this._session.cancel_message(msg, Soup.Status.CANCELLED);
        });

        this._session.queue_message(msg, (session, message) => {
            cancellable.disconnect(handler);

            if (cancellable.is_cancelled())
                return;

            if (message.status_code !== Soup.KnownStatusCode.OK) {
                callback(null, msg.status_code);
            } else {
                try {
                    let result = this._parseMessage(message.response_body.data);
                    if (!result)
                        callback(null, null);
                    else
                        callback(result, null);
                } catch (e) {
                    Utils.debug('Error: ' + e);
                    callback(null, e);
                }
            }
        });
    }

    reverse(latitude, longitude, callback) {
        let url = this._buildURL(null, latitude, longitude);
        let msg = Soup.Message.new('GET', url);

        Application.application.mark_busy();
        this._session.queue_message(msg, (session, message) => {
            Application.application.unmark_busy();
            try {
                let result = this._parseMessage(message.response_body.data);
                if (!result)
                    callback(null, null);
                else
                    callback(result[0], null);
            } catch (e) {
                Utils.debug('Error: ' + e);
                callback(null, e);
            }
        });
    }

    get attribution() {
        return Service.getService().graphHopperGeocode.attribution;
    }

    get attributionUrl() {
        return Service.getService().graphHopperGeocode.attributionUrl;
    }

    get name() {
        return 'GraphHopper Geocode';
    }

    get url() {
        return 'https://docs.graphhopper.com/#tag/Geocoding-API';
    }

    _parseMessage(message) {
        let json = JSON.parse(message);
        let result = [];
        let hits = json.hits;

        if (!hits || hits.length === 0) {
            Utils.debug('No hits in response');
            return null;
        }

        hits.forEach(hit => {
            let place = this._parseHit(hit);

            if (place)
                result.push(place);
        });

        return result;
    }

    _parseHit(hit) {
        let lat = hit.point.lat;
        let lon = hit.point.lng;

        return PhotonUtils.parsePlace(lat, lon, hit);
    }

    _buildURL(string, latitude, longitude) {
        let query = new HTTP.Query({ limit:   string ? this._limit : 1,
                                     locale:  this._language,
                                     key:     this._apiKey
                                   });
        if (latitude !== null && longitude != null) {
            query.add('point', latitude + ',' + longitude);
            if (string)
                query.add('location_bias_scale', PhotonUtils.LOCATION_BIAS_SCALE);
        }

        if (string)
            query.add('q', string);
        else
            query.add('reverse', 'true');

        return `${this._baseUrl}/api/1/geocode?${query.toString()}`;
    }

    _readService() {
        let graphHopperGeocode = Service.getService().graphHopperGeocode;
        this._language = Utils.getLanguage();

        if (graphHopperGeocode) {
            this._baseUrl = graphHopperGeocode.baseUrl;
            this._apiKey = graphHopperGeocode.apiKey;
        }
    }
}
