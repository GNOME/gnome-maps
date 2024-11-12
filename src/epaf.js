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
 * Author: Jussi Kukkonen <jku@goto.fi>
 *         Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>
 */

// Google encoded polyline decoder
// https://developers.google.com/maps/documentation/utilities/polylinealgorithm

import Shumate from 'gi://Shumate';

const DEFAULT_PRECISION = 5;

function _decodeValue(data, index) {
    let b;
    let shift = 1;
    let value = 0;

    do {
        // 63 added to keep string printable
        b = data.charCodeAt(index++) - 63;

        // Get 5 bits at a time until hit the end of value
        // (which is not OR'd with 0x20)
        value += (b & 0x1f) * shift;
        shift *= 32;
    } while (b >= 0x20);

    // negative values are encoded as two's complement
    let ret_val = (value & 1) ? ((-value - 1) / 2) : (value / 2);
    return [ret_val, index];
}

export function decode(data, precision = DEFAULT_PRECISION) {
    let length = data.length;
    let polyline = [];
    let index = 0;
    let lat = 0;
    let lon = 0;

    while (index < length) {
        let latdelta, londelta;

        [latdelta, index] = _decodeValue(data, index);
        [londelta, index] = _decodeValue(data, index);

        // first value is absolute, rest are relative to previous value
        lat += latdelta;
        lon += londelta;
        polyline.push(new Shumate.Coordinate({
            latitude:  lat * Math.pow(10, -precision),
            longitude: lon * Math.pow(10, -precision)
        }));
    }
    return polyline;
}

export function decodeFirstCoordinate(data, precision = DEFAULT_PRECISION) {
    const [latdelta, index] = _decodeValue(data, 0);
    const [londelta,] = _decodeValue(data, index);

    return new Shumate.Coordinate({ latitude: latdelta * Math.pow(10, -precision),
                                    longitude: londelta * Math.pow(10, -precision) });
}

function _encodeValue(val) {
    let result = '';
    val = Math.round(val * 1e5) << 1;
    if (val < 0) {
        val = ~val;
    }
    do {
        result += String.fromCharCode(((val > 0x1f ? 0x20 : 0) | (val & 0x1f)) + 63);
        val >>= 5;
    } while (val != 0);
    return result;
}

export function encode(polyline) {
    let result = '';
    let prevLat = 0;
    let prevLon = 0;

    for (const coordinate of polyline) {
        result += _encodeValue(coordinate.latitude - prevLat);
        result += _encodeValue(coordinate.longitude - prevLon);
        prevLat = coordinate.latitude;
        prevLon = coordinate.longitude;
    }

    return result;
}
