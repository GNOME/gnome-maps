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

const _ = imports.gettext.gettext;

const GLib = imports.gi.GLib;
const Soup = imports.gi.Soup;

const Utils = imports.utils;

// Matches URLs for OpenStreetMap (for addressing objects or coordinates)
const OSM_URL_REGEX = new RegExp(/https?:\/\/(www\.)?openstreetmap\.org./);

/**
 * For URLs identifiable as pointing to a coordinate
 * e.g. an openstreetmap.org URL with lat and lon query parameters,
 * returns [lat, lon, optional zoom], otherwise [].
 */
function parseAsCoordinateURL(url) {
    if (url.match(OSM_URL_REGEX)) {
        /* it seems #map= is not handle well by parse_params(), so just remove
         * the # as a work-around
         */
        let uri = GLib.Uri.parse(url.replace('#map=', 'map='), GLib.UriFlags.NONE);
        let params = GLib.Uri.parse_params(uri.get_query(), -1, '&',
                                           GLib.UriParamsFlags.NONE);

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
 * For URLs addressing a specific OSM object (node, way, or relation),
 * returns [type,id], otherwise [].
 */
function parseAsObjectURL(url) {
    if (url.match(OSM_URL_REGEX)) {
        let uri = GLib.Uri.parse(url, GLib.UriFlags.NONE);
        let path = uri.get_path();
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
function parseMapsURI(uri) {
    let path = uri.substring('maps:'.length);
    let [param, value] = Utils.splitAtFirst(path, '=');

    if (param === 'q') {
        try {
            return Soup.uri_decode(value);
        } catch (error) {
            return null;
        }
    } else {
        return null;
    }
}
