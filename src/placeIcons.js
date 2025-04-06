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

import { DEFS } from "./mapStyle/defs.js";
import { Place } from "./place.js";
import { getStationIconForPlace } from './mapStyle/stations.js';

/**
 * Get place icon name suitable for a Place.
 * @param {Place} place A Place object
 * @returns {string} Icon name
 */
export function getIconForPlace(place) {
    const icon =
        DEFS.pois.tags[place.osmKey]?.[place.osmValue]?.[0] ??
        DEFS.pois.tags[place.osmKey]?.["_"]?.[0] ??
        "map-marker-symbolic";

    if (icon === "@sport") {
        return DEFS.pois.sportIcons[place.sport] ?? DEFS.pois.sportIcons._;
    }

    if (icon === "@station") {
        return getStationIconForPlace(place);
    }

    if (icon === "circle-small-symbolic") {
        return "map-marker-symbolic";
    }

    return icon;
}
