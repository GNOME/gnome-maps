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
import { mix } from "./utils.js";

export const buildings = (config) => {
    return [
        {
            id: "buildings",
            type: "fill",
            source: "vector-tiles",
            "source-layer": "building",
            filter: ["!", ["has", "part"]],
            paint: {
                "fill-color": config.pick(DEFS.buildings),
                "fill-opacity": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    13,
                    0.15,
                    14,
                    0.25,
                    18,
                    0.5,
                ],
            },
        },
        {
            id: "buildings-outline",
            type: "line",
            source: "vector-tiles",
            "source-layer": "building",
            minzoom: 15,
            paint: {
                "line-color": mix(
                    config.pick(DEFS.buildings),
                    "#000000",
                    config.colorScheme === "dark" ? 1.33 : 0.75
                ),
                "line-width": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    15,
                    0.05,
                    18,
                    config.colorScheme === "dark" ? 1 : 0.5,
                ],
            },
        },
    ];
};
