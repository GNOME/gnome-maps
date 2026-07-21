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

/* Earch Radius is of couse not perfect depending on where you are, but it's
 * a good value in most cases. Possible switch to another forumla but that
 * would need more computing power than this simple function
 */
const EARTH_RADIUS = 6371009;
const DEG_TO_RAD = Math.PI / 180;
const METERS_PER_DEG_LAT = EARTH_RADIUS * DEG_TO_RAD;

/* Haversine_formula */
export function distance(lat1, lon1, lat2, lon2) {
    const latInRad1 = lat1 * DEG_TO_RAD;
    const latInRad2 = lat2 * DEG_TO_RAD;
    const deltaLatInRad = (lat2 - lat1) * DEG_TO_RAD;
    const deltaLon = (lon2 - lon1) * DEG_TO_RAD;
    const a = Math.sin(deltaLatInRad / 2) ** 2 +
              Math.cos(latInRad1) * Math.cos(latInRad2) * Math.sin(deltaLon / 2) ** 2;

    return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(a));
}

export function cumulativeDistances(path) {
    const cumulative = new Array(path.length);
    let total = 0;

    cumulative[0] = 0;
    for (let i = 1; i < path.length; i++) {
        total += distance(path[i - 1].latitude, path[i - 1].longitude,
                          path[i].latitude, path[i].longitude);
        cumulative[i] = total;
    }
    return cumulative;
}

/* Try to find the best position based on the given path */
export function matchToPath(path, lat, lon, hintIndex = 0,
                            windowSize = Infinity) {
    const cosLat = Math.cos(lat * DEG_TO_RAD);
    const metersPerDegLon = METERS_PER_DEG_LAT * cosLat;

    const windowHalf = windowSize === Infinity ? Infinity : 2;
    const first = Math.max(0, hintIndex - windowHalf);
    const last = windowSize === Infinity ?
                 path.length - 2 :
                 Math.min(path.length - 2, hintIndex + windowSize);

    let best = null;

    for (let i = first; i <= last; i++) {
        const x1 = (path[i].longitude - lon) * metersPerDegLon;
        const y1 = (path[i].latitude - lat) * METERS_PER_DEG_LAT;
        const x2 = (path[i + 1].longitude - lon) * metersPerDegLon;
        const y2 = (path[i + 1].latitude - lat) * METERS_PER_DEG_LAT;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSquared = dx * dx + dy * dy;
        const t = lengthSquared === 0 ?
                  0 : Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) /
                                              lengthSquared));
        const px = x1 + t * dx;
        const py = y1 + t * dy;
        const distSquared = px * px + py * py;

        if (!best || distSquared < best.distSquared) {
            best = { distSquared:  distSquared,
                     segmentIndex: i,
                     fraction:     t,
                     alongSegment: t * Math.sqrt(lengthSquared) };
        }
    }

    const segment = path[best.segmentIndex];
    const next = path[best.segmentIndex + 1];

    return {
        segmentIndex:       best.segmentIndex,
        fraction:           best.fraction,
        latitude:           segment.latitude + best.fraction *
                            (next.latitude - segment.latitude),
        longitude:          segment.longitude + best.fraction *
                            (next.longitude - segment.longitude),
        crossTrackDistance: Math.sqrt(best.distSquared),
        alongSegment:       best.alongSegment
    };
}
