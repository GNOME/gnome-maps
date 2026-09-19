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

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

import {BoundingBox} from './boundingBox.js';
import * as EPAF from './epaf.js';
import {Query} from './http.js';
import {TurnPoint, Route} from './route.js';
import {RouteQuery} from './routeQuery.js';
import * as Utils from './utils.js';

/**
 * Directional sign from the GraphHopper API.
 * https://github.com/graphhopper/graphhopper/blob/master/docs/web/api-doc.md
 */
const Sign = {
    UTURN: -98,
    UTURN_LEFT: -8,
    KEEP_LEFT: -7,
    LEAVE_ROUNDABOUT: -6, // not currently used
    TURN_SHARP_LEFT: -3,
    TURN_LEFT: -2,
    TURN_SLIGHT_LEFT: -1,
    CONTINUE_ON_STREET: 0,
    TURN_SLIGHT_RIGHT: 1,
    TURN_RIGHT: 2,
    TURN_SHARP_RIGHT: 3,
    FINISH: 4,
    REACHED_VIA: 5,
    USE_ROUNDABOUT: 6,
    KEEP_RIGHT: 7,
    UTURN_RIGHT: 8
}

export const KEY = 'VCIHrHj0pDKb8INLpT4s5hVadNmJ1Q3vi0J4nJYP';

export class GraphHopper {

    get route() {
        return this._route;
    }

    constructor({query, route}) {
        this._requestCancellable = null;
        this._session = new Soup.Session({ user_agent : 'gnome-maps/' + pkg.version });
        this._baseURL = "https://graphhopper.com/api/1/route?";
        this._locale  = GLib.get_language_names()[0];
        this._route   = route;
        this._query = query;
    }

    cancelCurrentRequest() {
        if (this._requestCancellable) {
            this._requestCancellable.cancel();
            this._requestCancellable = null;
        }
    }

    _queryGraphHopper(points, transportationType, callback) {
        let url = this._buildURL(points, transportationType);
        let msg = Soup.Message.new('GET', url);

        this._requestCancellable = new Gio.Cancellable();

        this._session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, this._requestCancellable,
                                          (source,res) => {
            let bytes = this._session.send_and_read_finish(res);
            let body = bytes ? Utils.getBufferText(bytes.get_data()) : null;

            try {
                let result = this._parseMessage({ status_code:   msg.get_status(),
                                                  response_body: body,
                                                  uri:           url });
                if (!result)
                    callback(null, null);
                else
                    callback(result, null);
            } catch (e) {
                if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                    callback(null, e);
                }
            }
        });
    }

    fetchRoute(points, transportationType) {
        this._queryGraphHopper(points, transportationType,
                               (result, exception) => {
            if (exception) {
                Utils.debug(exception);
                if (this._query.latest)
                    this._query.latest.place = null;
                else
                    this.route.reset();
                this.route.error(_("Route request failed."));
            } else {
                if (!result) {
                    if (this._query.latest)
                        this._query.latest.place = null;
                    else
                        this.route.reset();
                    this.route.error(_("No route found."));
                } else {
                    let route = this._createRoute(result.paths[0]);
                    this.route.update(route);
                }
            }
        });
    }

    fetchRouteAsync(points, transportationType, callback) {
        this._queryGraphHopper(points, transportationType,
                               (result, exception) => {
            if (result) {
                let route = this._createRoute(result.paths[0]);
                callback(route, exception);
            } else {
                callback(null, exception);
            }
        });
    }

    _buildURL(points, transportation) {
        let locations = points.map(function(point) {
            return [point.place.location.latitude, point.place.location.longitude].join(',');
        });
        let vehicle = RouteQuery.Transportation.toString(transportation);
        let query = new Query({ type:    'json',
                                key:     KEY,
                                vehicle: vehicle,
                                locale:  this._locale,
                                point:   locations,
                                debug:   Utils.debugEnabled });
        let url = this._baseURL + query.toString();
        Utils.debug("Sending route request to: " + url);
        return url;
    }

    _parseMessage({ status_code, response_body, uri }) {
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

        let result = JSON.parse(response_body);

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
    }

    _createRoute(route) {
        let path       = EPAF.decode(route.points);
        let turnPoints = this._createTurnPoints(path, route.instructions);
        let bbox       = new BoundingBox();

        // GH does lonlat-order
        bbox.extend(route.bbox[1], route.bbox[0]);
        bbox.extend(route.bbox[3], route.bbox[2]);

        return { path:       path,
                 turnPoints: turnPoints,
                 distance:   route.distance,
                 time:       route.time,
                 bbox:       bbox };
    }

    _createTurnPoints(path, instructions) {
        let via = 0;
        let startPoint = new TurnPoint({
            coordinate:  path[0],
            type:        TurnPoint.Type.START,
            distance:    0,
            instruction: _("Start!"),
            time:        0,
            turnAngle:   0
        });
        let rest = this._foldInstructions(instructions).map((instr) => {
            let type = this._createTurnPointType(instr.sign);
            let text = instr.text;
            if (type === TurnPoint.Type.VIA) {
                via++;
                let viaPlace = this._query.filledPoints[via].place;
                text = viaPlace.name || instr.text;
            }
            return new TurnPoint({
                coordinate:  path[instr.interval[0]],
                type:        type,
                distance:    instr.distance,
                instruction: text,
                time:        instr.time,
                turnAngle:   instr.turn_angle
            });
        });
        return [startPoint].concat(rest);
    }

    _foldInstructions(instructions) {
        let currInstruction = instructions[0];
        let res = [];

        for (let i = 1; i < instructions.length; i++) {
            let newInstruction = instructions[i];
            let newSign = newInstruction.sign;

            /* if the direction is to continue straight,
             * fold the instruction into the previous one
             */
            if (newSign === Sign.CONTINUE_ON_STREET) {
                currInstruction.distance += newInstruction.distance;
            } else {
                res.push(currInstruction);
                currInstruction = instructions[i];
            }
        }

        // push finish instruction
        res.push(instructions[instructions.length - 1]);

        return res;
    }

    _createTurnPointType(sign) {
        switch (sign) {
            case Sign.UTURN:              return TurnPoint.Type.UTURN;
            case Sign.UTURN_LEFT:         return TurnPoint.Type.UTURN_LEFT;
            case Sign.KEEP_LEFT:          return TurnPoint.Type.KEEP_LEFT;
            case Sign.LEAVE_ROUNDABOUT:   return TurnPoint.Type.LEAVE_ROUNDABOUT;
            case Sign.TURN_SHARP_LEFT:    return TurnPoint.Type.SHARP_LEFT;
            case Sign.TURN_LEFT:          return TurnPoint.Type.LEFT;
            case Sign.TURN_SLIGHT_LEFT:   return TurnPoint.Type.SLIGHT_LEFT;
            case Sign.CONTINUE_ON_STREET: return TurnPoint.Type.CONTINUE;
            case Sign.TURN_SLIGHT_RIGHT:  return TurnPoint.Type.SLIGHT_RIGHT;
            case Sign.TURN_RIGHT:         return TurnPoint.Type.RIGHT;
            case Sign.TURN_SHARP_RIGHT:   return TurnPoint.Type.SHARP_RIGHT;
            case Sign.FINISH:             return TurnPoint.Type.END;
            case Sign.REACHED_VIA:        return TurnPoint.Type.VIA;
            case Sign.USE_ROUNDABOUT:     return TurnPoint.Type.ROUNDABOUT;
            case Sign.KEEP_RIGHT:         return TurnPoint.Type.KEEP_RIGHT;
            case Sign.UTURN_RIGHT:        return TurnPoint.Type.UTURN_RIGHT;
            default: return undefined;
        }
    }
}
