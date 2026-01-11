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

import gettext from 'gettext';

import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Shumate from 'gi://Shumate';

import {BoundingBox} from './boundingBox.js';
import * as HVT from './hvt.js';
import * as Time from './time.js';
import {TransitPlace} from './transitPlace.js';
import * as Utils from './utils.js';

const _ = gettext.gettext;
const ngettext = gettext.ngettext;

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

/* extra time to add to the first itinerary leg when it's a walking leg */
const WALK_SLACK = 120;

export const DEFAULT_ROUTE_COLOR = new Gdk.RGBA({ red:   0x4c / 255,
                                                  green: 0x4c / 255,
                                                  blue:  0x4c / 255,
                                                  alpha: 1.0 });
export const DEFAULT_ROUTE_TEXT_COLOR = new Gdk.RGBA({ red:   1.0,
                                                       green: 1.0,
                                                       blue:  1.0,
                                                       alpha: 1.0 });
export const DEFAULT_DARK_ROUTE_COLOR = new Gdk.RGBA({ red:   0xde / 255,
                                                       green: 0xdd / 255,
                                                       blue:  0xda / 255,
                                                       alpha: 1.0 });
export const DEFAULT_DARK_ROUTE_TEXT_COLOR = new Gdk.RGBA({ red:   0x24 / 255,
                                                            green: 0x1f / 255,
                                                            blue:  0x31 / 255,
                                                            alpha: 1.0 });

export class Plan extends GObject.Object {

    constructor(params) {
        super(params);
        this.reset();
    }

    get itineraries() {
        return this._itineraries;
    }

    get selectedItinerary() {
        return this._selectedItinerary;
    }

    update(itineraries) {
        this._itineraries = itineraries;
        this.bbox = this._createBBox();
        this.emit('update');
    }

    /**
     * Update plan with new itineraries, setting the new itineraries if it's
     * the first fetch for a query, or extending the existing ones if it's
     * a request to load more
     */
    updateWithNewItineraries(itineraries, arriveBy, extendPrevious) {
        /* sort itineraries, by departure time ascending if querying
         * by leaving time, by arrival time descending when querying
         * by arriving time
         */
        if (arriveBy)
            itineraries.sort(sortItinerariesByArrivalDesc);
        else
            itineraries.sort(sortItinerariesByDepartureAsc);

        let newItineraries =
            extendPrevious ? this.itineraries.concat(itineraries) : itineraries;

        this.update(newItineraries);
    }



    reset() {
        this._itineraries = [];
        this.bbox = null;
        this._selectedItinerary = null;
        this._attribution = null;
        this._attributionUrl = null;
        this.emit('reset');
    }

    noMoreResults() {
        this.emit('no-more-results');
    }

    selectItinerary(itinerary) {
        this._selectedItinerary = itinerary;
        this.emit('itinerary-selected', itinerary);
    }

    deselectItinerary() {
        this._selectedItinerary = null;
        this.emit('itinerary-deselected');
    }

    error(msg) {
        this.emit('error', msg);
    }

    noRouteFound() {
        this.emit('error', _("No route found."));
    }

    requestFailed() {
        this.emit('error', _("Route request failed."));
    }

    _createBBox() {
        let bbox = new BoundingBox();
        this._itineraries.forEach(function(itinerary) {
            bbox.compose(itinerary.bbox);
        });
        return bbox;
    }
}

GObject.registerClass({
    Signals: {
        'update': {},
        'reset': {},
        'no-more-results': {},
        'itinerary-selected': { param_types: [GObject.TYPE_OBJECT] },
        'itinerary-deselected': {},
        'error': { param_types: [GObject.TYPE_STRING] }
    }
}, Plan);

export class Itinerary extends GObject.Object {

    constructor({ duration, departure, arrival, transfers, legs, ...params }) {
        super(params);

        this._duration = duration;
        this._departure = departure;
        this._arrival = arrival;
        this._transfers = transfers;
        this._legs = legs;
        this.bbox = this._createBBox();
    }

    get duration() {
        return this._duration;
    }

    get departure() {
        return this._departure;
    }

    get arrival() {
        return this._arrival;
    }

    get transfers() {
        return this._transfers;
    }

    get legs() {
        return this._legs;
    }

    _createBBox() {
        let bbox = new BoundingBox();

        this._legs.forEach(function(leg) {
            bbox.compose(leg.bbox);
        });

        return bbox;
    }

    prettyPrintTimeInterval() {
        /* Translators: this is a format string for showing a departure and
         * arrival time, like:
         * "12:00 – 13:03" where the placeholder %s are the actual times,
         * these could be rearranged if needed.
         */
        return _("%s \u2013 %s").format(this._getDepartureTime(),
                                        this._getArrivalTime());
    }

    _getDepartureTime() {
        return Time.formatDateTime(this.departure);
    }

    _getArrivalTime() {
        return Time.formatDateTime(this.arrival);
    }

    prettyPrintDuration() {
        let mins = Math.ceil(this.duration / 60);

        if (mins < 60) {
            let minStr = Utils.formatLocaleInteger(mins);

            // don't try to format with a negative number
            if (mins < 0)
                return '';

            /* translators: this is an indication for a trip duration of
             * less than an hour, with only the minutes part, using plural forms
             * as appropriate
             */
            return ngettext("%s minute", "%s minutes", mins).format(minStr);
        } else {
            let hours = Math.floor(mins / 60);
            let hourStr = Utils.formatLocaleInteger(hours);

            mins = mins % 60;

            if (mins === 0) {
                /* translators: this is an indication for a trip duration,
                 * where the duration is an exact number of hours (i.e. no
                 * minutes part), using plural forms as appropriate
                 */
                return ngettext("%s hour", "%s hours", hours).format(hourStr);
            } else {
                let minStr = Utils.formatLocaleIntegerMinimumTwoDigits(mins);

                /* translators: this is an indication for a trip duration
                 * where the duration contains an hour and minute part, it's
                 * pluralized on the hours part
                 */
                return ngettext("%s:%s hour", "%s:%s hours", hours).format(hourStr, minStr);
            }
        }
    }

    _getTransitDepartureLeg() {
        for (let i = 0; i < this._legs.length; i++) {
            let leg = this._legs[i];

            if (leg.transit)
                return leg;
        }

        throw new Error('no transit leg found');
    }

    _getTransitArrivalLeg() {
        for (let i = this._legs.length - 1; i >= 0; i--) {
            let leg = this._legs[i];

            if (leg.transit)
                return leg;
        }

        throw new Error('no transit leg found');
    }

    get isWalkingOnly() {
        return this.legs.length === 1 && !this.legs[0].isTransit;
    }
}

GObject.registerClass(Itinerary);

export class Leg {

    constructor({ route, routeType, departure, arrival, polyline,
                  from, to, intermediateStops,
                  headsign, isTransit, walkingInstructions, distance, duration,
                  agencyName, agencyUrl, color, textColor, tripShortName }) {
        this._route = route;
        this._routeType = routeType;
        this._departure = departure;
        this._arrival = arrival;
        this._polyline = polyline;
        this._from = from;
        this._to = to;
        this._intermediateStops = intermediateStops;
        this._headsign = headsign;
        this._isTransit = isTransit;
        this._walkingInstructions = walkingInstructions;
        this._distance = distance;
        this._duration = duration;
        this._agencyName = agencyName;
        this._agencyUrl = agencyUrl;
        this._color = color;
        this._textColor = textColor;
        this._tripShortName = tripShortName;
        this.bbox = this._createBBox();
    }

    get route() {
        return this._route;
    }

    set route(route) {
        this._route = route;
    }

    get routeType() {
        return this._routeType;
    }

    set routeType(routeType) {
        this._routeType = routeType;
    }

    get departure() {
        return this._departure;
    }

    set departure(departure) {
        this._departure = departure;
    }

    get arrival() {
        return this._arrival;
    }

    set arrival(arrival) {
        this._arrival = arrival;
    }

    get polyline() {
        if (!this._polyline)
            this._createPolyline();

        return this._polyline;
    }

    set polyline(polyline) {
        this._polyline = polyline;
    }

    get fromCoordinate() {
        return this._fromCoordinate;
    }

    get toCoordinate() {
        return this._toCoordinate;
    }

    get from() {
        return this._from;
    }

    get to() {
        return this._to;
    }

    get intermediateStops() {
        return this._intermediateStops;
    }

    set intermediateStops(intermediateStops) {
        this._intermediateStops = intermediateStops;
    }

    get headsign() {
        return this._headsign;
    }

    get transit() {
        return this._isTransit;
    }

    get distance() {
        return this._distance;
    }

    set distance(distance) {
        this._distance = distance;
    }

    get duration() {
        return this._duration;
    }

    get agencyName() {
        return this._agencyName;
    }

    get agencyUrl() {
        return this._agencyUrl;
    }

    get color() {
        return this._color;
    }

    set color(color) {
        this._color = color;
    }

    get textColor() {
        return this._textColor;
    }

    set textColor(textColor) {
        this._textColor = textColor;
    }

    get tripShortName() {
        return this._tripShortName;
    }

    // create polyline from intermediate stops, or start and arrival coordinates
    _createPolyline() {
        if (this._intermediateStops) {
            const first =
                new Shumate.Coordinate({ latitude:  this._from.location.latitude,
                                         longitude: this._from.location.longitude });
            const rest = this._intermediateStops.map((s) => {
                return new Shumate.Coordinate({ latitude:  s.location.latitude,
                                                longitude: s.location.latitude });
            });

            this._polyline = [first, ...rest];
        } else {
            this._polyline =
                [new Shumate.Coordinate({ latitude:  this._from.location.latitude,
                                          longitude: this._from.location.longitude }),
                 new Shumate.Coordinate({ latitude:  this._to.location.latitude,
                                          longitude: this._to.location.longitude })];
        }
    }

    _createBBox() {
        let bbox = new BoundingBox();

        this.polyline.forEach(function({ latitude, longitude }) {
            bbox.extend(latitude, longitude);
        });

        return bbox;
    }

    get iconName() {
        if (this._isTransit) {
            let type = this._routeType;
            switch (type) {
                /* special case HVT codes */
                case HVT.CABLE_CAR:
                    return 'cablecar-symbolic';
                case HVT.HORSE_DRAWN_CARRIAGE:
                    return 'horse-symbolic';
                case HVT.MONORAIL:
                    return 'monorail-symbolic';
                case HVT.TOURIST_RAILWAY_SERVICE:
                    return 'steam-train-symbolic';
                default:
                    let hvtSupertype = HVT.supertypeOf(type);

                    if (hvtSupertype !== -1)
                        type = hvtSupertype;

                    switch (type) {
                        case RouteType.TRAM:
                        case HVT.TRAM_SERVICE:
                            return 'tram-symbolic';

                        case RouteType.SUBWAY:
                        case HVT.METRO_SERVICE:
                        case HVT.URBAN_RAILWAY_SERVICE:
                        case HVT.UNDERGROUND_SERVICE:
                            return 'subway-symbolic';

                        case RouteType.TRAIN:
                        case HVT.RAILWAY_SERVICE:
                        case HVT.SUBURBAN_RAILWAY_SERVICE:
                            return 'train-symbolic';

                        case RouteType.BUS:
                        case HVT.BUS_SERVICE:
                        case HVT.COACH_SERVICE:
                            return 'bus-symbolic';

                        case RouteType.TROLLEYBUS:
                        case HVT.TROLLEYBUS_SERVICE:
                            return 'trolley-bus-symbolic';

                        case RouteType.FERRY:
                        case HVT.WATER_TRANSPORT_SERVICE:
                        case HVT.FERRY_SERVICE:
                            return 'ferry-symbolic';

                        case RouteType.CABLE_CAR:
                            return 'cablecar-symbolic';

                        case RouteType.GONDOLA:
                        case HVT.TELECABIN_SERVICE:
                            return 'gondola-symbolic';

                        case RouteType.FUNICULAR:
                        case HVT.FUNICULAR_SERVICE:
                            return 'funicular-symbolic';

                        case HVT.TAXI_SERVICE:
                            return 'taxi-symbolic';

                        case HVT.AIR_SERVICE:
                            return 'flying-symbolic';

                        case RouteType.MONORAIL:
                            return 'monorail-symbolic';

                        default:
                            /* use a fallback question mark icon in case of some future,
                             * for now unknown mode appears */
                            return 'dialog-question-symbolic';
                    }
            }
        } else {
            return 'walking-symbolic';
        }
    }

    get walkingInstructions() {
        return this._walkingInstructions;
    }

    set walkingInstructions(walkingInstructions) {
        this._walkingInstructions = walkingInstructions;
    }

    /* Pretty print timing for a transit leg, set params.isStart: true when
     * printing for the starting leg of an itinerary.
     * For starting walking legs, only the departure time will be printed,
     * otherwise the departure and arrival time of the leg (i.e. transit ride
     * or an in-between walking section) will be printed.
     */
    prettyPrintTime(params) {
        if (!this.transit && params.isStart) {
            return this.prettyPrintDepartureTime();
        } else {
            /* Translators: this is a format string for showing a departure and
             * arrival time in a more compact manner to show in the instruction
             * list for an itinerary, like:
             * "12:00–13:03" where the placeholder %s are the actual times,
             * these could be rearranged if needed.
             */
            return _("%s\u2013%s").format(this.prettyPrintDepartureTime(),
                                          this.prettyPrintArrivalTime());
        }
    }

    prettyPrintDepartureTime() {
        return Time.formatDateTime(this.departure);
    }

    prettyPrintArrivalTime() {
        return Time.formatDateTime(this.arrival);
    }
}

export class Stop extends TransitPlace {

    constructor({ arrival, departure, ...params }) {
        super(params);

        this._arrival = arrival;
        this._departure = departure;
    }

    get arrival() {
        return this._arrival;
    }

    get departure() {
        return this._departure;
    }

    prettyPrint(params) {
        return Time.formatDateTime(params.isFinal ?
                                   this._arrival : this._departure);
    }
}
GObject.registerClass(Stop);

function sortItinerariesByDepartureAsc(first, second) {
    /* always sort walk-only itineraries first, as they would always be
     * starting at the earliest possible departure time
     */
    if (first.isWalkingOnly)
        return -1;
    else if (second.isWalkingOnly)
        return 1;
    else
        return first.departure.to_unix() > second.departure.to_unix();
}

function sortItinerariesByArrivalDesc(first, second) {
    /* always sort walk-only itineraries first, as they would always be
     * ending at the latest possible arrival time
     */
    if (first.isWalkingOnly)
        return -1;
    else if (second.isWalkingOnly)
        return 1;
    else
        return first.arrival.to_unix() < second.arrival.to_unix();
}
