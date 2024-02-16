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
import { isLinestring, isPoint, mix } from "./utils.js";

export const waterFill = (config) => ({
    id: "water-fill",
    type: "fill",
    source: "vector-tiles",
    "source-layer": "water",
    paint: {
        "fill-color": config.pick(DEFS.colors.water),
    },
});

export const waterLine = (config) => ({
    id: "water-line",
    type: "line",
    source: "vector-tiles",
    "source-layer": "waterway",
    paint: {
        "line-color": config.pick(DEFS.colors.water),
        "line-width": [
            "interpolate",
            ["exponential", 1.5],
            ["zoom"],
            4,
            1,
            14,
            2,
            18,
            8,
        ],
    },
});

const waterLabelSize = (config) => [
    "match",
    ["get", "class"],
    "ocean",
    config.textSize(18),
    "sea",
    config.textSize(16),
    ["river", "lake"],
    config.textSize(14),
    config.textSize(10),
];

const waterLabelColor = (config) => {
    const waterColor = config.pick(DEFS.colors.water);
    if (config.colorScheme === "dark") {
        return mix(waterColor, "#ffffff", 0.6);
    } else {
        return mix(waterColor, "#000000", 0.7);
    }
};

export const waterName = (config) => ({
    id: "water-name",
    type: "symbol",
    source: "vector-tiles",
    "source-layer": "water_name",
    filter: isPoint,
    layout: {
        "text-field": config.localizedName(),
        "text-font": config.fonts(),
        "text-size": waterLabelSize(config),
    },
    paint: {
        "text-color": waterLabelColor(config),
    },
    metadata: {
        "libshumate:cursor": "pointer",
    },
});

export const waterNameLine = (config) => ({
    id: "water-name-line",
    type: "symbol",
    source: "vector-tiles",
    "source-layer": "water_name",
    filter: isLinestring,
    layout: {
        "text-field": config.localizedName(),
        "text-font": config.fonts(),
        "text-size": waterLabelSize(config),
        "symbol-placement": "line",
    },
    paint: {
        "text-color": waterLabelColor(config),
    },
});

export const waterwayName = (config) => ({
    id: "waterway-name",
    type: "symbol",
    source: "vector-tiles",
    "source-layer": "waterway",
    filter: isLinestring,
    layout: {
        "text-field": config.localizedName(),
        "text-font": config.fonts(),
        "text-size": waterLabelSize(config),
        "symbol-placement": "line",
    },
    paint: {
        "text-color": waterLabelColor(config),
    },
    metadata: {
        "libshumate:cursor": "pointer",
    },
});

export const ferryLine = (config) => ({
    id: "ferry-line",
    type: "line",
    source: "vector-tiles",
    "source-layer": "transportation",
    minzoom: 11,
    filter: ["==", ["get", "class"], "ferry"],
    paint: {
        "line-color": waterLabelColor(config),
        "line-dasharray": [5, 3],
        "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.5, 16, 2],
    },
});

export const ferryLineName = (config) => ({
    id: "ferry-line-name",
    type: "symbol",
    source: "vector-tiles",
    "source-layer": "transportation_name",
    minzoom: 11,
    filter: ["==", ["get", "class"], "ferry"],
    layout: {
        "text-field": ["get", "name"],
        "text-font": config.fonts(),
        "text-size": config.textSize(15),
        "symbol-placement": "line",
    },
    paint: {
        "text-color": mix(
            waterLabelColor(config),
            config.colorScheme === "dark" ? "#ffffff" : "#000000",
            0.5
        ),
    },
});
