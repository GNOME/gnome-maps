/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2014 Dario Di Nucci
 *
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
 * Author: Dario Di Nucci <linkin88mail@gmail.com>
 */

import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';

import {Application} from './application.js';
import * as Color from './color.js';
import {Location} from './location.js';
import {MapMarker} from './mapMarker.js';
import {Place} from './place.js';
import * as Utils from './utils.js';

export class TurnPointMarker extends MapMarker {

    constructor({queryPoint, turnPoint, transitStop, transitLeg, ...params}) {
        let latitude;
        let longitude;

        if (turnPoint) {
            latitude = turnPoint.coordinate.get_latitude();
            longitude = turnPoint.coordinate.get_longitude();
        } else {
            latitude = transitStop.coordinate[0];
            longitude = transitStop.coordinate[1];
        }

        let place =
            new Place({ location: new Location({ latitude: latitude,
                                                 longitude: longitude }) });

        super({...params, place: place});

        this._queryPoint = queryPoint;

        if (turnPoint) {
            this._image.paintable =
                this._paintableFromIconName('maps-point-end-symbolic', 16);
        } else {
            let color = this._getColor(transitLeg);
            this._image.paintable =
                this._paintableFromIconName('maps-point-end-symbolic',
                                            16,
                                            color);
        }
    }

    _getColor(transitLeg) {
        const color = transitLeg.color;

        return color ? new Gdk.RGBA({ red: Color.parseColor(color, 0),
                                      green: Color.parseColor(color, 1),
                                      blue: Color.parseColor(color, 2),
                                      alpha: 255 }) :
                       null;
    }

    goTo() {
        this._mapView.map.go_to(this.latitude, this.longitude);
    }
}

GObject.registerClass(TurnPointMarker);
