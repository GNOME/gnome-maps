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

const classMatch = (transform, defaultVal) => {
    const matchExpr = ["match", ["coalesce", ["get", "tag"], ["get", "class"]]];

    for (const [poiClass, poiSubclasses] of Object.entries(DEFS.pois.tags)) {
        const subMatchExpr = [
            "match",
            ["coalesce", ["get", "subtag"], ["get", "subclass"]],
        ];
        const subDefaultVal = transform(poiSubclasses._) ?? defaultVal;

        for (const [poiSubclass, poiDef] of Object.entries(poiSubclasses)) {
            if (poiSubclass !== "_") {
                const val = transform(poiDef) ?? defaultVal;
                if (val !== subDefaultVal) {
                    subMatchExpr.push(poiSubclass, val);
                }
            }
        }

        if (subMatchExpr.length > 2) {
            subMatchExpr.push(subDefaultVal);
            matchExpr.push(poiClass, subMatchExpr);
        } else if (subDefaultVal !== defaultVal) {
            matchExpr.push(poiClass, subDefaultVal);
        }
    }

    matchExpr.push(defaultVal);
    if (matchExpr.length > 3) {
        return matchExpr;
    } else {
        return defaultVal;
    }
};

const getIcon = (def) => def?.[0];
const getCategory = (def) => def?.[1];
const getMinzoom = (def) => (def === false ? 100 : def?.[2] ?? 15);
const getSize = (def) => def?.[3];

export const pois = (config) => {
    const color = classMatch(
        (x) => config.pick(DEFS.pois.colors[getCategory(x)]),
        config.pick(DEFS.pois.colors.generic)
    );

    return [
        {
            id: "pois",
            type: "symbol",
            source: "vector-tiles",
            "source-layer": "poi",
            filter: [">=", ["zoom"], classMatch(getMinzoom, 16, () => true)],
            layout: {
                "text-anchor": "top",
                "text-offset": [0, 0.7],
                "text-field": ["coalesce", localizedName, ["get", "ref"]],
                "text-font": config.fonts("Italic"),
                "text-size": ["*", config.textSize(12), classMatch(getSize, 1)],
                "text-optional": true,
                "icon-image": [
                    "let",
                    "icon",
                    classMatch(getIcon, "circle-small-symbolic"),
                    [
                        "match",
                        ["var", "icon"],
                        "@sport",
                        [
                            "match",
                            ["get", "subclass"],
                            ...Object.entries(DEFS.pois.sportIcons)
                                .filter((x) => x[0] !== "_")
                                .flat(),
                            DEFS.pois.sportIcons._,
                        ],
                        ["var", "icon"],
                    ],
                ],
                "icon-size": classMatch(getSize, 1),
                "symbol-sort-key": ["get", "rank"],
            },
            paint: {
                "icon-color": color,
                "text-color": color,
            },
            metadata: {
                "libshumate:cursor": "pointer",
            },
        },
    ];
};
