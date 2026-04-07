/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2026, Marcus Lundblad.
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

import * as HVT from './hvt.js';
import {RouteType} from './routeType.js';
import * as Utils from '../utils.js';

const _ = gettext.gettext;

/**
 * Get the label to display for the starting point of an itinerary leg.
 * leg: the itinerary leg
 */
export function getFromLabel(leg) {
    return leg.from.name ?? _("Start");
}

/**
 * Get the label to display for the ending point of an itinerary leg.
 * leg: the itinerary leg
 */
export function getToLabel(leg) {
    return leg.to.name ?? _("Arrive");
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
        return _("Arrive at %s").format(lastLeg.to.name);
    } else {
        return _("Arrive");
    }
}

/**
 * Get the label to display for departure of the first leg of an itinerary.
 */
export function getDepartureLabel(firstLeg) {
    if (firstLeg.from) {
        /* Translators: this a format string indicating departing from the
         * destination of journey with the departure address and transit
         * stop as the format parameter */
        return _("Start at %s").format(firstLeg.from.name);
    } else {
        return _("Start");
    }
}

// stop position types (rail track, bus stop, ferry quay, airport gate)
const TrackType = {
    TRACK: 0,
    POSITION:  1,
    QUAY:  2,
    GATE:  3
};

function getTrackTypeFromRouteType(routeType) {
    const hvtSupertype = HVT.supertypeOf(routeType);
    const type = hvtSupertype !== -1 ? hvtSupertype : routeType;

    switch (type) {
        case RouteType.BUS:
        case HVT.BUS_SERVICE:
        case HVT.COACH_SERVICE:
        case RouteType.TROLLEYBUS:
        case HVT.TROLLEYBUS_SERVICE:
        case HVT.TAXI_SERVICE:
        case RouteType.GONDOLA:
        case HVT.TELECABIN_SERVICE:
            return TrackType.POSITION;

        case RouteType.FERRY:
        case HVT.WATER_TRANSPORT_SERVICE:
        case HVT.FERRY_SERVICE:
            return TrackType.QUAY;

        case HVT.AIR_SERVICE:
            return TrackType.GATE;

        default:
            return TrackType.TRACK;
    }
}

/**
 * Get description for track/stop/stand indication-
 * track: Track/stop number/name
 * routeType: the route type of the transit leg
 */
export function getTrackIndication(track, routeType) {
    switch (getTrackTypeFromRouteType(routeType)) {
        case TrackType.TRACK:
            /* Translators: this is an indication of a departure or arrival
             * track for a journey leg of public transit leg that is rail-based
             */
            return _("Track %s").format(track);
        case TrackType.POSITION:
            return track;
        case TrackType.QUAY:
            /* Translators: this is an indication of a departure or arrival
             * track for a journey leg of public transit leg that is a ferry
             * quay
             */
            return _("Quay %s").format(track);
        case TrackType.GATE:
            /* Translators: this is an indication of a departure or arrival
             * track for a journey leg of public transit leg that is an airport
             * gate
             */
            return _("Gate %s").format(track);
    }
}

export function getTrackChangeDesciption(routeType) {
    switch (getTrackTypeFromRouteType(routeType)) {
        case TrackType.TRACK:
            /* Translators: this is an indication of a track/stop position
             * change for a journey leg of public transit leg that is rail-based
             */
            return _("Departure track changed");
        case TrackType.POSITION:
            /* Translators: this is an indication of a track/stop position
             * change for a journey leg of public transit leg that e.g. a bus stop
             * "stop position"
             */
            return _("Departure stop position changed");
        case TrackType.QUAY:
            /* Translators: this is an indication of a track/stop position
             * change for a journey leg of public transit leg that is a ferry
             * quay
             */
            return _("Departure quay changed");
        case TrackType.GATE:
            /* Translators: this is an indication of a track/stop position
             * change for a journey leg of public transit leg that is an airport
             * gate
             */
            return _("Departure gate changed");
    }
}
