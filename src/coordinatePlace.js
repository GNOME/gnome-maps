/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2025 Marcus Lundblad
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

import gettext from 'gettext';

import GObject from 'gi://GObject';

import {Location} from './location.js';
import {Place} from './place.js';

const C_ = gettext.dgettext;

export class CoordinatePlace extends Place {

    constructor(params) {
        super({ store: false, ...params });
    }

    get name() {
        /* if the place was initialized with a fixed name, such as from a geo:
         * URI, use that.
         */
        if (this._name)
            return this._name;
        else
            return this.coordinateDescription;
    }

    get coordinateDescription() {
        const lat =
            this.location.latitude.toLocaleString(undefined,
                                                  { minimumFractionDigits: 5,
                                                    maximumFractionDigits: 5 });
        const lon =
            this.location.longitude.toLocaleString(undefined,
                                                   { minimumFractionDigits: 5,
                                                     maximumFractionDigits: 5 });

        /* Translators: this is a format template string for a pair of raw
         * coordinates, the comma can be adapted to local conventions if needed.
         */
        return C_("coordinates", "%s, %s").format(lat, lon);
    }

    _getIconName()  {
        return 'pin-location-symbolic';
    }
}

GObject.registerClass(CoordinatePlace);
