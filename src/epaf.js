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

import Champlain from 'gi://Champlain';

function _decodeValue(data, index) {
    let b;
    let shift = 0;
    let value = 0;

    do {
        // 63 added to keep string printable
        b = data.charCodeAt(index++) - 63;

        // Get 5 bits at a time until hit the end of value
        // (which is not OR'd with 0x20)
        value |= (b & 0x1f) << shift;
        shift += 5;
    } while (b >= 0x20);

    // negative values are encoded as two's complement
    let ret_val = ((value & 1) ? ~(value >> 1) : (value >> 1));
    return [ret_val, index];
}

export function decode(data) {
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
        polyline.push(new Champlain.Coordinate({
            latitude:  lat * 1e-5,
            longitude: lon * 1e-5
        }));
    }
    return polyline;
}
