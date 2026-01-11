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

import GeocodeGlib from 'gi://GeocodeGlib';
import GObject from 'gi://GObject';

import {Place} from './place.js';

export class TransitPlace extends Place {
    constructor({ id, ...params }) {
        super(params);
        this._id = id;
    }

    get id() {
        return this._id;
    }

    get uniqueID() {
        return this._id;
    }

    get isRawCoordinates() {
        return false;
    }

    get osmType() {
        return GeocodeGlib.PlaceOsmType.UNKNOWN;
    }

    get iconName() {
        /* as we don't known the specific modes of transportation from
         * stop positions from legs and intermediate stops, use the train
         * icon as used for the public transit toggle in the mode toggle
         * in the route planner to denote genetic "transit"
         */
        return 'train-symbolic';
    }

    toJSON() {
        const parentJSON = super.toJSON();

        return { id: this._id, ...parentJSON };
    }

    static fromJSON(obj) {
        return new TransitPlace(Place.constructProperties(obj));
    }
}
GObject.registerClass(TransitPlace);
