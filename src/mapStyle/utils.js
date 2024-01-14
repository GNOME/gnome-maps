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

import Adw from "gi://Adw";

/**
 * @typedef {Object} MapStyleConfigParams
 * @property {"dark" | "light"} colorScheme Color scheme
 */

export class MapStyleConfig {
    /**
     * @param {MapStyleConfigParams} options
     */
    constructor(options) {
        this.colorScheme = options.colorScheme ?? "light";
    }

    pick(colorDef) {
        if (typeof colorDef === "undefined") {
            return undefined;
        } else if (
            typeof colorDef.dark === "undefined" &&
            typeof colorDef.light === "undefined"
        ) {
            return colorDef;
        } else {
            return colorDef[this.colorScheme];
        }
    }

    colorMatch(colorDefs, fallback, field) {
        const result = ["match", ["get", field ?? "class"]];
        for (const [key, value] of Object.entries(colorDefs)) {
            if (key.includes(" ")) {
                result.push(key.split(" "));
            } else {
                result.push(key);
            }
            result.push(this.pick(value));
        }
        result.push(this.pick(fallback));
        return result;
    }

    fonts(variant) {
        return ["Cantarell " + (variant ?? "Regular")];
    }

    textSize(size) {
        return Adw.LengthUnit.to_px(Adw.LengthUnit.SP, size, null);
    }
}

export const hexToRgb = (hex) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
];

export const rgbToHex = (rgb) =>
    "#" + rgb.map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");

export const mix = (hex1, hex2, amount) => {
    const rgb1 = hexToRgb(hex1);
    const rgb2 = hexToRgb(hex2);
    return rgbToHex([
        rgb1[0] * amount + rgb2[0] * (1 - amount),
        rgb1[1] * amount + rgb2[1] * (1 - amount),
        rgb1[2] * amount + rgb2[2] * (1 - amount),
    ]);
};

export const isPoint = [
    "in",
    ["geometry-type"],
    ["literal", ["Point", "MultiPoint"]],
];

export const isLinestring = [
    "in",
    ["geometry-type"],
    ["literal", ["LineString", "MultiLineString"]],
];

export const isPolygon = [
    "in",
    ["geometry-type"],
    ["literal", ["Polygon", "MultiPolygon"]],
];

export const locale = [
    "let",
    "locale_tag",
    ["resolved-locale", ["collator", {}]],
    [
        "case",
        ["!=", -1, ["index-of", "-", ["var", "locale_tag"]]],
        [
            "slice",
            ["var", "locale_tag"],
            0,
            ["index-of", "-", ["var", "locale_tag"]],
        ],
        ["var", "locale_tag"],
    ],
];

/* The to-string is necessary in MapLibre GL JS because of how its type coercion works. */
export const localizedName = [
    "to-string",
    [
        "coalesce",
        /* special case for Norwegian (Bokmål "nb" and nynorsk "nn") with the
           fallback language code "no" for names with a common translation:
           https://wiki.openstreetmap.org/wiki/Multilingual_names#Norway */
        [
            "match",
            locale,
            "nb",
            ["coalesce", ["get", "name:nb"], ["get", "name:no"]],
            "nn",
            ["coalesce", ["get", "name:nn"], ["get", "name:no"]],
            ["get", ["concat", "name:", locale]],
        ],
        ["get", "name"],
    ],
];
