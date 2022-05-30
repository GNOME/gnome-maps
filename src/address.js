/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2019 Marcus Lundblad.
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
 * Author: Marcus Lundblad <ml@update.uu.se>
 */

/**
 * Utility functions for address formatting.
 */

const Format = imports.format;

/**
 * Translation lookup table for street name and house number.
 * First argument is the street name and the second the housenumber.
 * Based on examples from https://en.wikipedia.org/wiki/Address#Address_format
 * Currently don't include address formats for i.e. China and Japan as those
 * formats differ from the Western ones and would need additional handling
 * when printing place addresses (currently we assume there is a street name
 * and house number).
 */
const FORMAT_MAP = {
    'AI': '%2$s %1$s',
    'AL': '%1$s %2$s̈́',
    'AR': '%1$s %2$s',
    'AS': '%1$s %2$s',
    'AU': '%2$s %1$s',
    'AX': '%1$s %2$s',
    'BA': '%1$s %2$s',
    'BD': '%1$s. %2$s',
    'BE': '%1$s %2$s',
    'BM': '%2$s %1$s',
    'BR': '%1$s, %2$s',
    'BY': '%1$s, д. %2$s',
    /* if we had access to state codes, we could add a special case for
     * Quebec format
     */
    'CA': '%2$s %1$s',
    'CH': '%1$s %2$s',
    'CL': '%1$s No° %2$s',
    'CZ': '%1$s %2$s',
    'CY': '%1$s %2$s',
    'DE': '%1$s %2$s',
    'DK': '%1$s %2$s',
    'EE': '%1$s %2$s',
    'ES': '%1$s, %2$s',
    'FI': '%1$s %2$s',
    'FK': '%2$s %1$s',
    'FO': '%1$s %2$s',
    'FR': '%2$s, %1$s',
    'GB': '%2$s %1$s',
    'GG': '%2$s %1$s',
    'GL': '%1$s %2$s',
    'GR': '%1$s %2$s',
    'HK': '%2$s %1$s',
    'HR': '%1$s %2$s',
    'HU': '%1$s %2$s',
    'IE': '%2$s %1$s',
    'IL': '%2$s %1$s',
    'IS': '%1$s %2$s',
    'IM': '%2$s %1$s',
    'IN': '%2$s %1$s',
    'ID': '%1$s No. %2$s',
    'IR': '%1$s %2$s',
    'IT': '%1$s %2$s',
    'IQ': '%1$s %2$s',
    'JE': '%2$s %1$s',
    'KR': '%1$s %2$s',
    'KY': '%2$s %1$s',
    'LI': '%1$s %2$s',
    'LK': '%2$s %1$s',
    'LU': '%1$s %2$s',
    'LV': '%1$s %2$s',
    'ME': '%1$s %2$s',
    'MO': '%1$s%2$s',
    'MS': '%2$s %1$s',
    'MY': '%2$s $1%s',
    'MX': '%1$s No. %2$s',
    'NL': '%1$s %2$s',
    'NO': '%1$s %2$s',
    'NZ': '%2$s %1$s',
    'OM': '%1$s, %2$s',
    'PE': '%1$s %2$s',
    'PH': '%2$s %1$s',
    'PN': '%2$s %1$s',
    'PK': '%2$s, %1$s',
    'PL': '%1$s %2$s',
    'PT': '%1$s %2$s',
    'RO': '%1$s, nr. %2$s',
    'RS': '%1$s %2$s',
    'RU': '%1$s, д. %2$s',
    'SA': '%2$s %1$s',
    'SE': '%1$s %2$s',
    'SG': '%2$s %1$s',
    'SH': '%2$s %1$s',
    'SJ': '%1$s %2$s',
    'SK': '%1$s %2$s',
    'SL': '%1$s %2$s',
    'TC': '%2$s %1$s',
    'TR': '%1$s %2$s',
    'TW': '%1$s, %2$s̈́',
    'UA': 'вул. %1$s, буд. %2$s',
    'US': '%2$s %1$s',
    'VG': '%2$s %1$s',
    'VI': '%2$s %1$s',
    'VN': 'số %2$s %1$s'
}

export function streetAddressForCountryCode(streetName, housenumber, countryCode) {
    let format = FORMAT_MAP[countryCode];

    if (format)
        return Format.vprintf(format, [streetName, housenumber]);
    else
        return Format.vprintf('%s %s', [housenumber, streetName]);
}
