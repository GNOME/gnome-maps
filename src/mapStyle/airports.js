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
import { isLinestring, isPolygon, mix } from "./utils.js";

export const airportLayers = (config) => {
    const color = [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        mix(
            config.pick(DEFS.airports.runwayColor),
            config.pick(DEFS.colors.background),
            0.5
        ),
        12,
        config.pick(DEFS.airports.runwayColor),
    ];

    return [
        {
            id: "runway-line",
            type: "line",
            source: "vector-tiles",
            "source-layer": "aeroway",
            minzoom: 10,
            filter: ["all", isLinestring, ["==", ["get", "class"], "runway"]],
            paint: {
                "line-color": color,
                "line-width": [
                    "interpolate",
                    ["exponential", 2],
                    ["zoom"],
                    10,
                    4,
                    18,
                    100,
                ],
            },
        },
        {
            id: "taxiway-line",
            type: "line",
            source: "vector-tiles",
            "source-layer": "aeroway",
            minzoom: 10,
            filter: ["all", isLinestring, ["==", ["get", "class"], "taxiway"]],
            paint: {
                "line-color": color,
                "line-width": [
                    "interpolate",
                    ["exponential", 2],
                    ["zoom"],
                    10,
                    2,
                    18,
                    10,
                ],
            },
        },
        {
            id: "runway-fill",
            type: "fill",
            source: "vector-tiles",
            "source-layer": "aeroway",
            minzoom: 12,
            filter: [
                "all",
                isPolygon,
                ["in", ["get", "class"], ["literal", ["runway", "taxiway"]]],
            ],
            paint: {
                "fill-color": color,
            },
        },
    ];
};

export const airportSymbols = (config) => {
    const commonLayout = {
        "icon-image": DEFS.pois.tags.aeroway.aerodrome[0],
        "text-size": 12,
        "text-anchor": "top",
        "text-offset": [0, 0.7],
    };
    const commonPaint = {
        "icon-color": config.pick(DEFS.airports.symbolColor),
        "text-color": config.pick(DEFS.airports.symbolColor),
    };
    const minorAirportFilter = [
        "any",
        ["!", ["has", "name"]],
        ["!", ["has", "iata"]],
        ["!", ["has", "icao"]],
        ["==", ["get", "class"], "private"],
    ];

    return [
        {
            id: "airport-gate",
            type: "symbol",
            source: "vector-tiles",
            "source-layer": "aeroway",
            minzoom: 15,
            filter: ["==", ["get", "class"], "gate"],
            layout: {
                "text-field": ["get", "ref"],
                "text-font": config.fonts("Bold"),
                "text-size": 12,
            },
            paint: {
                "text-color": config.pick(DEFS.airports.symbolColor),
            },
            metadata: {
                "libshumate:cursor": "pointer",
            },
        },
        {
            id: "minor-airport-short-label",
            type: "symbol",
            source: "vector-tiles",
            "source-layer": "aerodrome_label",
            minzoom: 13,
            filter: minorAirportFilter,
            layout: {
                ...commonLayout,
                "text-field": ["coalesce", ["get", "iata"], ["get", "icao"]],
                "text-font": config.fonts("Italic"),
                "text-optional": true,
            },
            paint: commonPaint,
            metadata: {
                "libshumate:cursor": "pointer",
            },
        },
        {
            id: "minor-airport-label",
            type: "symbol",
            source: "vector-tiles",
            "source-layer": "aerodrome_label",
            minzoom: 13,
            filter: minorAirportFilter,
            layout: {
                ...commonLayout,
                "text-field": config.localizedName(),
            },
            paint: commonPaint,
            metadata: {
                "libshumate:cursor": "pointer",
            },
        },
        {
            id: "airport-short-label",
            type: "symbol",
            source: "vector-tiles",
            "source-layer": "aerodrome_label",
            minzoom: 13,
            filter: ["!", minorAirportFilter],
            layout: {
                ...commonLayout,
                "text-field": ["coalesce", ["get", "iata"], ["get", "icao"]],
                "text-font": config.fonts("Italic"),
                "text-optional": true,
            },
            paint: commonPaint,
            metadata: {
                "libshumate:cursor": "pointer",
            },
        },
        {
            id: "airport-label",
            type: "symbol",
            source: "vector-tiles",
            "source-layer": "aerodrome_label",
            minzoom: 13,
            filter: ["!", minorAirportFilter],
            layout: {
                ...commonLayout,
                "text-field": config.localizedName(),
            },
            paint: commonPaint,
            metadata: {
                "libshumate:cursor": "pointer",
            },
        },
    ];
};
