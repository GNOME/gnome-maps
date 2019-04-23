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

var PhotonGeocode = class {
    constructor() {
        this._session = new Soup.Session({ user_agent : 'gnome-maps/' + pkg.version });
        this._readService();
        this._limit = Application.settings.get('max-search-results');
    }

    search(string, latitude, longitude, cancellable, callback) {
        let url = this._buildURL(string, latitude, longitude);
        let msg = Soup.Message.new('GET', url);
        Utils.debug('URL: ' + url);

        let handler = cancellable.connect(() => {
            this._session.cancel_message(msg, Soup.Status.CANCELLED);
        });

        this._session.queue_message(msg, (session, message) => {
            cancellable.disconnect(handler);

            if (cancellable.is_cancelled())
                return;

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

    reverse(latitude, longitude, callback) {
        let url = this._buildURL(null, latitude, longitude);
        let msg = Soup.Message.new('GET', url);
        Utils.debug('URL: ' + url);

        Application.application.mark_busy();
        this._session.queue_message(msg, (session, message) => {
            Application.application.unmark_busy();
            try {
                Utils.debug('message: ' + message.response_body.data);
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

    _parseMessage(message) {
        let json = JSON.parse(message);
        let result = [];
        let features = json.features;

        if (!features || features.length === 0) {
            Utils.debug('No features in response');
            return null;
        }

        Utils.debug('number of results: ' + features.length);

        features.forEach(feature => {
            let place = this._parseFeature(feature);

            if (place)
                result.push(place);
        });

        Utils.debug('results: ' + result.length);

        return result;
    }

    _parseFeature(feature) {
        Utils.debug('_parseFeature');
        Utils.debug('feature: ' + JSON.stringify(feature, null, 2));
        let [lon, lat] = feature.geometry.coordinates;

        return PhotonParser.parsePlace(lat, lon, feature.properties);
    }

    _buildURL(string, latitude, longitude) {
        let query = new HTTP.Query({ lat:     latitude,
                                     lon:     longitude,
                                     limit:   string ? this._limit : 1
                                   });

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
        let locale = GLib.get_language_names()[0];
        // the last item returned is the "bare" language
        let language = GLib.get_locale_variants(locale).slice(-1)[0];
        let supportedLanguages;

        if (photon) {
            this._baseUrl = photon.baseUrl;
            supportedLanguages = photon.supportedLanguages;

            if (photon.additionalParams)
                this._additionalParams = photon.additionalParams;
        }

        Utils.debug('current language: ' + language);

        if (supportedLanguages.includes(language))
            this._language = language;
        else
            this._language = null;
    }
}
