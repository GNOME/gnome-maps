/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2026 Marcus Lundblad
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
 * Author: Marcus Lundblad <ml@dfupdate.se>
 */

import {Route} from './route.js';

/**
 * Representing a departure or arrival (a route departing or arriving at a place
 * on a specific time).
 */
export class Juncture extends Route {
    constructor({ place, designation, time, scheduledTime, track, scheduledTrack,
                  ...params }) {
        super(params);

        this._place = place;
        this._designation = designation;
        this._time = time;
        this._scheduledTime = time;
        this._track = track;
        this._scheduledTrack = scheduledTrack;
    }

    get place() {
        return this._place;
    }

    // headsign for depatures, station of trip origin for arrivals
    get designation() {
        return this._designation;
    }

    get time() {
        return this._time;
    }

    get scheduledTime() {
        return this._scheduledTime;
    }

    get track() {
        return this._track;
    }

    get scheduledTrack() {
        return this._scheduledTrack;
    }

    get isArrival() {
        throw 'needs to be implemented by concrete class';
    }
}
