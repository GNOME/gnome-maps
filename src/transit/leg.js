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

import gettext from 'gettext';

import Shumate from 'gi://Shumate';

import {BoundingBox} from '../boundingBox.js';
import * as Time from '../time.js';

const _ = gettext.gettext;

export class Leg {

    constructor({ route, departure, scheduledDeparture, arrival,
                  scheduledArrival, polyline, from, to, intermediateStops,
                  headsign, isTransit, walkingInstructions, distance, duration,
                  departureTrack, scheduledDepartureTrack,
                  arrivalTrack, scheduledArrivalTrack }) {
        this._route = route;
        this._departure = departure;
        this._scheduledDeparture = scheduledDeparture;
        this._arrival = arrival;
        this._scheduledArrival = scheduledArrival;
        this._polyline = polyline;
        this._from = from;
        this._to = to;
        this._intermediateStops = intermediateStops;
        this._headsign = headsign;
        this._isTransit = isTransit;
        this._walkingInstructions = walkingInstructions;
        this._distance = distance;
        this._duration = duration;
        this._departureTrack = departureTrack;
        this._scheduledDepartureTrack = scheduledDepartureTrack;
        this._arrivalTrack = arrivalTrack;
        this._scheduledArrivalTrack = scheduledArrivalTrack;
        this.bbox = this._createBBox();
    }

    get route() {
        return this._route;
    }

    get departure() {
        return this._departure;
    }

    get scheduledDeparture() {
        return this._scheduledDeparture;
    }

    get arrival() {
        return this._arrival;
    }

    get scheduledArrival() {
        return this._scheduledArrival;
    }

    get polyline() {
        if (!this._polyline)
            this._createPolyline();

        return this._polyline;
    }

    get fromCoordinate() {
        return this._fromCoordinate;
    }

    get toCoordinate() {
        return this._toCoordinate;
    }

    get from() {
        return this._from;
    }

    get to() {
        return this._to;
    }

    get intermediateStops() {
        return this._intermediateStops;
    }

    get headsign() {
        return this._headsign;
    }

    get transit() {
        return this._isTransit;
    }

    get distance() {
        return this._distance;
    }

    get duration() {
        return this._duration;
    }

    get departureTrack() {
        return this._departureTrack;
    }

    get scheduledDepartureTrack() {
        return this._scheduledDepartureTrack;
    }

    get arrivalTrack() {
        return this._arrivalTrack;
    }

    get scheduledArrivalTrack() {
        return this._scheduledArrivalTrack;
    }

    // create polyline from intermediate stops, or start and arrival coordinates
    _createPolyline() {
        if (this._intermediateStops) {
            const first =
                new Shumate.Coordinate({ latitude:  this._from.location.latitude,
                                         longitude: this._from.location.longitude });
            const rest = this._intermediateStops.map((s) => {
                return new Shumate.Coordinate({ latitude:  s.location.latitude,
                                                longitude: s.location.latitude });
            });

            this._polyline = [first, ...rest];
        } else {
            this._polyline =
                [new Shumate.Coordinate({ latitude:  this._from.location.latitude,
                                          longitude: this._from.location.longitude }),
                 new Shumate.Coordinate({ latitude:  this._to.location.latitude,
                                          longitude: this._to.location.longitude })];
        }
    }

    _createBBox() {
        let bbox = new BoundingBox();

        this.polyline.forEach(function({ latitude, longitude }) {
            bbox.extend(latitude, longitude);
        });

        return bbox;
    }

    get iconName() {
        return this._route?.iconName ?? 'walking-symbolic';
    }

    get walkingInstructions() {
        return this._walkingInstructions;
    }

    /* Pretty print timing for a transit leg, set params.isStart: true when
     * printing for the starting leg of an itinerary.
     * For starting walking legs, only the departure time will be printed,
     * otherwise the departure and arrival time of the leg (i.e. transit ride
     * or an in-between walking section) will be printed.
     */
    prettyPrintTime(params) {
        if (!this.transit && params.isStart) {
            return this.prettyPrintDepartureTime();
        } else {
            /* Translators: this is a format string for showing a departure and
             * arrival time in a more compact manner to show in the instruction
             * list for an itinerary, like:
             * "12:00–13:03" where the placeholder %s are the actual times,
             * these could be rearranged if needed.
             */
            return _("%s\u2013%s").format(this.prettyPrintDepartureTime(),
                                          this.prettyPrintArrivalTime());
        }
    }

    prettyPrintDepartureTime() {
        return Time.formatDateTime(this.departure);
    }

    prettyPrintArrivalTime() {
        return Time.formatDateTime(this.arrival);
    }
}
