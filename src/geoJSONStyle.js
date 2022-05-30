/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * GNOME Maps is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 2 of the License, or (at your
 * option) any later version.
 *
 * GNOME Maps is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with GNOME Maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Alaf Azam <alafazam@gmail.com>
 */

const DEFAULT_LINE_WIDTH = 5;
const DEFAULT_COLOR = '69B1FF';

export class GeoJSONStyle {

    static parseSimpleStyle(tags) {
        return new GeoJSONStyle({ alpha: tags['stroke-opacity'],
                                  fillAlpha: tags['fill-opacity'],
                                  color: tags['stroke'],
                                  fillColor: tags['fill'],
                                  lineWidth: tags['stroke-width'] });
    }

    constructor(params) {
        if (params.lineWidth || params.lineWidth === 0)
            this.lineWidth = params.lineWidth;
        else
            this.lineWidth = DEFAULT_LINE_WIDTH;

        if (params.alpha || params.alpha === 0)
            this.alpha = params.alpha;
        else
            this.alpha = 1;

        if (params.fillAlpha || params.fillAlpha === 0)
            this.fillAlpha = params.fillAlpha;
        else
            this.fillAlpha = 0.25;

        this.color = this._hexToColor(params.color || DEFAULT_COLOR);
        this.fillColor =  this._hexToColor(params.fillColor) || { red: 0.37,
                                                                  green: 0.62,
                                                                  blue: 0.87 };
    }

    _hexToColor(colorString) {
        let color = null;
        
        if (!colorString)
            return null;

        if (colorString.startsWith('#')) {
            colorString = colorString.slice(1);
        }

        if (colorString.length === 3) {
            colorString = colorString.match(/([0-9a-f]{3})$/i);
            if (colorString) {
                color = {
                    red: (parseInt(colorString[0].chatAt(0), 16) * 0x11)/255,
                    green: (parseInt(colorString[0].chatAt(1), 16) * 0x11)/255,
                    blue: (parseInt(colorString[0].chatAt(2), 16) * 0x11)/255
                };
            }
        } else {
            colorString = colorString.match(/([0-9a-f]{6})$/i);
            if (colorString) {
                color = {
                    red: parseInt(colorString[0].substr(0, 2), 16)/255,
                    green: parseInt(colorString[0].substr(2, 2), 16)/255,
                    blue: parseInt(colorString[0].substr(4, 2), 16)/255
                };
            }
        }

        return color;
    }
}
