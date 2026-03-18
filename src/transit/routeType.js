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

/*
 * These constants corresponds to the routeType attribute of transit legs
 * in original GTFS specification.
 */
export const RouteType = {
    NON_TRANSIT: -1,
    TRAM:        0,
    SUBWAY:      1,
    TRAIN:       2,
    BUS:         3,
    FERRY:       4,
    /* Cable car refers to street-level cabel cars, where the propulsive
     * cable runs in a slot between the tracks beneath the car
     * https://en.wikipedia.org/wiki/Cable_car_%28railway%29
     * For example the cable cars in San Francisco
     * https://en.wikipedia.org/wiki/San_Francisco_cable_car_system
     */
    CABLE_CAR:   5,
    /* Gondola refers to a suspended cable car, typically aerial cable cars
     * where the car is suspended from the cable
     * https://en.wikipedia.org/wiki/Gondola_lift
     * For example the "Emirates Air Line" in London
     * https://en.wikipedia.org/wiki/Emirates_Air_Line_%28cable_car%29
     */
    GONDOLA:     6,
    /* Funicular refers to a railway system designed for steep inclines,
     * https://en.wikipedia.org/wiki/Funicular
     */
    FUNICULAR:   7,
    /* Electric buses that draw power from overhead wires using poles. */
    TROLLEYBUS:  11,
    /* Railway in which the track consists of a single rail or a beam. */
    MONORAIL:    12
};
