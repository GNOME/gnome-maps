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
import Soup from 'gi://Soup';

import {Application} from './application.js';
import {Place} from './place.js';
import * as Utils from './utils.js';

const _DEFAULT_TIMEOUT = 180;
const _DEFAULT_MAXSIZE = 536870912;
const _DEFAULT_OUTPUT_FORMAT = 'json';
const _DEFAULT_OUTPUT_COUNT = 1000;
const _DEFAULT_OUTPUT_INFO = 'body';
const _DEFAULT_OUTPUT_SORT_ORDER = 'qt';

// default initial search radius to use for POIs when category doesn't specify one
const _DEFAULT_INITIAL_POI_SEARCH_RADIUS = 1000;
// multiplying factor for extended search radius
const _SEARCH_RADIUS_MULTIPLIER = 10;
// max distance to remove duplicate (name and type) POIs
const _POI_DEDUPLICATION_DISTANCE = 200;

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
        let url = this._getQueryUrl(Utils.osmTypeToString(place.osmType),
                                    place.osmId);
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
                let element = jsonObj?.elements?.[0];

                if (element) {
                    place.osmTags = {...place.osmTags, ...element.tags};
                    callback(true);
                } else {
                    Utils.debug('No element in Overpass result');
                    callback(false);
                }
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
                let element = jsonObj?.elements?.[0];

                if (element) {
                    let place = this._createPlace(element, osmType, osmId);

                    callback(place);
                } else {
                    callback(null);
                }
            } catch(e) {
                Utils.debug('Failed to parse Overpass result');
                callback(null);
            }
        });
    }

    searchPois(lat, lon, category, cancellable, callback) {
        let maxResults =  Application.settings.get('max-search-results');
        let initialSearchRadius =
            category.initialSearchRadius ?? _DEFAULT_INITIAL_POI_SEARCH_RADIUS;

        this._internalSearchPois(lat, lon, initialSearchRadius,
                                 category, cancellable, (firstResults) => {
            if (!firstResults) {
                callback(null);
                return;
            }

            this._orderPois(firstResults, lat, lon);

            if (category.deduplicate)
                this._removeNearbyDuplicates(firstResults);

            if (firstResults.length >= maxResults) {
                callback(firstResults.slice(0, maxResults));
            } else {
                // try to widen the search radius to include more results
                if (cancellable.is_cancelled())
                    return;

                this._internalSearchPois(lat, lon,
                                         initialSearchRadius *
                                         _SEARCH_RADIUS_MULTIPLIER,
                                         category, cancellable,
                                         (moreResults) => {
                    if (!moreResults) {
                        /* not able to retrieve more results, go with existing
                         * results
                         */
                        callback(firstResults);
                        return;
                    }

                    this._orderPois(moreResults, lat, lon);

                    // filter out results within the initial radius
                    moreResults =
                        moreResults.filter(p =>
                                           p.dist > initialSearchRadius);

                    let allResults = firstResults.concat(moreResults);

                    if (category.deduplicate)
                        this._removeNearbyDuplicates(allResults);

                    callback(allResults.slice(0, maxResults));
                });
            }
        });
    }

    _removeNearbyDuplicates(results) {
        let i = 0;
        while (i < results.length - 1) {
            let p1 = results[i];
            let p2 = results[i + 1];
            let distance = p1.location.get_distance_from(p2.location) * 1000;

            if (distance < _POI_DEDUPLICATION_DISTANCE && p1.name === p2.name)
                results.splice(i + 1, 1);
            else
                i++;
        }
    }

    _orderPois(pois, lat, lon) {
        // order by distance to the search location
        let origin = new Geocode.Location({ latitude:  lat,
                                            longitude: lon,
                                            accuracy:  0.0 });

        /* pre-compute distance from search origin for each
         * result to avoid repeated distance calculations in
         * when searching the array
         */
        for (let place of pois) {
            place.dist = place.location.get_distance_from(origin) * 1000;
        }

        pois.sort((a, b) => { return a.dist - b.dist });
    }

    _internalSearchPois(lat, lon, radius, category, cancellable, callback) {
        let url = this._getPoiQueryUrl(lat, lon, radius, category);
        let request = Soup.Message.new('GET', url);

        this._session.send_and_read_async(request, GLib.PRIORITY_DEFAULT,
                                          cancellable, (source, res) => {
            if (cancellable.is_cancelled())
                return;

            if (request.get_status() !== Soup.Status.OK) {
                Utils.debug('Failed to fetch Overpass result: ' +
                            request.get_status());
                callback(null);
                return;
            }
            try {
                let buffer = this._session.send_and_read_finish(res).get_data();
                let jsonObj = JSON.parse(Utils.getBufferText(buffer));
                let elements = jsonObj?.elements;

                if (!elements) {
                    callback(null);
                    return;
                }

                let results = [];

                for (let element of elements) {
                    results.push(this._createPlace(element, element.type,
                                                   element.id));
                }

                callback(results);
            } catch (e) {
                Utils.debug('Failed to parse Overpass result');
                callback(null);
            }
        });
    }

    _createPlace(element, osmType, osmId) {
        if (!element.tags)
            return null;

        const [latitude, longitude] = this._getCoordsFromElement(element);

        return new Place({
            location: new Geocode.Location({
                latitude,
                longitude,
                accuracy: 0.0
            }),
            osmType: Utils.osmTypeFromString(osmType),
            osmId: osmId + '',
            osmTags: element.tags,
            prefilled: true
        });
    }

    _getCoordsFromElement(element) {
        if (element.type === 'node')
            return [element.lat, element.lon];
        else
            return [element.center.lat, element.center.lon];
    }

    _getQueryUrl(osmType, osmId) {
        let data = this._getOsmObjectData(osmType, osmId);

        return `${BASE_URL}?data=${this._generateOverpassQuery(data)}`;
    }

    _getPoiQueryUrl(lat, lon, radius, category) {
        let data = this._getPoiData(lat, lon, radius, category);

        return `${BASE_URL}?data=${this._generateOverpassQuery(data)}`;
    }

    _generateOverpassQuery(data) {
        let timeout = this._getKeyValue('timeout', this.timeout);
        let out = this._getKeyValue('out', this.outputFormat);
        let maxSize = this._getKeyValue('maxsize', this.maxsize);
        let output = this._getOutput();

        return `${timeout}${out}${maxSize};${data};${output};`;
    }

    _getKeyValue(key, value) {
        return `[${key}:${value}]`;
    }

    _getOsmObjectData(osmType, osmId) {
        return `${osmType}(${osmId})`;
    }

    _getPoiData(lat, lon, radius, category) {
        let data = '(';

        for (let disjunction of category.keyValues) {
            data += `nwr(around:${radius},${lat},${lon})`;
            for (const kv of disjunction) {
                data += `[${kv}]`;
            }

            data += ';';
        }

        data += ')';
        return data;
    }

    _getOutput() {
        return `out center ${this.outputInfo} ${this.outputSortOrder} ${this.outputCount}`;
    }
}

