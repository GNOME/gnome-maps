/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
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
 * Author: Rishi Raj Singh Jhelumi <rishiraj.devel@gmail.com>
 */

const Format = imports.format;
const Geocode = imports.gi.GeocodeGlib;
const Soup = imports.gi.Soup;

const Place = imports.place;
const Utils = imports.utils;

const _DEFAULT_TIMEOUT = 180;
const _DEFAULT_MAXSIZE = 536870912;
const _DEFAULT_OUTPUT_FORMAT = 'json';
const _DEFAULT_OUTPUT_COUNT = 1e6;
const _DEFAULT_OUTPUT_INFO = 'body';
const _DEFAULT_OUTPUT_SORT_ORDER = 'qt';

const BASE_URL = 'https://overpass-api.de/api/interpreter';

var Overpass = class Overpass {

    constructor(params) {
        params = params || { };

        // maximum allowed runtime for the query in seconds
        this.timeout = params.timeout || _DEFAULT_TIMEOUT;

        //  maximum allowed memory for the query in bytes RAM on the server
        this.maxsize = params.maxsize || _DEFAULT_MAXSIZE;

        // output format : json or xml
        this.outputFormat = params.outputFormat || _DEFAULT_OUTPUT_FORMAT;

        // maximum number of results the output must contain
        this.outputCount = params.outputCount || _DEFAULT_OUTPUT_COUNT;

        // data output info must contain : ids, skel, body, meta
        this.outputInfo = params.outputInfo || _DEFAULT_OUTPUT_INFO;

        // data sort order : qt(fastest based on geography), ids, asc
        this.outputSortOrder = params.outputSortOrder || _DEFAULT_OUTPUT_SORT_ORDER;

        // HTTP Session Variables
        this._session = new Soup.Session();
    }

    addInfo(place, callback) {
        let url = this._getQueryUrl(place);
        let uri = new Soup.URI(url);
        let request = new Soup.Message({ method: 'GET',
                                         uri: uri });

        this._session.queue_message(request, (obj, message) => {
            if (message.status_code !== Soup.KnownStatusCode.OK) {
                callback(false, message.status_code, null);
                return;
            }
            try {
                let jsonObj = JSON.parse(message.response_body.data);
                this._populatePlace(place, jsonObj);
                callback(true,
                         message.status_code);
            } catch(e) {
                callback(false, message.status_code);
            }
        });
    }

    _populatePlace(place, overpassData) {
        let element = overpassData.elements[0];

        if (!(element && element.tags && element.tags.name))
            return;

        if (element.tags.name)
            place.name = element.tags.name;
        if (element.tags.population)
            place.population = element.tags.population;
        if (element.tags.website)
            place.website = element.tags.website;
        if (element.tags.phone)
            place.phone = element.tags.phone;
        if (element.tags.wikipedia)
            place.wiki = element.tags.wikipedia;
        if (element.tags.wheelchair)
            place.wheelchair = element.tags.wheelchair;
        if (element.tags.opening_hours)
            place.openingHours = element.tags.opening_hours;
        if (element.tags.internet_access)
            place.internetAccess = element.tags.internet_access;
        if (element.tags.ele && place.location)
            place.location.altitude = parseFloat(element.tags.ele);
        if (element.tags.religion)
            place.religion = element.tags.religion
        if (element.tags.toilets)
            place.toilets = element.tags.toilets;
        if (element.tags.note)
            place.note = element.tags.note;
    }

    _getQueryUrl(place) {
        return Format.vprintf('%s?data=%s', [ BASE_URL,
                                              this._generateOverpassQuery(place) ]);
    }

    _generateOverpassQuery(place) {
        return Format.vprintf('%s%s%s;%s;%s;',
                              [ this._getKeyValue('timeout', this.timeout),
                                this._getKeyValue('out', this.outputFormat),
                                this._getKeyValue('maxsize', this.maxsize),
                                this._getData(place),
                                this._getOutput() ]);
    }

    _getKeyValue(key, value) {
        return Format.vprintf('[%s:%s]', [ key,
                                           value ]);
    }

    _getData(place) {
        return Format.vprintf('%s(%s)', [Utils.osmTypeToString(place.osm_type),
                                         place.osm_id]);
    }

    _getOutput() {
        return Format.vprintf('out %s %s %s', [ this.outputInfo,
                                                this.outputSortOrder,
                                                this.outputCount ]);
    }
};
