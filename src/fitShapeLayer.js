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
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>.
 *
 * Author: Szymon Kłos <eszkadev@gmail.com>
 */

import GObject from 'gi://GObject';

import {ShapeLayer} from './shapeLayer.js';
import * as Togeojson from './togeojson/togeojson.js';

export class FitShapeLayer extends ShapeLayer {

    static mimeTypes = ['application/fits' ];
    static displayName = 'FIT';

    static createInstance(params) {
        return new FitShapeLayer(params);
    };

    _parseContent() {
        let json = Togeojson.toGeoJSON.fit(this._fileContents.buffer);
        this._mapSource.parse(json);
    }
}

GObject.registerClass(FitShapeLayer);
