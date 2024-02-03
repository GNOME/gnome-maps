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

export const landcover = (config) => ({
    id: "landcover",
    type: "fill",
    source: "vector-tiles",
    "source-layer": "landcover",
    filter: ["in", ["get", "class"], ["literal", Object.keys(DEFS.landcover)]],
    paint: {
        "fill-color": [
            "interpolate",
            ["exponential", 1.5],
            ["zoom"],
            7,
            config.pick(DEFS.colors.background),
            10,
            config.colorMatch(DEFS.landcover, "transparent"),
        ],
    },
});
