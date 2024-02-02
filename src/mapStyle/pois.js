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

const classMatch = (attr, defaultVal, minzoom, transform) => {
    const matchExpr = ["match", ["get", "class"]];

    transform ??= (x) => x;
    if (typeof minzoom !== "function") {
        const minzoom2 = minzoom;
        minzoom = (x) => x === minzoom2;
    }

    for (const [poiClass, poiSubclasses] of Object.entries(DEFS.pois.classes)) {
        const subMatchExpr = ["match", ["get", "subclass"]];
        const subDefault =
            "_" in poiSubclasses && attr in poiSubclasses["_"]
                ? transform(poiSubclasses["_"][attr])
                : defaultVal;

        for (const [poiSubclass, poiDef] of Object.entries(poiSubclasses)) {
            if (minzoom(poiDef.minzoom)) {
                if (poiSubclass !== "_" && attr in poiDef) {
                    const val = transform(poiDef[attr]);
                    if (
                        val !== defaultVal &&
                        val !== subDefault &&
                        typeof val !== "undefined"
                    ) {
                        subMatchExpr.push(poiSubclass, val);
                    }
                }
            }
        }

        if (subMatchExpr.length > 2) {
            subMatchExpr.push(subDefault);
            matchExpr.push(poiClass, subMatchExpr);
        } else if (subDefault !== defaultVal) {
            matchExpr.push(poiClass, subDefault);
        }
    }

    matchExpr.push(defaultVal);
    if (matchExpr.length > 3) {
        return matchExpr;
    } else {
        return defaultVal;
    }
};

const classFilter = (zoom, isMaxZoom) => {
    const matchExpr = ["match", ["get", "class"]];

    for (const [poiClass, poiSubclasses] of Object.entries(DEFS.pois.classes)) {
        const defaultMinzoom = poiSubclasses["_"]?.minzoom;

        const matching = [];
        for (const [poiSubclass, poiDef] of Object.entries(poiSubclasses)) {
            if (defaultMinzoom === zoom) {
                if (poiDef.minzoom !== zoom) {
                    matching.push(poiSubclass);
                }
            } else {
                if (poiDef.minzoom === zoom) {
                    matching.push(poiSubclass);
                }
            }
        }

        if (matching.length > 0) {
            const filter =
                matching.length === 1
                    ? ["==", ["get", "subclass"], matching[0]]
                    : ["in", ["get", "subclass"], ["literal", matching]];
            if (defaultMinzoom === zoom) {
                matchExpr.push(poiClass, ["!", filter]);
            } else {
                matchExpr.push(poiClass, filter);
            }
        } else if (defaultMinzoom === zoom) {
            matchExpr.push(poiClass, true);
        }
    }

    matchExpr.push(false);

    if (matchExpr.length > 3) {
        return matchExpr;
    } else {
        return false;
    }
};

export const pois = (config) => {
    const result = [];

    const minZoom = Math.min(
        ...Object.values(DEFS.pois.classes)
            .flatMap((v) => Object.values(v).map((v2) => v2.minzoom))
            .filter((v) => v !== undefined)
    );
    const maxZoom = Math.max(
        ...Object.values(DEFS.pois.classes)
            .flatMap((v) => Object.values(v).map((v2) => v2.minzoom))
            .filter((v) => v !== undefined)
    );

    for (let z = maxZoom; z >= minZoom; z--) {
        const filter =
            z === maxZoom
                ? classMatch(
                      "minzoom",
                      true,
                      (zoom) => zoom !== maxZoom,
                      () => false
                  )
                : classFilter(z, z === maxZoom);

        if (!filter) {
            continue;
        }

        const color = classMatch(
            "category",
            config.pick({ dark: "#ffffff", light: "#000000" }),
            z,
            (x) => config.pick(DEFS.pois.colors[x])
        );
        result.push({
            id: "pois-" + z,
            type: "symbol",
            source: "vector-tiles",
            "source-layer": "poi",
            minzoom: z,
            filter,
            layout: {
                "text-anchor": "top",
                "text-field": ["coalesce", localizedName, ["get", "ref"]],
                "text-offset": [0, 0.7],
                "text-font": config.fonts("Italic"),
                "text-size": [
                    "*",
                    config.textSize(12),
                    classMatch("size", 1, z),
                ],
                "text-optional": true,
                "icon-image": classMatch("icon", "circle-small-symbolic", z),
                "icon-size": classMatch("size", 1, z),
                "symbol-sort-key": ["get", "rank"],
            },
            paint: {
                "icon-color": color,
                "text-color": color,
            },
            metadata: {
                "libshumate:cursor": "pointer",
            },
        });
    }

    return result;
};
