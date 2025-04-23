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

/**
 * @typedef {Object} MapStyleConfigParams
 * @property {"dark" | "light"} [colorScheme] Color scheme
 * @property {"libshumate" | "maplibre-gl-js"} [renderer] Renderer to target
 * @property {number} [textScale] Text scale factor
 * @property {string} [language] Language code
 */

export class MapStyleConfig {
    /**
     * @param {MapStyleConfigParams} options
     */
    constructor(options) {
        this.colorScheme = options.colorScheme ?? "light";
        this.renderer = options.renderer ?? "libshumate";
        this.textScale = options.textScale ?? 1;
        this.language = options.language;
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
        if (this.renderer === "libshumate") {
            return ["Adwaita Sans " + (variant ?? "Regular")];
        } else {
            /* Use Noto Sans when targeting MapLibre GL JS because it's
               more commonly available in SDF format. */
            return ["Noto Sans " + (variant ?? "Regular")];
        }
    }

    textSize(size) {
        return size * this.textScale;
    }

    localizedName() {
        let localeExpr;
        switch (this.language) {
            case undefined:
                /* Fallback for exporting the style as JSON. */
                localeExpr = ["get", ["concat", "name:", ["slice", ["resolved-locale", ["collator", {}]], 0, 2]]];
                break;
            case "nb":
            case "nn":
                /* special case for Norwegian (Bokmål "nb" and nynorsk "nn") with the
                    fallback language code "no" for names with a common translation:
                    https://wiki.openstreetmap.org/wiki/Multilingual_names#Norway */
                localeExpr = ["coalesce", ["get", "name:" + this.language], ["get", "name:no"]];
                break;
            default:
                localeExpr = ["get", "name:" + this.language];
                break;
        }

        return [
            "to-string",
            [
                "coalesce",
                localeExpr,
                ["get", "name"],
            ],
        ];
    }

    filter(place) {
      const classExpression =
        ["in", ["get", "class"], ["literal", place.classes]];

      if (place.maxRank) {
        return ["all", ["<=", ["get", "rank"], place.maxRank], classExpression];
      } else {
        return classExpression;
      }
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
