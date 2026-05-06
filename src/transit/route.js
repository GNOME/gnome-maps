/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2026 Marcus Lundblad
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
 * Author: Marcus Lundblad <ml@dfupdate.se>
 */

import * as HVT from './hvt.js';
import {RouteType} from './routeType.js';
import * as Utils from './utils.js';

export class Route {
    constructor({ agencyName, agencyUrl, displayName, routeType, realtime, color,
                  textColor, tripShortName }) {
        this._agencyName = agencyName;
        this._agencyUrl = agencyUrl;
        this._displayName = displayName;
        this._routeType = routeType;
        this._realtime = realtime;
        this._color = color;
        this._textColor = textColor;
        this._tripShortName;
    }

    get agencyName() {
        return this._agencyName;
    }

    get agencyUrl() {
        return this._agencyUrl;
    }

    get displayName() {
        return this._displayName;
    }

    get routeType() {
        return this._routeType;
    }

    get realtime() {
        return this._realtime;
    }

    get color() {
        return this._color;
    }

    get textColor() {
        return this._textColor;
    }

    get tripShortName() {
        return this._tripShortName;
    }

    get iconName() {
        return Utils.getIconNameForRouteType(this._routeType);
    }
}
