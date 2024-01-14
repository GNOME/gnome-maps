/*
 * Copyright (C) 2023 James Westman <james@jwestman.net>
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, see <https://www.gnu.org/licenses/>.
 */

import { DEFS } from "./defs.js";
import { localizedName } from "./utils.js";

export const places = (config) =>
    DEFS.places.map((place) => ({
        id: `place-${place.classes[0]}`,
        type: "symbol",
        source: "vector-tiles",
        "source-layer": "place",
        minzoom: place.minzoom,
        maxzoom: place.maxzoom,
        filter: ["in", ["get", "class"], ["literal", place.classes]],
        layout: {
            "text-font": config.fonts(place.font),
            "text-field": localizedName,
            "text-transform": place.textTransform,
            "text-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                ...place.sizeStops.flatMap(([stop, size]) => [
                    stop,
                    config.textSize(size),
                ]),
            ],
        },
        paint: {
            "text-color": config.pick(place.color),
        },
    }));
