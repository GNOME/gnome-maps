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

export const rail = (config, layerNum, layerFilter) => {
    const color = config.pick(DEFS.rail.color);
    const tunnelColor = mix(color, config.pick(DEFS.colors.background), 0.7);
    const bridgeColor = mix(color, "#000000", 0.75);

    const lightRailFilter = [
        "any",
        [
            "all",
            ["==", ["get", "class"], "rail"],
            ["!=", ["get", "subclass"], "rail"],
        ],
        [
            "all",
            ["==", ["get", "class"], "transit"],
            [
                "in",
                ["get", "subclass"],
                ["literal", ["light_rail", "monorail", "funicular", "tram"]],
            ],
        ],
    ];

    const lightRailWidth = [
        "interpolate",
        ["linear"],
        ["zoom"],
        8,
        0.25,
        13,
        0.5,
        16,
        2,
    ];

    const heavyRailFilter = [
        "all",
        [
            "any",
            [
                "all",
                ["==", ["get", "class"], "rail"],
                ["==", ["get", "subclass"], "rail"],
            ],
            [
                "all",
                ["==", ["get", "class"], "transit"],
                ["==", ["get", "subclass"], "subway"],
            ],
        ],
        ["!=", ["get", "service"], "yard"],
    ];

    return [
        {
            id: `light-rail-${layerNum}-bridge-casing`,
            type: "line",
            source: "vector-tiles",
            "source-layer": "transportation",
            filter: [
                "all",
                layerFilter,
                lightRailFilter,
                ["==", ["get", "brunnel"], "bridge"],
            ],
            paint: {
                "line-color": bridgeColor,
                "line-width": lightRailWidth,
            },
        },
        {
            id: `light-rail-${layerNum}`,
            type: "line",
            source: "vector-tiles",
            "source-layer": "transportation",
            filter: [
                "all",
                layerFilter,
                lightRailFilter,
                ["!=", ["get", "brunnel"], "tunnel"],
            ],
            paint: {
                "line-color": color,
                "line-width": lightRailWidth,
            },
        },
        {
            id: `light-rail-${layerNum}-tunnel`,
            type: "line",
            source: "vector-tiles",
            "source-layer": "transportation",
            filter: [
                "all",
                layerFilter,
                lightRailFilter,
                ["==", ["get", "brunnel"], "tunnel"],
            ],
            paint: {
                "line-color": tunnelColor,
                "line-dasharray": [1, 0.5],
                "line-width": lightRailWidth,
            },
        },
        {
            id: `light-rail-${layerNum}-ties`,
            type: "line",
            source: "vector-tiles",
            "source-layer": "transportation",
            minzoom: 13,
            filter: ["all", layerFilter, lightRailFilter],
            paint: {
                "line-color": [
                    "case",
                    ["==", ["get", "brunnel"], "tunnel"],
                    tunnelColor,
                    color,
                ],
                "line-dasharray": [0.3, 1.5],
                "line-width": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    13,
                    0.5,
                    16,
                    4,
                ],
            },
        },
        {
            id: `heavy-rail-${layerNum}-bridge-casing`,
            type: "line",
            source: "vector-tiles",
            "source-layer": "transportation",
            minzoom: 13,
            filter: [
                "all",
                layerFilter,
                heavyRailFilter,
                ["==", ["get", "brunnel"], "bridge"],
            ],
            paint: {
                "line-color": bridgeColor,
                "line-width": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    14,
                    0.5,
                    16,
                    8,
                ],
            },
        },
        {
            id: `heavy-rail-${layerNum}`,
            type: "line",
            source: "vector-tiles",
            "source-layer": "transportation",
            filter: [
                "all",
                layerFilter,
                heavyRailFilter,
                ["!=", ["get", "brunnel"], "tunnel"],
            ],
            paint: {
                "line-color": color,
                "line-width": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    14,
                    0.5,
                    16,
                    4,
                ],
            },
        },
        {
            id: `heavy-rail-${layerNum}-tunnel`,
            type: "line",
            source: "vector-tiles",
            "source-layer": "transportation",
            filter: [
                "all",
                layerFilter,
                heavyRailFilter,
                ["==", ["get", "brunnel"], "tunnel"],
            ],
            paint: {
                "line-color": tunnelColor,
                "line-dasharray": [2, 0.5],
                "line-width": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    14,
                    0.5,
                    16,
                    4,
                ],
            },
        },
        {
            id: `heavy-rail-${layerNum}-ties`,
            type: "line",
            source: "vector-tiles",
            "source-layer": "transportation",
            minzoom: 14,
            filter: [
                "all",
                heavyRailFilter,
                layerFilter,
                ["!=", ["get", "brunnel"], "tunnel"],
            ],
            paint: {
                "line-color": config.pick(DEFS.colors.background),
                "line-dasharray": [2, 2],
                "line-width": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    14,
                    0.25,
                    16,
                    2,
                ],
            },
        },
    ];
};
