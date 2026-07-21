/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2026 Jan-Michael Brummer
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
 * Author: Jan-Michael Brummer <jan-michael.brummer@tabos.org>
 */

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

import {BoundingBox} from './boundingBox.js';
import * as EPAF from './epaf.js';
import {TurnPoint} from './route.js';
import {RouteQuery} from './routeQuery.js';
import * as Utils from './utils.js';

const SHAPE_PRECISION = 6;

const Maneuver = {
    NONE:                       0,
    START:                      1,
    START_RIGHT:                2,
    START_LEFT:                 3,
    DESTINATION:                4,
    DESTINATION_RIGHT:          5,
    DESTINATION_LEFT:           6,
    BECOMES:                    7,
    CONTINUE:                   8,
    SLIGHT_RIGHT:               9,
    RIGHT:                      10,
    SHARP_RIGHT:                11,
    UTURN_RIGHT:                12,
    UTURN_LEFT:                 13,
    SHARP_LEFT:                 14,
    LEFT:                       15,
    SLIGHT_LEFT:                16,
    RAMP_STRAIGHT:              17,
    RAMP_RIGHT:                 18,
    RAMP_LEFT:                  19,
    EXIT_RIGHT:                 20,
    EXIT_LEFT:                  21,
    STAY_STRAIGHT:              22,
    STAY_RIGHT:                 23,
    STAY_LEFT:                  24,
    MERGE:                      25,
    ROUNDABOUT_ENTER:           26,
    ROUNDABOUT_EXIT:            27,
    FERRY_ENTER:                28,
    FERRY_EXIT:                 29,
    MERGE_RIGHT:                37,
    MERGE_LEFT:                 38,
    ELEVATOR_ENTER:             39,
    STEPS_ENTER:                40,
    ESCALATOR_ENTER:            41,
    BUILDING_ENTER:             42,
    BUILDING_EXIT:              43
};

export class Valhalla {

    get route() {
        return this._route;
    }

    constructor({query, route, ...params}) {
        this._requestCancellable = null;
        this._session =
            new Soup.Session({ user_agent: 'gnome-maps/' + pkg.version });
        this._baseURL = 'https://valhalla1.openstreetmap.de';
        this._language = this._getLanguage();
        this._route = route;
        this._query = query;
    }

    cancelCurrentRequest() {
        if (this._requestCancellable) {
            this._requestCancellable.cancel();
            this._requestCancellable = null;
        }
    }

    _getLanguage() {
        const locale = GLib.get_language_names()[0] ?? 'en_US';
        return locale.split('.')[0].split('@')[0].replace('_', '-');
    }

    _getCosting(transportationType) {
        switch (transportationType) {
            case RouteQuery.Transportation.CAR:        return 'auto';
            case RouteQuery.Transportation.BIKE:       return 'bicycle';
            case RouteQuery.Transportation.PEDESTRIAN: return 'pedestrian';
            default:                                   return null;
        }
    }

    _buildRequest(points, transportationType) {
        const locations = points.map((point) => {
            return { lat:  point.place.location.latitude,
                     lon:  point.place.location.longitude,
                     type: 'break' };
        });

        return { locations:       locations,
                 costing:         this._getCosting(transportationType),
                 units:           'kilometers',
                 language:        this._language,
                 directions_type: 'instructions' };
    }

    _queryValhalla(points, transportationType, callback) {
        const body = this._buildRequest(points, transportationType);
        const url = this._baseURL + '/route';
        const msg = Soup.Message.new('POST', url);

        msg.set_request_body_from_bytes('application/json',
                                        new GLib.Bytes(new TextEncoder().encode(JSON.stringify(body))));

        this._requestCancellable = new Gio.Cancellable();

        const cancellable = this._requestCancellable;

        this._session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT,
                                          cancellable,
                                          (source, res) => {
            if (this._requestCancellable === cancellable)
                this._requestCancellable = null;

            try {
                const bytes = this._session.send_and_read_finish(res);
                const responseBody =
                    bytes ? Utils.getBufferText(bytes.get_data()) : null;
                const result =
                    this._parseMessage({ status_code:   msg.get_status(),
                                         response_body: responseBody });

                callback(result, null);
            } catch (e) {
                if (!e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                    callback(null, e);
            }
        });
    }

    fetchRoute(points, transportationType) {
        this._queryValhalla(points, transportationType,
                            (result, exception) => {
            if (exception) {
                Utils.debug(exception);
                if (this._query.latest)
                    this._query.latest.place = null;
                else
                    this.route.reset();
                this.route.error(_("Route request failed."));
            } else if (!result) {
                if (this._query.latest)
                    this._query.latest.place = null;
                else
                    this.route.reset();
                this.route.error(_("No route found."));
            } else {
                this.route.update(this._createRoute(result.trip));
            }
        });
    }

    fetchRouteAsync(points, transportationType, callback) {
        this._queryValhalla(points, transportationType,
                            (result, exception) => {
            if (result)
                callback(this._createRoute(result.trip), exception);
            else
                callback(null, exception);
        });
    }

    _parseMessage({ status_code, response_body }) {
        if (status_code === Soup.Status.BAD_REQUEST && response_body) {
            try {
                const error = JSON.parse(response_body);

                Utils.debug('Valhalla error ' + error.error_code + ': ' +
                            error.error);
            } catch (e) {
                Utils.debug('Failed to parse error response');
            }
            return null;
        }

        if (status_code !== Soup.Status.OK) {
            Utils.debug('Valhalla request failed with status: ' + status_code);
            return null;
        }

        const result = JSON.parse(response_body);

        if (!result.trip || !Array.isArray(result.trip.legs) ||
            result.trip.legs.length === 0) {
            Utils.debug('No route found');
            return null;
        }

        return result;
    }

    _createRoute(trip) {
        const path = [];
        const turnPoints = [];
        const bbox = new BoundingBox();
        let via = 0;

        trip.legs.forEach((leg, legIndex) => {
            const isLastLeg = legIndex === trip.legs.length - 1;
            const legPath = EPAF.decode(leg.shape, SHAPE_PRECISION);

            path.push(...(legIndex === 0 ? legPath : legPath.slice(1)));

            leg.maneuvers.forEach((maneuver) => {
                const isDestination = this._isDestination(maneuver.type);

                if (isDestination && !isLastLeg) {
                    via++;
                    const viaPlace = this._query.filledPoints[via]?.place;

                    turnPoints.push(this._createTurnPoint(maneuver,
                                                          legPath,
                                                          TurnPoint.Type.VIA,
                                                          viaPlace?.name));
                } else {
                    turnPoints.push(this._createTurnPoint(maneuver,
                                                          legPath));
                }
            });

            bbox.extend(leg.summary.min_lat, leg.summary.min_lon);
            bbox.extend(leg.summary.max_lat, leg.summary.max_lon);
        });

        return { path:       path,
                 turnPoints: turnPoints,
                 distance:   trip.summary.length * 1000,
                 time:       trip.summary.time * 1000,
                 bbox:       bbox };
    }

    _createTurnPoint(maneuver, legPath, typeOverride, textOverride) {
        const index = Math.min(maneuver.begin_shape_index,
                               legPath.length - 1);

        return new TurnPoint({
            coordinate:      legPath[index],
            type:            typeOverride ?? this._createTurnPointType(maneuver.type),
            distance:        maneuver.length * 1000,
            instruction:     textOverride ?? maneuver.instruction,
            time:            maneuver.time * 1000,
            turnAngle:       this._getRoundaboutAngle(maneuver),
            verbalAlert:     maneuver.verbal_transition_alert_instruction ?? null,
            verbalPre:       maneuver.verbal_pre_transition_instruction ?? null,
            verbalPost:      maneuver.verbal_post_transition_instruction ?? null
        });
    }

    _isDestination(type) {
        return type === Maneuver.DESTINATION ||
               type === Maneuver.DESTINATION_RIGHT ||
               type === Maneuver.DESTINATION_LEFT;
    }

    _getRoundaboutAngle(maneuver) {
        if (maneuver.type !== Maneuver.ROUNDABOUT_ENTER ||
            maneuver.begin_heading === undefined)
            return null;

        let diff = (maneuver.end_heading ?? maneuver.begin_heading) -
                   maneuver.begin_heading;

        if (diff > 180)
            diff -= 360;
        else if (diff < -180)
            diff += 360;

        return (diff / 180) * Math.PI;
    }

    _createTurnPointType(type) {
        switch (type) {
            case Maneuver.START:
            case Maneuver.START_RIGHT:
            case Maneuver.START_LEFT:       return TurnPoint.Type.START;
            case Maneuver.DESTINATION:
            case Maneuver.DESTINATION_RIGHT:
            case Maneuver.DESTINATION_LEFT: return TurnPoint.Type.END;
            case Maneuver.BECOMES:
            case Maneuver.CONTINUE:
            case Maneuver.RAMP_STRAIGHT:
            case Maneuver.STAY_STRAIGHT:
            case Maneuver.MERGE:
            case Maneuver.FERRY_ENTER:
            case Maneuver.FERRY_EXIT:
            case Maneuver.BUILDING_ENTER:
            case Maneuver.BUILDING_EXIT:    return TurnPoint.Type.CONTINUE;
            case Maneuver.SLIGHT_RIGHT:     return TurnPoint.Type.SLIGHT_RIGHT;
            case Maneuver.RIGHT:            return TurnPoint.Type.RIGHT;
            case Maneuver.SHARP_RIGHT:      return TurnPoint.Type.SHARP_RIGHT;
            case Maneuver.UTURN_RIGHT:      return TurnPoint.Type.UTURN_RIGHT;
            case Maneuver.UTURN_LEFT:       return TurnPoint.Type.UTURN_LEFT;
            case Maneuver.SHARP_LEFT:       return TurnPoint.Type.SHARP_LEFT;
            case Maneuver.LEFT:             return TurnPoint.Type.LEFT;
            case Maneuver.SLIGHT_LEFT:      return TurnPoint.Type.SLIGHT_LEFT;
            case Maneuver.RAMP_RIGHT:
            case Maneuver.EXIT_RIGHT:
            case Maneuver.STAY_RIGHT:
            case Maneuver.MERGE_RIGHT:      return TurnPoint.Type.KEEP_RIGHT;
            case Maneuver.RAMP_LEFT:
            case Maneuver.EXIT_LEFT:
            case Maneuver.STAY_LEFT:
            case Maneuver.MERGE_LEFT:       return TurnPoint.Type.KEEP_LEFT;
            case Maneuver.ROUNDABOUT_ENTER: return TurnPoint.Type.ROUNDABOUT;
            case Maneuver.ROUNDABOUT_EXIT:  return TurnPoint.Type.LEAVE_ROUNDABOUT;
            case Maneuver.ELEVATOR_ENTER:   return TurnPoint.Type.ELEVATOR;
            case Maneuver.STEPS_ENTER:
            case Maneuver.ESCALATOR_ENTER:  return TurnPoint.Type.STAIRS;
            default:                        return TurnPoint.Type.CONTINUE;
        }
    }
}
