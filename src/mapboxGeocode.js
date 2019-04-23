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

const Utils = imports.utils;

const _BASE_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const _API_KEY = 'pk.eyJ1IjoiZ25vbWUtbWFwcyIsImEiOiJjaXF3a3lwbXkwMDJwaTBubmZlaGk4cDZ6In0.8aukTfgjzeqATA8eNItPJA&';

var MapboxGeocode = class {
    constructor() {
        this._session = new Soup.Session({ user_agent : 'gnome-maps/' + pkg.version });
    }

    search(string, latitude, longitude) {
        Utils.debug('mapbox search: ' + string);
        let url = this._buildURL(string, latitude, longitude);
        let msg = Soup.Message.new('GET', url);
        Utils.debug('URL: ' + url);
        this._session.queue_message(msg, (session, message) => {
            try {
                Utils.debug('message: ' + message.response_body.data);
                /*
                let result = this._parseMessage(message);
                if (!result)
                    callback(null, null);
                else
                    callback(result, null);
                */
            } catch (e) {
                callback(null, e);
            }
        });
    }

    _buildURL(string, latitude, longitude) {
        return Format.vprintf('%s/%s.json?access_token=%s?proximity=%s,%s',
                              [ _BASE_URL,
                                GLib.uri_escape_string(string, null, false),
                                _API_KEY,
                                longitude, latitude]);
    }
}
