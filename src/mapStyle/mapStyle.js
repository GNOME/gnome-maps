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

import { aerial, aerialLabel } from "./aerial.js";
import { airportLayers, airportSymbols } from "./airports.js";
import { boundaryLayers as boundaries } from "./boundaries.js";
import { DEFS } from "./defs.js";
import { landcover } from "./landcover.js";
import { landuse } from './landuse.js';
import { rail } from "./rail.js";
import { highwayShield, junctionSymbol, roadSymbol, roads } from "./roads.js";
import { MapStyleConfig } from "./utils.js";
import {
    ferryLine,
    ferryLineName,
    waterFill,
    waterLine,
    waterName,
    waterNameLine,
    waterwayName,
} from "./water.js";
import { buildings } from "./buildings.js";
import { housenumbers } from "./housenumbers.js";
import { places } from "./places.js";
import { pois } from "./pois.js";

/**
 * Generates the map style using the given options.
 * @param {import("./utils.js").MapStyleConfigParams} options
 * @returns {*}
 */
export function generateMapStyle(options) {
    const config = new MapStyleConfig(options);
    const tileUrlPattern = options.tileUrlPattern ??
                           'https://tileserver.gnome.org/data/v3/{z}/{x}/{y}.pbf';

    const layeredLayers = [];
    for (let layerNum = DEFS.minLayer; layerNum <= DEFS.maxLayer; layerNum++) {
        const filter =
            layerNum == 0
                ? ["any", ["==", ["get", "layer"], 0], ["!", ["has", "layer"]]]
                : ["==", ["get", "layer"], layerNum];

        layeredLayers.push(...roads(config, layerNum, filter));
        layeredLayers.push(...rail(config, layerNum, filter));
        layeredLayers.push(...aerial(config, layerNum, filter));

        if (layerNum === 0) {
            layeredLayers.push(...airportLayers(config));
            layeredLayers.push(...buildings(config));
        }
    }

    const style = {
        version: 8,
        name:
            "GNOME Maps " + (options.colorScheme === "dark" ? "Dark" : "Light"),
        sources: {
            "vector-tiles": {
                type: "vector",
                tiles: [tileUrlPattern],
                minzoom: 0,
                maxzoom: 14,
            },
        },
        /* Not used by libshumate, but necessary for Mapbox GL JS */
        glyphs: "https://tiles.maps.jwestman.net/fonts/{fontstack}/{range}.pbf",
        layers: [
            {
                id: "background",
                type: "background",
                paint: {
                    "background-color": config.pick(DEFS.colors.background),
                },
            },
            landcover(config),
            ...landuse(config),
            waterFill(config),
            waterLine(config),
            ...boundaries(config),
            ...layeredLayers,
            ferryLine(config),
            waterName(config),
            waterNameLine(config),
            waterwayName(config),
            ferryLineName(config),
            housenumbers(config),
            ...pois(config),
            roadSymbol(config),
            junctionSymbol(config),
            ...highwayShield(config),
            aerialLabel(config),
            ...airportSymbols(config),
            ...places(config),
        ],
    };

    return style;
}
