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

const Format = imports.format;

const GLib = imports.gi.GLib;
const Soup = imports.gi.Soup;

const Application = imports.application;
const HTTP = imports.http;
const PhotonParser = imports.photonParser;
const Service = imports.service;
const Utils = imports.utils;

// HTTP session timeout (in seconds)
const TIMEOUT = 5;

var PhotonGeocode = class {
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
        return Service.getService().photonGeocode.attribution;
    }

    get attributionUrl() {
        return Service.getService().photonGeocode.attributionUrl;
    }

    get name() {
        return 'Photon';
    }

    get url() {
        return 'https://github.com/Komoot/photon';
    }

    _parseMessage(message) {
        let json = JSON.parse(message);
        let result = [];
        let features = json.features;

        if (!features || features.length === 0) {
            Utils.debug('No features in response');
            return null;
        }

        features.forEach(feature => {
            let place = this._parseFeature(feature);

            if (place)
                result.push(place);
        });

        return result;
    }

    _parseFeature(feature) {
        let [lon, lat] = feature.geometry.coordinates;

        return PhotonParser.parsePlace(lat, lon, feature.properties);
    }

    _buildURL(string, latitude, longitude) {
        let query = new HTTP.Query({ limit: string ? this._limit : 1 });

        if (latitude !== null && longitude != null) {
            query.add('lat', latitude);
            query.add('lon', longitude);
        }

        if (string)
            query.add('q', string);
        else
            query.add('distance_sort', 'true');

        if (this._language)
            query.add('lang', this._language);

        if (this._additionalParams)
            this._additionalParams.forEach((p) => query.add(p.key, p.value));

        return Format.vprintf('%s/%s/?%s', [this._baseUrl,
                                            string ? 'api' : 'reverse',
                                            query.toString()]);
    }

    _readService() {
        let photon = Service.getService().photonGeocode;
        let language = Utils.getLanguage();
        let supportedLanguages;

        if (photon) {
            this._baseUrl = photon.baseUrl;
            supportedLanguages = photon.supportedLanguages;

            if (photon.additionalParams)
                this._additionalParams = photon.additionalParams;
        }

        if (supportedLanguages.includes(language))
            this._language = language;
        else
            this._language = null;
    }
}
