/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2017 Marcus Lundblad
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
 * Author: Marcus Lundblad <ml@update.uu.se>
 */

import GObject from 'gi://GObject';

import {CircleIconMarker} from './circleIconMarker.js';

export class TransitArrivalMarker extends CircleIconMarker {

    constructor({leg, ...params}) {
        const lastPoint = leg.polyline[leg.polyline.length - 1];

        super({ latitude:  lastPoint.latitude,
                longitude: lastPoint.longitude,
                color:     leg.color,
                textColor: leg.textColor,
                iconName:  'maps-point-end-symbolic',
                markerSize: 16,
                ...params });
    }
}

GObject.registerClass(TransitArrivalMarker);
