/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2013 Mattias Bengtsson.
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
 * Author: Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>
 */

const Champlain = imports.gi.Champlain;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Soup = imports.gi.Soup;

const Application = imports.application;
const EPAF = imports.epaf;
const HTTP = imports.http;
const Route = imports.route;
const RouteQuery = imports.routeQuery;
const Utils = imports.utils;

var GraphHopper = new Lang.Class({
    Name: 'GraphHopper',

    get route() {
        return this._route;
    },

    _init: function(params) {
        this._session = new Soup.Session({ user_agent : 'gnome-maps/' + pkg.version });
        this._key     = "VCIHrHj0pDKb8INLpT4s5hVadNmJ1Q3vi0J4nJYP";
        this._baseURL = "https://graphhopper.com/api/1/route?";
        this._locale  = GLib.get_language_names()[0];
        this._route   = new Route.Route();
        this.storedRoute = null;
        this._query = params.query;
        delete params.query;
        this.parent(params);
    },

    _updateFromStored: function() {
        Mainloop.idle_add(() => {
            if (!this.storedRoute)
                return;

            this.route.update({ path: this.storedRoute.path,
                                turnPoints: this.storedRoute.turnPoints,
                                distance: this.storedRoute.distance,
                                time: this.storedRoute.time,
                                bbox: this.storedRoute.bbox });
            this.storedRoute = null;
        });
    },

    _queryGraphHopper: function(points, transportationType, callback) {
        let url = this._buildURL(points, transportationType);
        let msg = Soup.Message.new('GET', url);
        this._session.queue_message(msg, (session, message) => {
            try {
                let result = this._parseMessage(message);
                if (!result)
                    callback(null, null);
                else
                    callback(result, null);
            } catch (e) {
                callback(null, e);
            }
        });
    },

    fetchRoute: function(points, transportationType) {
        if (this.storedRoute) {
            this._updateFromStored();
            return;
        }

        this._queryGraphHopper(points, transportationType,
                               (result, exception) => {
            if (exception) {
                Application.notificationManager.showMessage(_("Route request failed."));
                Utils.debug(e);
                if (this._query.latest)
                    this._query.latest.place = null;
                else
                    this.route.reset();
            } else {
                if (!result) {
                    Application.notificationManager.showMessage(_("No route found."));
                    if (this._query.latest)
                        this._query.latest.place = null;
                    else
                        this.route.reset();
                } else {
                    let route = this._createRoute(result.paths[0]);
                    this.route.update(route);
                }
            }
        });
    },

    fetchRouteAsync: function(points, transportationType, callback) {
        this._queryGraphHopper(points, transportationType,
                               (result, exception) => {
            if (result) {
                let route = this._createRoute(result.paths[0]);
                callback(route, exception);
            } else {
                callback(null, exception);
            }
        });
    },

    _buildURL: function(points, transportation) {
        let locations = points.map(function(point) {
            return [point.place.location.latitude, point.place.location.longitude].join(',');
        });
        let vehicle = RouteQuery.Transportation.toString(transportation);
        let query = new HTTP.Query({ type:    'json',
                                     key:     this._key,
                                     vehicle: vehicle,
                                     locale:  this._locale,
                                     point:   locations,
                                     debug:   Utils.debugEnabled
                                   });
        let url = this._baseURL + query.toString();
        Utils.debug("Sending route request to: " + url);
        return url;
    },

    _parseMessage: function({ status_code, response_body, uri }) {
        if (status_code === 500) {
            log("Internal server error.\n"
                + "This is most likely a bug in GraphHopper");
            log("Please file a bug at "
                + "https://github.com/graphhopper/graphhopper/issues\n"
                + "with the the following Graphopper request URL included:\n");
            log(uri.to_string(false));
        }
        if (status_code !== 200)
            return null;

        let result = JSON.parse(response_body.data);

        if (!Array.isArray(result.paths)) {
            Utils.debug("No route found");
            if (result.info && Array.isArray(result.info.errors)) {
                result.info.errors.forEach(({ message, details }) => {
                    Utils.debug("Message: " + message);
                    Utils.debug("Details: " + details);
                });
            }
            return null;
        }

        return result;
    },

    _createRoute: function(route) {
        let path       = EPAF.decode(route.points);
        let turnPoints = this._createTurnPoints(path, route.instructions);
        let bbox       = new Champlain.BoundingBox();

        // GH does lonlat-order and Champlain latlon-order
        bbox.extend(route.bbox[1], route.bbox[0]);
        bbox.extend(route.bbox[3], route.bbox[2]);

        return { path:       path,
                 turnPoints: turnPoints,
                 distance:   route.distance,
                 time:       route.time,
                 bbox:       bbox };
    },

    _createTurnPoints: function(path, instructions) {
        let via = 0;
        let startPoint = new Route.TurnPoint({
            coordinate:  path[0],
            type:        Route.TurnPointType.START,
            distance:    0,
            instruction: _("Start!"),
            time:        0,
            turnAngle:   0
        });
        let rest = instructions.map((instr) => {
            let type = this._createTurnPointType(instr.sign);
            let text = instr.text;
            if (type === Route.TurnPointType.VIA) {
                via++;
                let viaPlace = this._query.filledPoints[via].place;
                text = viaPlace.name || instr.text;
            }
            return new Route.TurnPoint({
                coordinate:  path[instr.interval[0]],
                type:        type,
                distance:    instr.distance,
                instruction: text,
                time:        instr.time,
                turnAngle:   instr.turn_angle
            });
        });
        return [startPoint].concat(rest);
    },

    _createTurnPointType: function(sign) {
        let type = sign + 3;
        let min  = Route.TurnPointType.SHARP_LEFT;
        let max  = Route.TurnPointType.ROUNDABOUT;
        if (min <= type && type <= max)
            return type;
        else
            return undefined;
    }
});
