/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2020 Marcus Lundblad
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

import gettext from 'gettext';

import GLib from 'gi://GLib';

import * as Utils from './utils.js';

const _ = gettext.gettext;

// Matches URLs for OpenStreetMap (for addressing objects or coordinates)
const OSM_URL_REGEX = new RegExp(/https?:\/\/(www\.)?openstreetmap\.org./);

/**
 * For URLs identifiable as pointing to a coordinate
 * e.g. an openstreetmap.org URL with lat and lon query parameters,
 * returns [lat, lon, optional zoom], otherwise [].
 */
export function parseAsCoordinateURL(url) {
    if (url.match(OSM_URL_REGEX)) {
        /* it seems #map= is not handle well by parse_params(), so just remove
         * the # as a work-around
         */
        let uri = GLib.Uri.parse(url.replace('#map=', 'map='), GLib.UriFlags.NONE);
        let query = uri.get_query();
        let path = uri.get_path();
        // allow OSM location URLs encoding the location with or without a ?
        let params = GLib.Uri.parse_params(query ?? path.replace('/', ''), -1,
                                           '&', GLib.UriParamsFlags.NONE);

        let lat = params.lat;
        let lon = params.lon;
        let mlat = params.mlat;
        let mlon = params.mlon;
        let zoom;
        let map = params.map;

        if (map) {
            let parts = map.split('/');

            if (parts.length !== 3) {
                return [];
            } else {
                zoom = parseInt(parts[0]);
                lat = parseFloat(parts[1]);
                lon = parseFloat(parts[2]);
            }
        } else if (mlat && mlon) {
            lat = parseFloat(mlat);
            lon = parseFloat(mlon);

            if (params.zoom)
                zoom = parseInt(params.zoom);
        } else if (lat && lon) {
            lat = parseFloat(lat);
            lon = parseFloat(lon);

            if (params.zoom)
                zoom = parseInt(params.zoom);
        } else {
            return [];
        }

        return [lat, lon, zoom];
    } else {
        return [];
    }
}

/**
 * Extract specified query parameter from a URI using &-delimited parameters.
 * @returns {string}
 */
export function getUriParam(uri, param) {
    const parsed = GLib.Uri.parse(uri, GLib.UriFlags.NONE);
    const query = parsed.get_query();

    return query ?
           GLib.Uri.parse_params(query, -1, '&', GLib.UriParamsFlags.NONE)[param] :
           null;
}

/**
 * For geo: URIs, extracts the `z` parameter from the URI and returns
 * [geoURI, zoom], otherwise [geoURI]. Any parsing errors are propagated
 * for the caller.
 * @returns {[string, number] | [string]}
 */
export function parseAsGeoURI(uri) {
    const parsed = GLib.Uri.parse(uri, GLib.UriFlags.NONE);
    const z = getUriParam(uri, 'z');
    const uriWithoutParams = GLib.Uri.build(GLib.UriFlags.NONE,
                                            parsed.get_scheme(),
                                            parsed.get_userinfo(),
                                            parsed.get_host(),
                                            parsed.get_port(),
                                            parsed.get_path(),
                                            null,
                                            parsed.get_fragment()).to_string().replace(/\//g, '');

    return z ? [uriWithoutParams, parseInt(z)] : [uriWithoutParams];
}

/**
 * For URLs addressing a specific OSM object (node, way, or relation),
 * returns [type,id], otherwise [].
 * @returns {[string, number] | []}
 */
export function parseAsObjectURL(url) {
    if (url.match(OSM_URL_REGEX)) {
        let uri = GLib.Uri.parse(url, GLib.UriFlags.NONE);
        let path = uri.get_path();

        // allow trailing slash in the path
        if (path.endsWith('/'))
            path = path.substring(0, path.length - 1);

        let parts = path.split('/');

        if (parts.length === 3 && parts[0] === '' &&
            (parts[1] === 'node' ||
             parts[1] === 'way' ||
             parts[1] === 'relation')) {
            let id = parseInt(parts[2]);

            if (id > 0)
                return [parts[1], id];
        }
    }

    return [];
}

/**
 * For maps: URIs, return the search query string if a valid URI
 * otherwise null.
 */
export function parseMapsURI(uri) {
    let path = uri.substring('maps:'.length);
    let [param, value] = Utils.splitAtFirst(path, '=');

    if (param === 'q') {
        try {
            return GLib.uri_unescape_string(value, null);
        } catch (error) {
            return null;
        }
    } else {
        return null;
    }
}
