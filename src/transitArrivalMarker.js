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

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';

import * as Color from './color.js';
import {Location} from './location.js';
import {MapMarker} from './mapMarker.js';
import {Place} from './place.js';
import * as TransitPlan from './transitPlan.js';

export class TransitArrivalMarker extends MapMarker {

    constructor({leg, ...params}) {
        const lastPoint = leg.polyline[leg.polyline.length - 1];
        const location = new Location({ latitude: lastPoint.latitude,
                                      longitude: lastPoint.longitude });

        super({...params, place: new Place({ location: location })});

        this._leg = leg;
        this._styleManager = Adw.StyleManager.get_default();
    }

    vfunc_map() {
        this._darkId = this._styleManager.connect('notify::dark', () => {
            this._setPaintable();
        });
        this._setPaintable();

        super.vfunc_map();
    }

    vfunc_unmap() {
        this._styleManager.disconnect(this._darkId);

        super.vfunc_unmap();
    }

    _setPaintable(leg) {
        const bgColor = this._leg.color ??
                        this._styleManager.dark ?
                        TransitPlan.DEFAULT_DARK_ROUTE_COLOR :
                        TransitPlan.DEFAULT_ROUTE_COLOR;

        const bgRed = Color.parseColor(bgColor, 0);
        const bgGreen = Color.parseColor(bgColor, 1);
        const bgBlue = Color.parseColor(bgColor, 2);
        const color = new Gdk.RGBA({ red: bgRed,
                                     green: bgGreen,
                                     blue: bgBlue,
                                     alpha: 1.0
                                   });
        this._image.paintable =
            this._paintableFromIconName('maps-point-end-symbolic', 16, color);
    }
}

GObject.registerClass(TransitArrivalMarker);
