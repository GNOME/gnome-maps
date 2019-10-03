/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2019 Marcus Lundblad
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

/**
 * This module implements a transit routing plugin for the Swedish national
 * Resrobot transit journey planning API.
 *
 * API docs for Resrobot can be found at:
 * https://www.trafiklab.se/api/resrobot-reseplanerare/dokumentation/sokresa
 */

const Soup = imports.gi.Soup;

const Application = imports.application;
const HTTP = imports.http;
const Utils = imports.utils;

const BASE_URL = 'https://api.resrobot.se';
const API_VERSION = 'v2';

var Resrobot = class Resrobot {
    constructor(params) {
        this._session = new Soup.Session();
        this._plan = Application.routingDelegator.transitRouter.plan;
        this._query = Application.routeQuery;
        this._key = params.key;

        if (!this._key)
            throw new Error('missing key');
    }

    fetchFirstResults() {
        let query = new HTTP.Query(this._getQueryParams());
        let uri = new Soup.URI(BASE_URL + '/' + API_VERSION + '/trip?' +
                               query.toString());
        let request = new Soup.Message({ method: 'GET', uri: uri });

        Utils.debug('uri: ' + uri.to_string(false));

        request.request_headers.append('Accept', 'application/json');
        this._session.queue_message(request, (obj, message) => {
            if (message.status_code !== Soup.Status.OK) {
                Utils.debug('Failed to get trip');
                //callback(null);
            } else {
                try {
                    let result = JSON.parse(message.response_body.data);

                    Utils.debug('result: ' + JSON.stringify(result, null, 2));

                    //callback(result);
                } catch (e) {
                    Utils.debug('Error parsing result: ' + e);
                    //callback(null);
                }
            }
        });
    }

    _getQueryParams() {
        let points = this._query.filledPoints;
        let originLocation = points[0].place.location;
        let destLocation = points.last().place.location;
        let params = { key:             this._key,
                       originCoordLat:  originLocation.latitude,
                       originCoordLong: originLocation.longitude,
                       destCoordLat:    destLocation.latitude,
                       destCoordLong:   destLocation.longitude,
                       format:          'json' };

        return params;
    }
}
