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

const GObject = imports.gi.GObject;

const BoundingBox = imports.boundingBox;
const Utils = imports.utils;

var TurnPointType = {
    SHARP_LEFT:    0,
    LEFT:          1,
    SLIGHT_LEFT:   2,
    CONTINUE:      3,
    SLIGHT_RIGHT:  4,
    RIGHT:         5,
    SHARP_RIGHT:   6,
    END:           7,
    VIA:           8,
    ROUNDABOUT:    9,

    // This one is not in GraphHopper, so choose
    // a reasonably unlikely number for this
    START:         10000,
    ELEVATOR:      10001,
    UTURN_LEFT:    10002,
    UTURN_RIGHT:   10003
};

/* countries/terrotories driving on the left
 * source: https://en.wikipedia.org/wiki/Left-_and_right-hand_traffic
 */
const LHT_COUNTRIES = new Set(['AG', 'AI', 'AU', 'BB', 'BD', 'BM', 'BN', 'BS',
                               'BT', 'BW', 'CY', 'DM', 'FJ', 'FK', 'GB', 'GB',
                               'GD', 'GY', 'HK', 'ID', 'IE', 'IM', 'IN', 'JE',
                               'JM', 'JP', 'KE', 'KI', 'KN', 'KY', 'LC', 'LK',
                               'LS', 'MO', 'MS', 'MT', 'MU', 'MV', 'MW', 'MY',
                               'MZ', 'NA', 'NP', 'NR', 'NZ', 'PG', 'PN', 'PK',
                               'SB', 'SC', 'SG', 'SH', 'SR', 'SZ', 'TC', 'TH',
                               'TL', 'TO', 'TT', 'TV', 'TZ', 'UG', 'VC', 'VG',
                               'VI', 'WS', 'ZA', 'ZM', 'ZW']);

var Route = GObject.registerClass({
    Signals: {
        'update': {},
        'reset': {},
        'error': { param_types: [GObject.TYPE_STRING] }
    }
}, class Route extends GObject.Object {

    _init() {
        super._init();
        this.reset();
    }

    update({ path, turnPoints, distance, time, bbox }) {
        this.path = path;
        this.turnPoints = turnPoints;
        this.distance = distance;
        this.time = time;
        this.bbox = bbox || this.createBBox(path);

        this.emit('update');
    }

    reset() {
        this.path = [];
        this.turnPoints = [];
        this.distance = 0;
        this.time = 0;
        this.bbox = null;
        this.emit('reset');
    }

    error(msg) {
        this.emit('error', msg);
    }

    createBBox(coordinates) {
        let bbox = new BoundingBox.BoundingBox();
        coordinates.forEach(function({ latitude, longitude }) {
            bbox.extend(latitude, longitude);
        }, this);
        return bbox;
    }
});

var TurnPoint = class TurnPoint {

    constructor({ coordinate, type, distance, instruction, turnAngle }) {
        this.coordinate = coordinate;
        this._type = type;
        this.distance = distance;
        this.instruction = instruction;
        this.iconName = this._getIconName(turnAngle);
    }

    get type() {
        return this._type;
    }

    isStop() {
        return this._type === TurnPointType.START
            || this._type === TurnPointType.VIA
            || this._type === TurnPointType.END;
    }

    _getIconName(turnAngle) {
        switch(this._type) {
        case TurnPointType.SHARP_LEFT:   return 'maps-direction-sharpleft-symbolic';
        case TurnPointType.LEFT:         return 'maps-direction-left-symbolic';
        case TurnPointType.SLIGHT_LEFT:  return 'maps-direction-slightleft-symbolic';
        case TurnPointType.CONTINUE:     return 'maps-direction-continue-symbolic';
        case TurnPointType.SLIGHT_RIGHT: return 'maps-direction-slightright-symbolic';
        case TurnPointType.RIGHT:        return 'maps-direction-right-symbolic';
        case TurnPointType.SHARP_RIGHT:  return 'maps-direction-sharpright-symbolic';
        case TurnPointType.START:        return 'maps-point-start-symbolic';
        case TurnPointType.VIA:          return 'maps-point-end-symbolic';
        case TurnPointType.END:          return 'maps-point-end-symbolic';
        case TurnPointType.ROUNDABOUT:   return this._getRoundaboutIconName(turnAngle);
        case TurnPointType.ELEVATOR:     return 'maps-direction-elevator-symbolic';
        case TurnPointType.UTURN_LEFT:   return 'maps-direction-u-turn-left-symbolic';
        case TurnPointType.UTURN_RIGHT:  return 'maps-direction-u-turn-right-symbolic';
        default:                         return '';
        }
    }

    _getRoundaboutIconName(turnAngle) {
        /*
         * To map turnAngle with closest roundabout
         * turning angle symbol available. The Algorithm
         * calculates the minimum of absolute difference
         * between turnAngle and the angle of which map
         * has turning symbols.
         */
        let minDiff = 2 * Math.PI;
        let angle = 0;
        if (turnAngle === null)
            return 'maps-direction-roundabout-symbolic';

        if (turnAngle < 0)
            turnAngle += 2 * Math.PI;

        for (let x = 0; x < 360; x += 45) {
            if (Math.abs(turnAngle - (x / 180) * Math.PI) < minDiff) {
                minDiff = Math.abs(turnAngle - (x / 180) * Math.PI);
                angle = x;
            }
        }
        // use mirrored icon for left-hand traffic when angle is not zero
        return 'maps-direction-roundabout-' + angle +
               (angle !== 0 && this._isLefthandTraffic() ? '-lht' : '') +
               '-symbolic';
    }

    _isLefthandTraffic() {
        let country =
            Utils.getCountryCodeForCoordinates(this.coordinate.latitude,
                                               this.coordinate.longitude);

        return LHT_COUNTRIES.has(country);
    }
};
