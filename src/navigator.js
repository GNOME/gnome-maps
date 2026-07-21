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

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import {Application} from './application.js';
import * as NavGeometry from './navGeometry.js';
import {RouteQuery} from './routeQuery.js';
import {Speech} from './speech.js';
import * as Utils from './utils.js';

const Stage = {
    NONE:  0,
    ALERT: 1,
    PRE:   2
};

/* Distance in meters */
const Params = {
    [RouteQuery.Transportation.CAR]: {
        alertDistance:    500,
        preDistance:      70,
        passedDistance:   15,
        offRouteDistance: 50,
        arrivalDistance:  30,
        followZoom:       17
    },
    [RouteQuery.Transportation.BIKE]: {
        alertDistance:    150,
        preDistance:      30,
        passedDistance:   10,
        offRouteDistance: 35,
        arrivalDistance:  20,
        followZoom:       17.5
    },
    [RouteQuery.Transportation.PEDESTRIAN]: {
        alertDistance:    80,
        preDistance:      20,
        passedDistance:   8,
        offRouteDistance: 30,
        arrivalDistance:  15,
        followZoom:       18
    }
};

const OFF_ROUTE_HYSTERESIS = 3;
const MAX_ACCURACY = 100;
const ALERT_TIME_GAP = 15;
const SPEED_SMOOTHING = 0.3;
const MAX_ALERT_DISTANCE = 1000;
const MAX_PLAUSIBLE_SPEED = 70;

export class Navigator extends GObject.Object {

    constructor() {
        super();

        this._route = Application.routingDelegator.route;
        this._query = Application.routeQuery;
        this._speech = new Speech();
        this._active = false;
        this._locationChangedId = 0;
        this._routeUpdatedId = 0;
    }

    get active() {
        return this._active;
    }

    get params() {
        return this._params;
    }

    get nextTurnPoint() {
        return this._turnPoints?.[this._nextIndex] ?? null;
    }

    start() {
        if (this._active)
            return false;

        if (!this._route.turnPoints || this._route.turnPoints.length === 0)
            return false;

        this._transportation = this._query.transportation;
        this._params = Params[this._transportation];

        if (!this._params)
            return false;

        this._initFromRoute();

        this._locationChangedId =
            Application.geoclue.connect('location-changed',
                                        () => this._onLocationChanged());

        this._routeUpdatedId =
            this._route.connect('update', () => this._initFromRoute());

        this._active = true;
        this._rerouting = false;
        this.emit('started');

        this._announceDeparture();

        if (Application.geoclue.place?.location)
            this._onLocationChanged();

        return true;
    }

    stop() {
        if (!this._active)
            return;

        if (this._locationChangedId) {
            Application.geoclue.disconnect(this._locationChangedId);
            this._locationChangedId = 0;
        }
        if (this._routeUpdatedId) {
            this._route.disconnect(this._routeUpdatedId);
            this._routeUpdatedId = 0;
        }

        this._speech.cancel();
        this._active = false;
        this.emit('stopped');
    }

    _initFromRoute() {
        this._path = this._route.path;
        this._turnPoints = this._route.turnPoints;
        this._cumulative = NavGeometry.cumulativeDistances(this._path);
        let hint = 0;
        this._turnPointDistances = this._turnPoints.map((turnPoint) => {
            const match = NavGeometry.matchToPath(this._path,
                                                  turnPoint.coordinate.latitude,
                                                  turnPoint.coordinate.longitude,
                                                  hint, 50);

            hint = match.segmentIndex;
            return this._cumulative[match.segmentIndex] + match.alongSegment;
        });
        this._averageSpeed = this._route.time > 0 ?
                             this._route.distance / this._route.time : 0;
        this._nextIndex = 1;
        this._stage = Stage.NONE;
        this._segmentHint = 0;
        this._offRouteCount = 0;
        this._smoothedSpeed = 0;
        this._lastFix = null;
        this._rerouting = false;
    }

    _announceDeparture() {
        const start = this._turnPoints[0];

        if (!start)
            return;

        let text = start.verbalPre ?? start.instruction;

        if (start.verbalPost)
            text = text ? text + ' ' + start.verbalPost : start.verbalPost;

        this._speak(text);
    }

    _onLocationChanged() {
        const location = Application.geoclue.place?.location;

        if (!location)
            return;

        if (location.accuracy > MAX_ACCURACY) {
            Utils.debug('Navigator: ignoring fix with accuracy ' +
                        location.accuracy + ' m');
            return;
        }

        this._processFix(location.latitude, location.longitude);
    }

    _processFix(latitude, longitude) {
        if (this._rerouting)
            return;

        const location = { latitude: latitude, longitude: longitude };
        const match = NavGeometry.matchToPath(this._path,
                                              location.latitude,
                                              location.longitude,
                                              this._segmentHint,
                                              this._lastFix ? 30 : Infinity);

        this._updateSpeed(location);

        if (match.crossTrackDistance > this._params.offRouteDistance) {
            if (++this._offRouteCount >= OFF_ROUTE_HYSTERESIS) {
                this._reroute(location);
                return;
            }
            return;
        }

        this._offRouteCount = 0;
        this._segmentHint = match.segmentIndex;

        const along = this._cumulative[match.segmentIndex] +
                      match.alongSegment;

        this._advanceManeuvers(along);

        if (!this._active)
            return;

        const distanceToNext = this._turnPointDistances[this._nextIndex] - along;
        const remainingDistance = this._route.distance - along;
        const remainingTime = this._averageSpeed > 0 ?
                              remainingDistance / this._averageSpeed : 0;

        this._announce(distanceToNext);

        this.emit('progress', this._nextIndex, distanceToNext,
                  remainingDistance, remainingTime,
                  match.latitude, match.longitude);
    }

    _updateSpeed(location) {
        const now = Date.now();

        if (this._lastFix) {
            const dt = (now - this._lastFix.time) / 1000;

            if (dt > 0) {
                const d = NavGeometry.distance(this._lastFix.latitude,
                                               this._lastFix.longitude,
                                               location.latitude,
                                               location.longitude);
                const speed = Math.min(d / dt, MAX_PLAUSIBLE_SPEED);

                this._smoothedSpeed =
                    this._smoothedSpeed === 0 ?
                    speed :
                    SPEED_SMOOTHING * speed +
                    (1 - SPEED_SMOOTHING) * this._smoothedSpeed;
            }
        }
        this._lastFix = { latitude:  location.latitude,
                          longitude: location.longitude,
                          time:      now };
    }

    _advanceManeuvers(along) {
        while (this._nextIndex < this._turnPoints.length &&
               along >= this._turnPointDistances[this._nextIndex] -
                        this._params.passedDistance) {
            const passed = this._turnPoints[this._nextIndex];

            if (this._nextIndex === this._turnPoints.length - 1) {
                this._speak(passed.verbalPre ?? passed.instruction);
                this.emit('finished');
                this.stop();
                return;
            }

            if (passed.verbalPost)
                this._speak(passed.verbalPost);

            this._nextIndex++;
            this._stage = Stage.NONE;
        }

        if (this._nextIndex === this._turnPoints.length - 1 &&
            this._turnPointDistances[this._nextIndex] - along <=
            this._params.arrivalDistance) {
            const destination = this._turnPoints[this._nextIndex];

            this._speak(destination.verbalPre ?? destination.instruction);
            this.emit('finished');
            this.stop();
        }
    }

    _announce(distanceToNext) {
        const turnPoint = this.nextTurnPoint;

        if (!turnPoint)
            return;

        const alertDistance =
            Math.min(MAX_ALERT_DISTANCE,
                     Math.max(this._params.alertDistance,
                              this._smoothedSpeed * ALERT_TIME_GAP));

        if (this._stage < Stage.PRE &&
            distanceToNext <= this._params.preDistance) {
            this._speak(turnPoint.verbalPre ?? turnPoint.instruction);
            this._stage = Stage.PRE;
        } else if (this._stage < Stage.ALERT &&
                   distanceToNext <= alertDistance &&
                   distanceToNext > this._params.preDistance) {
            this._speak(turnPoint.verbalAlert ??
                        _("In %s: %s").format(
                            Utils.prettyDistance(distanceToNext),
                            turnPoint.instruction));
            this._stage = Stage.ALERT;
        }
    }

    _speak(text) {
        if (!text)
            return;

        this.emit('announcement', text);
        this._speech.speak(text);
    }

    _reroute(location) {
        this._rerouting = true;
        this._offRouteCount = 0;
        this.emit('rerouting');

        const passedVias =
            this._turnPoints.slice(0, this._nextIndex)
                            .filter((turnPoint) => turnPoint.isStop())
                            .length - 1;
        const filledPoints = this._query.filledPoints;
        const remaining =
            filledPoints.slice(Math.min(passedVias + 1,
                                        filledPoints.length - 1));
        const points = [
            { place: { location: { latitude:  location.latitude,
                                   longitude: location.longitude } } },
            ...remaining
        ];
        const router = Application.routingDelegator.router;

        router.fetchRouteAsync(points, this._transportation,
                               (routeResult, exception) => {
            if (!this._active)
                return;

            if (routeResult) {
                this._route.update(routeResult);
            } else {
                Utils.debug('Rerouting failed: ' + exception);
                this._rerouting = false;
            }
        });
    }
}

GObject.registerClass({
    Signals: {
        'started': {},
        'progress': { param_types: [GObject.TYPE_INT,
                                    GObject.TYPE_DOUBLE,
                                    GObject.TYPE_DOUBLE,
                                    GObject.TYPE_DOUBLE,
                                    GObject.TYPE_DOUBLE,
                                    GObject.TYPE_DOUBLE] },
        'announcement': { param_types: [GObject.TYPE_STRING] },
        'rerouting': {},
        'finished': {},
        'stopped': {}
    }
}, Navigator);
