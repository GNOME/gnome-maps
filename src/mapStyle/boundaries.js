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

const boundaryLayer = (config, adminLevel, width, disputed) => ({
    id: `boundary-${adminLevel}${disputed ? "-disputed" : ""}`,
    type: "line",
    source: "vector-tiles",
    "source-layer": "boundary",
    filter: [
        "all",
        /* Show disputed maritime boundaries, but not undisputed ones */
        ...(disputed
            ? [["==", "disputed", 1]]
            : [
                  ["!=", "disputed", 1],
                  ["!=", "maritime", 1],
              ]),
        ["==", "admin_level", adminLevel],
    ],
    minzoom: adminLevel - 1,
    layout: {
        "line-join": "round",
        "line-cap": "round",
    },
    paint: {
        "line-color": config.pick(DEFS.colors.boundary),
        "line-dasharray": (disputed ? [6, 54] : [6, 18, 18, 18]).map(
            (x) => x / width
        ),
        "line-width": [
            "interpolate",
            ["exponential", 1.2],
            ["zoom"],
            adminLevel,
            width / 5,
            adminLevel + 14,
            width * 5,
        ],
    },
});

export const boundaryLayers = (config) =>
    Object.entries(DEFS.boundaryWidths)
        .map(([adminLevel, width]) => [
            boundaryLayer(config, parseInt(adminLevel), width, false),
            boundaryLayer(config, parseInt(adminLevel), width, true),
        ])
        .flat();
