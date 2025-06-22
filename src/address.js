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

/**
 * Translation lookup function for street name and house number.
 * Based on examples from https://en.wikipedia.org/wiki/Address#Address_format
 * Currently don't include address formats for i.e. China and Japan as those
 * formats differ from the Western ones and would need additional handling
 * when printing place addresses (currently we assume there is a street name
 * and house number).
 */
export function streetAddressForCountryCode(streetName, housenumber,
                                            countryCode) {
    switch (countryCode) {
        case 'AI': return `${housenumber} ${streetName}`;
        case 'AL': return `${streetName} ${housenumber}`;
        case 'AR': return `${streetName} ${housenumber}`;
        case 'AS': return `${streetName} ${housenumber}`;
        case 'AT': return `${streetName} ${housenumber}`;
        case 'AU': return `${housenumber} ${streetName}`;
        case 'AX': return `${streetName} ${housenumber}`;
        case 'BA': return `${streetName} ${housenumber}`;
        case 'BD': return `${streetName}. ${housenumber}`;
        case 'BE': return `${streetName} ${housenumber}`;
        case 'BM': return `${housenumber} ${streetName}`;
        case 'BR': return `${streetName}, ${housenumber}`;
        case 'BY': return `${streetName}, д. ${housenumber}`;
        /* if we had access to state codes, we could add a special case for
         * Quebec format
         */
        case 'CA': return `${housenumber} ${streetName}`;
        case 'CH': return `${streetName} ${housenumber}`;
        case 'CL': return `${streetName} No° ${housenumber}`;
        case 'CZ': return `${streetName} ${housenumber}`;
        case 'CY': return `${streetName} ${housenumber}`;
        case 'DE': return `${streetName} ${housenumber}`;
        case 'DK': return `${streetName} ${housenumber}`;
        case 'EE': return `${streetName} ${housenumber}`;
        case 'ES': return `${streetName}, ${housenumber}`;
        case 'FI': return `${streetName} ${housenumber}`;
        case 'FK': return `${housenumber} ${streetName}`;
        case 'FO': return `${streetName} ${housenumber}`;
        case 'FR': return `${housenumber}, ${streetName}`;
        case 'GB': return `${housenumber} ${streetName}`;
        case 'GG': return `${housenumber} ${streetName}`;
        case 'GL': return `${streetName} ${housenumber}`;
        case 'GR': return `${streetName} ${housenumber}`;
        case 'HK': return `${housenumber} ${streetName}`;
        case 'HR': return `${streetName} ${housenumber}`;
        case 'HU': return `${streetName} ${housenumber}`;
        case 'IE': return `${housenumber} ${streetName}`;
        case 'IL': return `${housenumber} ${streetName}`;
        case 'IS': return `${streetName} ${housenumber}`;
        case 'IM': return `${housenumber} ${streetName}`;
        case 'IN': return `${housenumber} ${streetName}`;
        case 'ID': return `${streetName} No. ${housenumber}`;
        case 'IR': return `${streetName} ${housenumber}`;
        case 'IT': return `${streetName} ${housenumber}`;
        case 'IQ': return `${streetName} ${housenumber}`;
        case 'JE': return `${housenumber} ${streetName}`;
        case 'KR': return `${streetName} ${housenumber}`;
        case 'KY': return `${housenumber} ${streetName}`;
        case 'LI': return `${streetName} ${housenumber}`;
        case 'LK': return `${housenumber} ${streetName}`;
        case 'LU': return `${streetName} ${housenumber}`;
        case 'LV': return `${streetName} ${housenumber}`;
        case 'ME': return `${streetName} ${housenumber}`;
        case 'MO': return `${streetName}${housenumber}`;
        case 'MS': return `${housenumber} ${streetName}`;
        case 'MY': return `${housenumber} $1%s`;
        case 'MX': return `${streetName} No. ${housenumber}`;
        case 'NL': return `${streetName} ${housenumber}`;
        case 'NO': return `${streetName} ${housenumber}`;
        case 'NZ': return `${housenumber} ${streetName}`;
        case 'OM': return `${streetName}, ${housenumber}`;
        case 'PE': return `${streetName} ${housenumber}`;
        case 'PH': return `${housenumber} ${streetName}`;
        case 'PN': return `${housenumber} ${streetName}`;
        case 'PK': return `${housenumber}, ${streetName}`;
        case 'PL': return `${streetName} ${housenumber}`;
        case 'PT': return `${streetName} ${housenumber}`;
        case 'PY': return `${streetName} ${housenumber}`;
        case 'RO': return `${streetName}, nr. ${housenumber}`;
        case 'RS': return `${streetName} ${housenumber}`;
        case 'RU': return `${streetName}, д. ${housenumber}`;
        case 'SA': return `${housenumber} ${streetName}`;
        case 'SE': return `${streetName} ${housenumber}`;
        case 'SG': return `${housenumber} ${streetName}`;
        case 'SH': return `${housenumber} ${streetName}`;
        case 'SJ': return `${streetName} ${housenumber}`;
        case 'SK': return `${streetName} ${housenumber}`;
        case 'SL': return `${streetName} ${housenumber}`;
        case 'TC': return `${housenumber} ${streetName}`;
        case 'TR': return `${streetName} ${housenumber}`;
        case 'TW': return `${streetName}, ${housenumber}`;
        case 'UA': return `вул. ${streetName}, буд. ${housenumber}`;
        case 'US': return `${housenumber} ${streetName}`;
        case 'VG': return `${housenumber} ${streetName}`;
        case 'VI': return `${housenumber} ${streetName}`;
        case 'VN': return `số ${housenumber} ${streetName}`;
        default:   return `${housenumber} ${streetName}`;
    }
}

