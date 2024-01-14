/*
 * Copyright (C) 2023 Marcus Lundblad <ml@dfupdate.se>
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

/* Aerailway transport: https://wiki.openstreetmap.org/wiki/Map_features#Aerialway */

const cableCarFilter = [
    "all",
    ["==", ["get", "class"], "aerialway"],
    [
        "in",
        ["get", "subclass"],
        ["literal", ["cable_car", "gondola", "mixed_lift"]],
    ],
];

const liftFilter = [
    "all",
    ["==", ["get", "class"], "aerialway"],
    [
        "in",
        ["get", "subclass"],
        [
            "literal",
            [
                "chair_lift",
                "drag_lift",
                "t-bar",
                "j-bar",
                "platter",
                "rope_tow",
                "zip-line",
            ],
        ],
    ],
];

export const aerial = (config, layerNum, layerFilter) => {
    const color = config.pick(DEFS.aerial.color);

    return [
        {
            id: `cable-car-${layerNum}`,
            type: "line",
            source: "vector-tiles",
            "source-layer": "transportation",
            filter: ["all", layerFilter, cableCarFilter],
            paint: {
                "line-color": color,
                "line-width": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    8,
                    0.25,
                    13,
                    0.5,
                    16,
                    2,
                ],
            },
        },
        {
            id: `cable-car-${layerNum}-ties`,
            type: "line",
            source: "vector-tiles",
            "source-layer": "transportation",
            minzoom: 13,
            filter: ["all", layerFilter, cableCarFilter],
            paint: {
                "line-color": color,
                "line-dasharray": [0.3, 5],
                "line-width": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    13,
                    2,
                    16,
                    10,
                ],
            },
        },
        {
            id: `lift-${layerNum}`,
            type: "line",
            source: "vector-tiles",
            "source-layer": "transportation",
            filter: ["all", layerFilter, liftFilter],
            paint: {
                "line-color": color,
                "line-width": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    8,
                    0.25,
                    13,
                    0.5,
                    16,
                    2,
                ],
            },
        },
        {
            id: `lift-${layerNum}-ties`,
            type: "line",
            source: "vector-tiles",
            "source-layer": "transportation",
            minzoom: 13,
            filter: ["all", liftFilter, layerFilter],
            paint: {
                "line-color": color,
                "line-dasharray": [0.3, 10],
                "line-width": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    13,
                    2,
                    16,
                    10,
                ],
            },
        },
    ];
};

export const aerialLabel = (config) => {
    const color = config.pick(DEFS.aerial.color);
    const labelColor =
        config.colorScheme === "dark"
            ? mix(color, "#ffffff", 0.3)
            : mix(color, "#000000", 0.6);

    return {
        id: "aerial-labels",
        type: "symbol",
        source: "vector-tiles",
        "source-layer": "transportation_name",
        minzoom: 13,
        filter: ["any", cableCarFilter, liftFilter],
        layout: {
            "text-field": ["get", "name"],
            "text-size": config.textSize(15),
            "text-font": config.fonts(),
            "symbol-placement": "line",
        },
        paint: {
            "text-color": labelColor,
        },
    };
};
