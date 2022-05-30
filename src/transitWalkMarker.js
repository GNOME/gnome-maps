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

import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';

import * as Color from './color.js';
import {Location} from './location.js';
import {MapMarker} from './mapMarker.js';
import {Place} from './place.js';

export class TransitWalkMarker extends MapMarker {

    constructor(params) {
        /* if there is a preceding leg, put the marker at the end of that leg
         * to avoid gaps, since we will "fill out" the walking leg path line
         * since sometimes the walking route might not reach exactly to the
         * transit stop's position
         */
        let point;
        if (params.previousLeg)
            point = params.previousLeg.polyline[params.previousLeg.polyline.length - 1];
        else
            point = params.leg.polyline[0];

        let bgColor = params.leg.color ? params.leg.color :
                                         TransitPlan.DEFAULT_ROUTE_COLOR;

        delete params.leg;
        delete params.previousLeg;

        let location = new Location({ latitude: point.latitude,
                                      longitude: point.longitude });

        params.place = new Place({ location: location });

        super(params);

        let bgRed = Color.parseColor(bgColor, 0);
        let bgGreen = Color.parseColor(bgColor, 1);
        let bgBlue = Color.parseColor(bgColor, 2);
        let color = new Gdk.RGBA({ red: bgRed,
                                   green: bgGreen,
                                   blue: bgBlue,
                                   alpha: 1.0
                                 });
        let actor =
            this._actorFromIconName('maps-point-start-symbolic', 0, color);

        this.add_actor(actor);
    }

    get anchor() {
        return { x: Math.floor(this.width / 2) - 1,
                 y: Math.floor(this.height / 2) - 1 };
    }
}

GObject.registerClass(TransitWalkMarker);
