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

import Geocode from 'gi://GeocodeGlib';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Soup from 'gi://Soup';

import * as OSMNames from './osmNames.js';
import * as PhotonUtils from './photonUtils.js';
import {Place} from './place.js';
import * as Utils from './utils.js';

const _DEFAULT_TIMEOUT = 180;
const _DEFAULT_MAXSIZE = 536870912;
const _DEFAULT_OUTPUT_FORMAT = 'json';
const _DEFAULT_OUTPUT_COUNT = 1e6;
const _DEFAULT_OUTPUT_INFO = 'body';
const _DEFAULT_OUTPUT_SORT_ORDER = 'qt';

const BASE_URL = 'https://overpass-api.de/api/interpreter';

export class Overpass {

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
        this._session = new Soup.Session({ user_agent : 'gnome-maps/' + pkg.version });
    }

    populatePlace(place, callback) {
        let url = this._getQueryUrl(Utils.osmTypeToString(place.osm_type),
                                    place.osm_id);
        let request = Soup.Message.new('GET', url);

        this._session.send_and_read_async(request, GLib.PRIORITY_DEFAULT, null,
                                          (source, res) => {
            if (request.get_status() !== Soup.Status.OK) {
                Utils.debug('Failed to fetch Overpass result: ' +
                            request.get_status());
                callback(false);
                return;
            }
            try {
                let buffer = this._session.send_and_read_finish(res).get_data();
                let jsonObj = JSON.parse(Utils.getBufferText(buffer));
                this._populatePlace(place, jsonObj);
                callback(true);
            } catch(e) {
                Utils.debug('Failed to parse Overpass result');
                callback(false);
            }
        });
    }

    fetchPlace(osmType, osmId, callback) {
        let url = this._getQueryUrl(osmType, osmId)
        let request = Soup.Message.new('GET', url);

        this._session.send_and_read_async(request, GLib.PRIORITY_DEFAULT, null,
                                          (source, res) => {
            if (request.get_status() !== Soup.Status.OK) {
                Utils.debug('Failed to fetch Overpass result: ' +
                            request.get_status());
                callback(null);
                return;
            }
            try {
                let buffer = this._session.send_and_read_finish(res).get_data();
                let jsonObj = JSON.parse(Utils.getBufferText(buffer));
                let place = this._createPlace(jsonObj, osmType, osmId);
                callback(place);
            } catch(e) {
                Utils.debug('Failed to parse Overpass result');
                callback(null);
            }
        })
    }

    _createPlace(overpassData, osmType, osmId) {
        let element = overpassData.elements[0];

        if (!(element && element.tags))
            return null;

        let [lat, lon] = this._getCoordsFromElement(element);
        let photonProperties =
            this._getPhotonProperties(element.tags, osmType, osmId);
        let place = PhotonUtils.parsePlace(lat, lon, photonProperties);

        this._populatePlace(place, overpassData);
        place.prefilled = true;

        return place;
    }

    _getCoordsFromElement(element) {
        if (element.type === 'node')
            return [element.lat, element.lon];
        else
            return [element.center.lat, element.center.lon];
    }

    _getPhotonProperties(tags, osmType, osmId) {
        let properties = {};

        properties.osm_type = this._getPhotonOsmType(osmType);
        properties.osm_id = osmId;

        if (tags.name)
            properties.name = tags.name;

        if (tags['addr:street'])
            properties.street = tags['addr:street'];
        if (tags['addr:housenumber'])
            properties.housenumber = tags['addr:housenumber'];
        if (tags['addr:postcode'])
            properties.postcode = tags['addr:postcode'];
        if (tags['addr:city'])
            properties.city = tags['addr:city'];
        if (tags['addr:country'])
            properties.countrycode = tags['addr:country'];

        if (tags.place)
            this._setOsmKeyAndValue(properties, tags, 'place');
        else if (tags.amenity)
            this._setOsmKeyAndValue(properties, tags, 'amenity');
        else if (tags.leisure)
            this._setOsmKeyAndValue(properties, tags, 'leisure');
        else if (tags.shop)
            this._setOsmKeyAndValue(properties, tags, 'shop');
        else if (tags.highway)
            this._setOsmKeyAndValue(properties, tags, 'highway');
        else if (tags.railway)
            this._setOsmKeyAndValue(properties, tags, 'railway');
        else if (tags.aeroway)
            this._setOsmKeyAndValue(properties, tags, 'aeroway');
        else if (tags.building)
            this._setOsmKeyAndValue(properties, tags, 'building');

        return properties;
    }

    _getPhotonOsmType(osmType) {
        switch (osmType) {
            case 'node': return 'N';
            case 'way': return 'W';
            case 'relation': return 'R';
            default: return null;
        }
    }

    _setOsmKeyAndValue(properties, tags, tag) {
        properties.osm_key = tag;
        properties.osm_value = tags[tag];
    }

    _populatePlace(place, overpassData) {
        let element = overpassData.elements[0];

        if (!(element && element.tags))
            return;

        let name = this._getLocalizedName(element.tags, place);
        if (name)
            place.name = name;

        if (element.tags.name)
            place.nativeName = element.tags.name;

        place.updateFromTags(element.tags);
    }

    _getLocalizedName(tags, place) {
        let language = Utils.getLanguage();

        return OSMNames.getNameForLanguageAndCountry(tags, language,
                                                     place.country_code);
    }

    _getQueryUrl(osmType, osmId) {
        return `${BASE_URL}?data=${this._generateOverpassQuery(osmType, osmId)}`;
    }

    _generateOverpassQuery(osmType, osmId) {
        let timeout = this._getKeyValue('timeout', this.timeout);
        let out = this._getKeyValue('out', this.outputFormat);
        let maxSize = this._getKeyValue('maxsize', this.maxsize);
        let data = this._getData(osmType, osmId);
        let output = this._getOutput();

        return `${timeout}${out}${maxSize};${data};${output};`;
    }

    _getKeyValue(key, value) {
        return `[${key}:${value}]`;
    }

    _getData(osmType, osmId) {
        return `${osmType}(${osmId})`;
    }

    _getOutput() {
        return `out center ${this.outputInfo} ${this.outputSortOrder} ${this.outputCount}`;
    }
}

