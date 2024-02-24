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

import Gio from 'gi://Gio';

import { DEFS } from "./defs.js";
import {
    MapStyleConfig,
    isLinestring,
    isPolygon,
    mix,
} from "./utils.js";

const allClasses = ["path", ...DEFS.roads.flatMap((r) => r.classes)];

/**
 *
 * @param {MapStyleConfig} config
 * @param {number} layerNum
 * @param {*} layerFilter
 */
export function roads(config, layerNum, layerFilter) {
    const casings = [];
    const surfaces = [];

    const stops = (size, casingWidth) => [
        5,
        0.15 * size,
        9,
        0.35 * size,
        12,
        0.65 * size + casingWidth * 0.25,
        14,
        1 * size + casingWidth * 0.45,
        16,
        2 * size + casingWidth * 0.75,
        18,
        8 * size + casingWidth,
        19,
        20 * size + casingWidth,
        20,
        40 * size + casingWidth,
        21,
        80 * size + casingWidth,
        22,
        160 * size + casingWidth,
    ];

    const road = (name, filter, color, size, casingMinZoom, casingScale) => {
        size ??= 1;
        casingMinZoom ??= 12;
        casingScale ??= 1;

        color = config.pick(color);
        casingMinZoom = config.pick(casingMinZoom);

        const roadStops = (casingWidth, fill) =>
            stops(fill ? 0 : size, casingWidth * casingScale);

        const casing = (
            alt,
            casingFilter,
            color,
            lineCap,
            stopWidth,
            dashArray
        ) => {
            for (const [geometryTypes, geometrySuffix] of [
                [["LineString", "MultiLineString"], ""],
                [["Polygon", "MultiPolygon"], "-fill"],
            ]) {
                casings.push({
                    id: `${name}-${layerNum}${alt}${geometrySuffix}-casing`,
                    type: "line",
                    source: "vector-tiles",
                    "source-layer": "transportation",
                    minzoom: casingMinZoom,
                    filter: [
                        "all",
                        layerFilter,
                        filter,
                        casingFilter,
                        ["in", ["geometry-type"], ["literal", geometryTypes]],
                        ["!=", ["get", "surface"], "unpaved"],
                    ],
                    layout: {
                        "line-cap": lineCap,
                    },
                    paint: {
                        "line-color": config.pick(color),
                        "line-width": [
                            "interpolate",
                            ["exponential", 1.2],
                            ["zoom"],
                            ...roadStops(stopWidth, geometrySuffix === "-fill"),
                        ],
                        "line-dasharray": dashArray,
                    },
                });
            }
        };

        const mixColor = config.colorScheme === "dark" ? "#ffffff" : "#000000";

        const casingColor = mix(color, mixColor, 0.9);

        casing("", ["!", ["has", "brunnel"]], casingColor, "round", 3);
        casing(
            "-bridge",
            ["==", ["get", "brunnel"], "bridge"],
            mix(color, mixColor, 0.75),
            "butt",
            4
        );
        casing(
            "-tunnel",
            ["==", ["get", "brunnel"], "tunnel"],
            config.colorScheme === "dark"
                ? mix(color, "#ffffff", 0.7)
                : mix(color, "#000000", 0.8),
            "butt",
            4,
            [0.5, 0.25]
        );

        surfaces.push({
            id: `${name}-${layerNum}-unpaved-casing`,
            type: "line",
            source: "vector-tiles",
            "source-layer": "transportation",
            minzoom: 5,
            filter: [
                "all",
                isLinestring,
                layerFilter,
                filter,
                ["==", ["get", "surface"], "unpaved"],
            ],
            layout: {
                "line-cap": "round",
            },
            paint: {
                "line-color": casingColor,
                "line-width": [
                    "interpolate",
                    ["exponential", 1.2],
                    ["zoom"],
                    ...roadStops(size * 1.3, false),
                ],
                "line-dasharray": [1.5 / 1.3, 2 / 1.3],
            },
        });

        const surfaceColor = [
            "case",
            ["!=", ["get", "brunnel"], "tunnel"],
            color,
            config.colorScheme === "dark"
                ? mix(color, "#ffffff", 0.85)
                : mix(color, "#ffffff", 0.7),
        ];

        surfaces.push({
            id: `${name}-${layerNum}`,
            type: "line",
            source: "vector-tiles",
            "source-layer": "transportation",
            minzoom: 5,
            filter: [
                "all",
                isLinestring,
                layerFilter,
                filter,
                ["!=", ["get", "surface"], "unpaved"],
            ],
            layout: {
                "line-cap": "round",
            },
            paint: {
                "line-color": surfaceColor,
                "line-width": [
                    "interpolate",
                    ["exponential", 1.2],
                    ["zoom"],
                    ...stops(size, 0),
                ],
            },
        });

        surfaces.push({
            id: `${name}-${layerNum}-unpaved`,
            type: "line",
            source: "vector-tiles",
            "source-layer": "transportation",
            minzoom: 5,
            filter: [
                "all",
                isLinestring,
                layerFilter,
                filter,
                ["==", ["get", "surface"], "unpaved"],
            ],
            layout: {
                "line-cap": "round",
            },
            paint: {
                "line-color": surfaceColor,
                "line-width": [
                    "interpolate",
                    ["exponential", 1.2],
                    ["zoom"],
                    ...stops(size, 0),
                ],
                "line-dasharray": [1.5, 2],
            },
        });

        surfaces.push({
            id: `${name}-${layerNum}-fill`,
            type: "fill",
            source: "vector-tiles",
            "source-layer": "transportation",
            filter: ["all", isPolygon, layerFilter, filter],
            paint: {
                "fill-color": surfaceColor,
            },
        });
    };

    for (const roadDef of DEFS.roads) {
        const filter = roadDef.subclass
            ? [
                  "all",
                  ["in", ["get", "class"], ["literal", roadDef.classes]],
                  ["in", ["get", "subclass"], ["literal", roadDef.subclass]],
              ]
            : ["in", ["get", "class"], ["literal", roadDef.classes]];

        road(
            roadDef.subclass?.[0] ?? roadDef.classes[0],
            filter,
            roadDef.color,
            roadDef.size,
            roadDef.casingMinZoom,
            roadDef.casingScale
        );
    }

    surfaces.push({
        id: `path-${layerNum}`,
        type: "line",
        source: "vector-tiles",
        "source-layer": "transportation",
        filter: [
            "all",
            isLinestring,
            layerFilter,
            ["==", ["get", "class"], "path"],
            ["!=", ["get", "subclass"], "pedestrian"],
            ["!=", ["get", "subclass"], "platform"],
            ["!=", ["get", "surface"], "unpaved"],
        ],
        paint: {
            "line-color": config.pick(DEFS.paths.color),
            "line-width": [
                "interpolate",
                ["exponential", 1.2],
                ["zoom"],
                ...stops(DEFS.paths.size, 0),
            ],
        },
    });

    surfaces.push({
        id: `path-${layerNum}-unpaved`,
        type: "line",
        source: "vector-tiles",
        "source-layer": "transportation",
        filter: [
            "all",
            isLinestring,
            layerFilter,
            ["==", ["get", "class"], "path"],
            ["!=", ["get", "subclass"], "pedestrian"],
            ["!=", ["get", "subclass"], "platform"],
            ["==", ["get", "surface"], "unpaved"],
        ],
        layout: {
            "line-cap": "round",
        },
        paint: {
            "line-color": config.pick(DEFS.paths.color),
            "line-width": [
                "interpolate",
                ["exponential", 1.2],
                ["zoom"],
                ...stops(DEFS.paths.size, 0),
            ],
            "line-dasharray": [3, 3],
        },
    });

    surfaces.push({
        id: `path-${layerNum}-platform`,
        type: "fill",
        source: "vector-tiles",
        "source-layer": "transportation",
        filter: [
            "all",
            isPolygon,
            layerFilter,
            ["==", ["get", "class"], "path"],
            ["==", ["get", "subclass"], "platform"],
        ],
        paint: {
            "fill-color": config.pick(DEFS.platforms.color),
        },
    });

    surfaces.push({
        id: `path-${layerNum}-fill`,
        type: "fill",
        source: "vector-tiles",
        "source-layer": "transportation",
        filter: [
            "all",
            isPolygon,
            layerFilter,
            ["==", ["get", "class"], "path"],
            ["!=", ["get", "subclass"], "pedestrian"],
            ["!=", ["get", "subclass"], "platform"],
        ],
        paint: {
            "fill-color": config.pick(DEFS.paths.color),
        },
    });

    const oneway = {
        id: `oneway-${layerNum}`,
        type: "symbol",
        source: "vector-tiles",
        "source-layer": "transportation",
        minzoom: 16,
        filter: [
            "all",
            layerFilter,
            isLinestring,
            ["in", ["get", "class"], ["literal", allClasses]],
            ["in", ["get", "oneway"], ["literal", [1, -1]]],
        ],
        layout: {
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "symbol-placement": "line",
            "symbol-spacing": 350,
            "icon-image": "arrow1-right-symbolic",
            "icon-rotate": ["match", ["get", "oneway"], 1, 0, 180],
            "icon-size": [
                "let",
                "base",
                [
                    "match",
                    ["get", "class"],
                    ["motorway", "trunk", "primary"],
                    0.75,
                    ["secondary", "tertiary"],
                    0.6,
                    0.5,
                ],
                [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    14,
                    ["*", ["var", "base"], 0.75],
                    16,
                    ["*", ["var", "base"], 1.25],
                ],
            ],
        },
        paint: {
            "icon-color": config.pick(DEFS.colors.light1),
            "icon-opacity": 0.25,
        },
    };

    return [...casings, ...surfaces, oneway];
}

export const roadSymbol = (config) => ({
    id: "highway-name",
    type: "symbol",
    source: "vector-tiles",
    "source-layer": "transportation_name",
    minzoom: 10,
    filter: ["in", ["get", "class"], ["literal", allClasses]],
    layout: {
        "text-field": config.localizedName(),
        "text-font": config.fonts(),
        "text-size": config.textSize(12),
        "symbol-placement": "line",
    },
    paint: {
        "text-color": config.pick(DEFS.colors.foreground),
    },
});

export const junctionSymbol = (config) => ({
    id: "junction",
    type: "symbol",
    source: "vector-tiles",
    "source-layer": "transportation_name",
    minzoom: 12,
    filter: [
        "all",
        ["has", "ref"],
        ["==", ["get", "subclass"], "junction"],
        ["in", ["get", "class"], ["literal", allClasses]],
    ],
    layout: {
        "icon-image": "arrow2-top-right-symbolic",
        "text-anchor": "left",
        "text-field": ["get", "ref"],
        "text-font": config.fonts("Bold"),
        "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13,
            config.textSize(8),
            16,
            config.textSize(12),
        ],
        "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13,
            config.textSize(0.5),
            16,
            config.textSize(0.75),
        ],
        "text-offset": [0.7, 0],
    },
    paint: {
        "icon-color": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13,
            config.pick({ dark: "#deddda", light: "#5e5c64" }),
            16,
            config.pick({ dark: "#ffffff", light: "#000000" }),
        ],
        "text-color": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13,
            config.pick({ dark: "#deddda", light: "#5e5c64" }),
            16,
            config.pick({ dark: "#ffffff", light: "#000000" }),
        ],
    },
});

export const highwayShield = (config) => {
    if (config.renderer === "maplibre-gl-js") {
        return [];
    } else {
        const [_status1, shieldLayerFile] = Gio.file_new_for_uri('resource://org/gnome/Maps/shields/layer.json').load_contents(null);
        return [JSON.parse(new TextDecoder('utf-8').decode(shieldLayerFile))];
    }
};
