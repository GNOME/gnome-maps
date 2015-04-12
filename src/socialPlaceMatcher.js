/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2014 Damián Nohales
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
 * Author: Damián Nohales <damiannohales@gmail.com>
 */

/**
 * The Levenshtein distance is a string comparison algorithm defined
 * as the minimal number of characters you have to replace, insert or
 * delete to transform string a into string b.
 * We use it to compare the similarities of two place names.
 *
 * http://en.wikipedia.org/wiki/Levenshtein_distance
 */
function _getLevenshteinDistance(a, b) {
    let i;
    let j;
    let d = [];

    for (i = 0; i <= a.length; i++) {
        d[i] = [];
        for (j = 0; j <= b.length; j++)
            d[i][j] = 0;
    }

    for (i = 1; i <= a.length; i++)
        d[i][0] = i;

    for (j = 1; j <= b.length; j++)
        d[0][j] = j;

    for (j = 1; j <= b.length; j++)
        for (i = 1; i <= a.length; i++)
            if (a[i] === b[j])
                d[i][j] = d[i-1][j-1];
            else
                d[i][j] = Math.min(d[i-1][j] + 1,
                                   d[i][j-1] + 1,
                                   d[i-1][j-1] + 1);

    return d[a.length][b.length];
}

function _normalize(name) {
    return name.toLowerCase().trim().replace(/ +(?= )/g,'');
}

function _getPlacesLevenshteinDistance(geoPlace, socialPlace) {
    let a = geoPlace.name;
    let b = socialPlace.name;

    return _getLevenshteinDistance(_normalize(a), _normalize(b));
}

/**
 * Returns: 0 for bad match, 1 for good match and 2
 * exact match.
 */
function _getKindOfMatch(geoPlace, socialPlace) {
    let distance = geoPlace.location.get_distance_from(socialPlace.location);
    let levenshtein = _getPlacesLevenshteinDistance(geoPlace, socialPlace);

    if (distance < 0.01 && levenshtein <= 2)
        return 2;
    else if (distance < 0.03 && levenshtein <= 5)
        return 1;
    else
        return 0;
}

function match(geoPlace, socialPlaces) {
    let result = {
        exactMatches: [],
        goodMatches: [],
        badMatches: []
    };

    socialPlaces.sort(function(a, b) {
        let da = geoPlace.location.get_distance_from(a.location);
        let db = geoPlace.location.get_distance_from(b.location);

        if (da > db)
            return 1;
        else if (da < db)
            return -1;

        return 0;
    });

    socialPlaces.forEach(function(place) {
        let match = _getKindOfMatch(geoPlace, place);

        switch (match)
        {
        case 0:
            result.badMatches.push(place);
            break;

        case 1:
            result.goodMatches.push(place);
            break;

        case 2:
            result.exactMatches.push(place);
            break;
        }
    });

    return result;
}
