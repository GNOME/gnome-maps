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
 * with GNOME Maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Rishi Raj Singh Jhelumi <rishiraj.devel@gmail.com>
 */

const Format = imports.format;
const Geocode = imports.gi.GeocodeGlib;
const Lang = imports.lang;
const Soup = imports.gi.Soup;

const Place = imports.place;

const _DEFAULT_TIMEOUT = 180;
const _DEFAULT_MAXSIZE = 536870912;
const _DEFAULT_OUTPUT_FORMAT = 'json';
const _DEFAULT_OUTPUT_COUNT = 1e6;
const _DEFAULT_OUTPUT_INFO = 'body';
const _DEFAULT_OUTPUT_SORT_ORDER = 'qt';

const BASE_URL = 'http://overpass-api.de/api/interpreter';

const Overpass = new Lang.Class({
    Name: 'Overpass',

    _init: function(params) {
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
    },

    addInfo: function(place, callback) {
        let url = this._getQueryUrl(place);
        let uri = new Soup.URI(url);
        let request = new Soup.Message({ method: 'GET',
                                         uri: uri });

        this._session.queue_message(request, (function(obj, message) {
            if (message.status_code !== Soup.KnownStatusCode.OK) {
                callback(false, message.status_code, null);
                return;
            }
            try {
                let jsonObj = JSON.parse(message.response_body.data);
                callback(true,
                         message.status_code,
                         this._createPlace(place, jsonObj));
            } catch(e) {
                callback(false, message.status_code, null);
            }
        }).bind(this));
    },

    _createPlace: function(place, overpassData) {
        let element = overpassData.elements[0];
        let newPlace = new Place.Place({ place: place });

        if (!(element && element.tags && element.tags.name))
            return newPlace;

        if (element.tags.name)
            newPlace.name = element.tags.name;
        if (element.tags.population)
            newPlace.population = element.tags.population;
        if (element.tags.wikipedia)
            newPlace.wiki = element.tags.wikipedia;
        if (element.tags.wheelchair)
            newPlace.wheelchair = element.tags.wheelchair;
        if (element.tags.opening_hours)
            newPlace.openingHours = element.tags.opening_hours;

        return newPlace;
    },

    _getQueryUrl: function(place) {
        return Format.vprintf('%s?data=%s', [ BASE_URL,
                                              this._generateOverpassQuery(place) ]);
    },

    _generateOverpassQuery: function(place) {
        return Format.vprintf('%s%s%s;%s;%s;',
                              [ this._getKeyValue('timeout', this.timeout),
                                this._getKeyValue('out', this.outputFormat),
                                this._getKeyValue('maxsize', this.maxsize),
                                this._getData(place),
                                this._getOutput() ]);
    },

    _getKeyValue: function(key, value) {
        return Format.vprintf('[%s:%s]', [ key,
                                           value ]);
    },

    _osmTypeString: function(osmType) {
        switch(osmType) {
            case Geocode.PlaceOsmType.NODE: return 'node';
            case Geocode.PlaceOsmType.RELATION: return 'relation';
            case Geocode.PlaceOsmType.WAY: return 'way';
            default: return 'node';
        }
    },

    _getData: function(place) {
        return Format.vprintf('%s(%s)', [this._osmTypeString(place.osm_type),
                                         place.osm_id]);
    },

    _getOutput: function() {
        return Format.vprintf('out %s %s %s', [ this.outputInfo,
                                                this.outputSortOrder,
                                                this.outputCount ]);
    }
});
