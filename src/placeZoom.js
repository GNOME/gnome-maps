/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2021 Marcus Lundblad
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

const TYPE_ZOOM_MAP = {
    amenity: {
        _:           17
    },
    highway: {
        bus_stop:    17,
        motorway_junction: 15,
        rest_area:   17,
        services:    17
    },
    place: {
        continent:    4,
        ocean:        4,
        sea:          5,
        country:      6,
        state:        7,
        region:       8,
        province:     8,
        county:       8,
        municipality: 8,
        island:       9,
        city:        10,
        town:        12,
        borough:     12,
        village:     15,
        suburb:      15,
        hamlet:      15,
        islet:       16,
        _:           17

    },
    railway: {
        halt:        16,
        station:     14,
        tram_stop:   16
    },
    shop: {
        _:           17
    }
}

/**
 * Get default zoom level for a given place, if one is defined
 * otherwise return undefined, in which case the maximum zoom level
 * (as defined by the map source) could be used.
 */
export function getZoomLevelForPlace(place) {
    return TYPE_ZOOM_MAP?.[place.osmKey]?.[place.osmValue] ??
           TYPE_ZOOM_MAP?.[place.osmKey]?.['_'];
}
