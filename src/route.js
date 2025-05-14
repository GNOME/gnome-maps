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

import GObject from 'gi://GObject';

import {BoundingBox} from './boundingBox.js';
import * as Utils from './utils.js';

export class Route extends GObject.Object {

    constructor() {
        super();
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
        let bbox = new BoundingBox();
        coordinates.forEach(function({ latitude, longitude }) {
            bbox.extend(latitude, longitude);
        }, this);
        return bbox;
    }
}

GObject.registerClass({
    Signals: {
        'update': {},
        'reset': {},
        'error': { param_types: [GObject.TYPE_STRING] }
    }
}, Route);

export class TurnPoint {

    static Type = {
        START:            0,
        SHARP_LEFT:       1,
        LEFT:             2,
        SLIGHT_LEFT:      3,
        KEEP_LEFT:        4,
        CONTINUE:         5,
        SLIGHT_RIGHT:     6,
        RIGHT:            7,
        SHARP_RIGHT:      8,
        KEEP_RIGHT:       9,
        END:              10,
        VIA:              11,
        ROUNDABOUT:       12,
        LEAVE_ROUNDABOUT: 13,
        UTURN:            14,
        UTURN_LEFT:       15,
        UTURN_RIGHT:      16,
        ELEVATOR:         17,
        STAIRS:           18,
    }

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
        return this._type === TurnPoint.Type.START
            || this._type === TurnPoint.Type.VIA
            || this._type === TurnPoint.Type.END;
    }

    _getIconName(turnAngle) {
        switch(this._type) {
        case TurnPoint.Type.SHARP_LEFT:   return 'maps-direction-sharpleft-symbolic';
        case TurnPoint.Type.LEFT:         return 'maps-direction-left-symbolic';
        case TurnPoint.Type.SLIGHT_LEFT:  return 'maps-direction-slightleft-symbolic';
        case TurnPoint.Type.KEEP_LEFT:    return 'maps-direction-keep-left-symbolic';
        case TurnPoint.Type.CONTINUE:     return 'maps-direction-continue-symbolic';
        case TurnPoint.Type.KEEP_RIGHT:   return 'maps-direction-keep-right-symbolic';
        case TurnPoint.Type.SLIGHT_RIGHT: return 'maps-direction-slightright-symbolic';
        case TurnPoint.Type.RIGHT:        return 'maps-direction-right-symbolic';
        case TurnPoint.Type.SHARP_RIGHT:  return 'maps-direction-sharpright-symbolic';
        case TurnPoint.Type.START:        return 'maps-point-start-symbolic';
        case TurnPoint.Type.VIA:          return 'maps-point-end-symbolic';
        case TurnPoint.Type.END:          return 'maps-point-end-symbolic';
        case TurnPoint.Type.ROUNDABOUT:   return this._getRoundaboutIconName(turnAngle);
        case TurnPoint.Type.ELEVATOR:     return 'maps-direction-elevator-symbolic';
        case TurnPoint.Type.UTURN:        return this._isLefthandTraffic() ?
                                                'maps-direction-u-turn-right-symbolic':
                                                'maps-direction-u-turn-left-symbolic';
        case TurnPoint.Type.UTURN_LEFT:   return 'maps-direction-u-turn-left-symbolic';
        case TurnPoint.Type.UTURN_RIGHT:  return 'maps-direction-u-turn-right-symbolic';
        case TurnPoint.Type.STAIRS:       return 'steps-symbolic';
        default:                          return '';
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
        return Utils.isLefthandTrafficForCoordinates(this.coordinate.latitude,
                                                    this.coordinate.longitude);
    }
}
