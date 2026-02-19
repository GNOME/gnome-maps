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
    constructor({ id, modes, ...params }) {
        super(params);
        this._id = id;
        this._modes = modes;
        this._initModes();
    }

    get id() {
        return this._id;
    }

    get modes() {
        return this._modes;
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

    get osmKey() {
        return this._osmKey;
    }

    get osmValue() {
        return this._osmValue;
    }

    get station() {
        return this._station;
    }

    get iconName() {
        return this._iconName;
    }

    _initModes() {
        if (!this._modes) {
            this._iconName = 'dialog-question-symbolic';

            return;
        }

        // map transit modes to OSM types to get translated titles from POI types
        if (this._modes.has('AIRPLANE')) {
            this._iconName = 'flying-symbolic';
            this._osmKey = 'aeroway';
            this._osmValue = 'aerodrome';
        } else if (this._modes.has('FERRY')) {
            this._iconName = 'ferry-symbolic';
            this._osmKey = 'amenity';
            this._osmValue = 'ferry_terminal';
        } else if (this._modes.has('RAIL') || this._modes.has('HIGHSPEED_RAIL') ||
                   this._modes.has('LONG_DISTANCE') ||
                   this._modes.has('NIGHT_RAIL') ||
                   this._modes.has('REGIONAL_FAST_RAIL') ||
                   this._modes.has('REGIONAL_RAIL') || this._modes.has('SUBURBAN')) {
            this._iconName = 'train-symbolic';
            this._osmKey = 'railway';
            this._osmValue = 'station';
            this._station = 'station';
        } else if (this._modes.has('SUBWAY')) {
            this._iconName = 'subway-symbolic';
            this._osmKey = 'railway';
            this._osmValue = 'station';
            this._station = 'subway';
        } else if (this._modes.has('TRAM')) {
            this._iconName = 'tram-symbolic';
            this._osmKey = 'railway';
            this._osmValue = 'tram_stop';
            this._station = 'tram';
        } else if (this._modes.has('BUS') || this._modes.has('COACH')) {
            this._iconName = 'bus-symbolic';
            this._osmKey = 'highway';
            this._osmValue = 'bus_stop';
        } else if (this._modes.has('ODM')) {
            this._iconName = 'taxi-symbolic';
            this._osmKey = 'amenity';
            this._osmValue = 'taxi_rank';
        } else if (this._modes.has('FUNICULAR')) {
            this._iconName = 'funicular-symbolic';
            this._osmKey = 'railway';
            this._osmValue = 'station';
            this._station = 'funicular';
        } else if (this._modes.has('AERIAL_LIFT')) {
            this._iconName = 'gondola-symbolic';
            this._osmKey = 'aerialway';
            this._osmValue = 'station';
        } else {
            /* use a fallback question mark icon in case of some future,
             * for now unknown mode appears */
            this._iconName = 'dialog-question-symbolic';
        }
    }

    toJSON() {
        const parentJSON = super.toJSON();

        return { id: this._id, modes: [...this._modes], ...parentJSON };
    }

    static fromJSON(obj) {
        const { id, modes, ...rest } = Place.constructProperties(obj);

        return new TransitPlace({ id: id, modes: new Set(modes), ...rest });
    }
}
GObject.registerClass(TransitPlace);
