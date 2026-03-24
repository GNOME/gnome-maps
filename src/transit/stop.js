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

import GObject from 'gi://GObject';

import * as Time from '../time.js';
import {TransitPlace} from '../transitPlace.js';

export class Stop extends TransitPlace {

    constructor({ arrival, scheduledArrival,
                  departure, scheduledDeparture, ...params }) {
        super(params);

        this._arrival = arrival;
        this._scheduledArrival = scheduledArrival;
        this._departure = departure;
        this._scheduledDeparture = scheduledDeparture;
    }

    get arrival() {
        return this._arrival;
    }

    get scheduledArrival() {
        return this._scheduledArrival;
    }

    get departure() {
        return this._departure;
    }

    get scheduledDeparture() {
        return this._scheduledDeparture;
    }

    prettyPrint(params) {
        return Time.formatDateTime(params.isFinal ?
                                   this._arrival : this._departure);
    }
}
GObject.registerClass(Stop);
