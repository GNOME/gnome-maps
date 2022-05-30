/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2019, Marcus Lundblad.
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

import gettext from 'gettext';

import * as Utils from './utils.js';

const _ = gettext.gettext;

/**
 * Get the label to display for the starting point of an itinerary leg.
 * leg: the itinerary leg
 * isFirstLeg: true if this is the first leg of the itinerary.
 */
export function getFromLabel(leg, isFirstLeg) {
    if (isFirstLeg) {
        if (leg.from) {
            /* Translators: this is a format string indicating instructions
             * starting a journey at the address given as the parameter
             */
            return _("Start at %s").format(leg.from);
        } else {
            /* Translators: this indicates starting a journey at a location
             * with no set name (such as when the user started routing from
             * an arbitrary point on the map)
             */
            return _("Start");
        }
    } else {
        return leg.from;
    }
}

/**
 * Get the label to display for the destination headsign.
 * leg: the itinerary leg
 */
export function getHeadsignLabel(leg) {
    if (leg.transit && leg.headsign) {
        return leg.headsign;
    } else if (!leg.transit) {
        /* Translators: this is a format string indicating walking a certain
         * distance, with the distance expression being the %s placeholder
         */
        return _("Walk %s").format(Utils.prettyDistance(leg.distance));
    } else {
        return null;
    }
}

/**
 * Get the label to display for arrival of the final leg of an itinerary.
 */
export function getArrivalLabel(lastLeg) {
    if (lastLeg.to) {
        /* Translators: this a format string indicating arriving at the
         * destination of journey with the arrival address and transit
         * stop as the format parameter */
        return _("Arrive at %s").format(lastLeg.to);
    } else {
        return _("Arrive");
    }
}
