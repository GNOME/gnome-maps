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

const _ = imports.gettext.gettext;
const ngettext = imports.gettext.ngettext;

const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

const BoundingBox = imports.boundingBox;
const HVT = imports.hvt;
const Time = imports.time;
const Utils = imports.utils;

/*
 * These constants corresponds to the routeType attribute of transit legs
 * in original GTFS specification.
 */
var RouteType = {
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

var DEFAULT_ROUTE_COLOR = '4c4c4c';
var DEFAULT_ROUTE_TEXT_COLOR = 'ffffff';

var Plan = GObject.registerClass({
    Signals: {
        'update': {},
        'reset': {},
        'no-more-results': {},
        'itinerary-selected': { param_types: [GObject.TYPE_OBJECT] },
        'itinerary-deselected': {},
        'error': { param_types: [GObject.TYPE_STRING] }
    }
}, class Plan extends GObject.Object {

    _init(params) {
        super._init(params);
        this.reset();
        this._attribution = null;
        this._attributionUrl = null;
    }

    get itineraries() {
        return this._itineraries;
    }

    get selectedItinerary() {
        return this._selectedItinerary;
    }

    get attribution() {
        return this._attribution;
    }

    set attribution(attribution) {
        this._attribution = attribution;
    }

    get attributionUrl() {
        return this._attributionUrl;
    }

    set attributionUrl(attributionUrl) {
        this._attributionUrl = attributionUrl;
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

    noTimetable() {
        this.emit('error', _("No timetable data found for this route."));
    }

    requestFailed() {
        this.emit('error', _("Route request failed."));
    }

    noProvider() {
        this.emit('error', _("No provider found for this route."));
    }

    _createBBox() {
        let bbox = new BoundingBox.BoundingBox();
        this._itineraries.forEach(function(itinerary) {
            bbox.compose(itinerary.bbox);
        });
        return bbox;
    }
});

var Itinerary = GObject.registerClass(
class Itinerary extends GObject.Object {

    _init(params) {
        this._duration = params.duration;
        delete params.duration;

        this._departure = params.departure;
        delete params.departure;

        this._arrival = params.arrival;
        delete params.arrival;

        this._transfers = params.transfers;
        delete params.transfers;

        this._legs = params.legs;
        delete params.legs;

        super._init(params);

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

    /* adjust timings of the legs of the itinerary, using the real duration of
     * walking legs, also sets the timezone offsets according to adjacent
     * transit legs
     */
    _adjustLegTimings() {
        if (this.legs.length === 1 && !this.legs[0].transit) {
            /* if there is only one leg, and it's a walking one, just need to
             * adjust the arrival time
             */
            let leg = this.legs[0];
            leg.arrival = leg.departure + leg.duration * 1000;

            return;
        }

        for (let i = 0; i < this.legs.length; i++) {
            let leg = this.legs[i];

            if (!leg.transit) {
                if (i === 0) {
                    /* for the first leg subtract the walking time plus a
                     * safety slack from the departure time of the following
                     * leg
                     */
                    let nextLeg = this.legs[i + 1];
                    leg.departure =
                        nextLeg.departure - leg.duration * 1000 - WALK_SLACK;
                    leg.arrival = leg.departure + leg.duration * 1000;
                    // use the timezone offset from the first transit leg
                    leg.agencyTimezoneOffset = nextLeg.agencyTimezoneOffset;
                } else {
                    /* for walking legs in the middle or at the end, just add
                     * the actual walking walk duration to the arrival time of
                     * the previous leg
                     */
                    let previousLeg = this.legs[i - 1];
                    leg.departure = previousLeg.arrival;
                    leg.arrival = previousLeg.arrival + leg.duration * 1000;
                    // use the timezone offset of the previous (transit) leg
                    leg.agencyTimezoneOffset = previousLeg.agencyTimezoneOffset;
                }
            }
        }
    }

    _createBBox() {
        let bbox = new BoundingBox.BoundingBox();

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
        /* take the itinerary departure time and offset using the timezone
         * offset of the first leg */
        return Time.formatTimeWithTZOffset(this.departure,
                                           this.legs[0].agencyTimezoneOffset);
    }

    _getArrivalTime() {
        /* take the itinerary departure time and offset using the timezone
         * offset of the last leg */
        let lastLeg = this.legs[this.legs.length - 1];
        return Time.formatTimeWithTZOffset(this.arrival,
                                           lastLeg.agencyTimezoneOffset);
    }

    prettyPrintDuration() {
        let mins = this.duration / 60;

        if (mins < 60) {
            let minStr = Utils.formatLocaleInteger(mins);

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

    adjustTimings() {
        this._adjustLegTimings();
        this._departure = this._legs[0].departure;
        this._arrival = this._legs[this._legs.length - 1].arrival;
        this._duration = (this._arrival - this._departure) / 1000;
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

    /* gets the departure time of the first transit leg */
    get transitDepartureTime() {
        return this._getTransitDepartureLeg().departure;
    }

    /* gets the timezone offset of the first transit leg */
    get transitDepartureTimezoneOffset() {
        return this._getTransitDepartureLeg().timezoneOffset;
    }

    /* gets the arrival time of the final transit leg */
    get transitArrivalTime() {
        return this._getTransitArrivalLeg().arrival;
    }

    /* gets the timezone offset of the final transit leg */
    get transitArrivalTimezoneOffset() {
        return this._getTransitArrivalLeg().timezoneOffset;
    }

    get isWalkingOnly() {
        return this.legs.length === 1 && !this.legs[0].isTransit;
    }
});

var Leg = class Leg {

    constructor(params) {
        this._route = params.route;
        delete params.route;

        this._routeType = params.routeType;
        delete params.routeType;

        this._departure = params.departure;
        delete params.departure;

        this._arrival = params.arrival;
        delete params.arrival;

        this._polyline = params.polyline;
        delete params.polyline;

        this._fromCoordinate = params.fromCoordinate;
        delete params.fromCoordinate;

        this._toCoordinate = params.toCoordinate;
        delete params.toCoordinate;

        this._from = params.from;
        delete params.from;

        this._to = params.to;
        delete params.to;

        this._intermediateStops = params.intermediateStops;
        delete params.intermediateStops;

        this._headsign = params.headsign;
        delete params.headsign;

        this._isTransit = params.isTransit;
        delete params.isTransit;

        this._walkingInstructions = params.walkingInstructions;
        delete params.walkingInstructions;

        this._distance = params.distance;
        delete params.distance;

        this._duration = params.duration;
        delete params.duration;

        this._agencyName = params.agencyName;
        delete params.agencyName;

        this._agencyUrl = params.agencyUrl;
        delete params.agencyUrl;

        this._agencyTimezoneOffset = params.agencyTimezoneOffset;
        delete params.agencyTimezoneOffset;

        this._color = params.color;
        delete params.color;

        this._textColor = params.textColor;
        delete params.textColor;

        this._tripShortName = params.tripShortName;
        delete params.tripShortName;

        this.bbox = this._createBBox();

        this._compactRoute = null;
    }

    get route() {
        return this._route;
    }

    set route(route) {
        this._route = route;
    }

    // try to get a shortened route name, suitable for overview rendering
    get compactRoute() {
        if (this._compactRoute)
            return this._compactRoute;

        if (this._route.startsWith(this._agencyName)) {
            /* if the agency name is a prefix of the route name, display the
             * agency name in the overview, this way we get a nice "transition"
             * into the expanded route showing the full route name
             */
            this._compactRoute = this._agencyName;
        } else if (this._tripShortName &&
                   (this._agencyName.length < this._tripShortName.length)) {
            /* if the agency name is shorter than the trip short name,
             * which can sometimes be a more "internal" number, like a
             * "train number", which is less known by the general public,
             * prefer the agency name */
            this._compactRoute = this._agencyName;
        } else if (this._tripShortName && this._tripShortName.length <= 6) {
            /* if the above conditions are unmet, use the trip short name
             * as a fallback if it was shorter than the original route name */
            this._compactRoute = this._tripShortName;
        } else if (this._color) {
            /* as a fallback when the route has a defined color,
             * use an empty compact label to get a colored badge */
            this._compactRoute = '';
        } else {
            /* if none of the above is true, use the original route name,
             * and rely on label ellipsization */
            this._compactRoute = this._route;
        }

        return this._compactRoute;
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

    get timezoneOffset() {
        return this._agencyTimezoneOffset;
    }

    set arrival(arrival) {
        this._arrival = arrival;
    }

    get polyline() {
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

    get agencyTimezoneOffset() {
        return this._agencyTimezoneOffset;
    }

    set agencyTimezoneOffset(tzOffset) {
        this._agencyTimezoneOffset = tzOffset;
    }

    get color() {
        return this._color || DEFAULT_ROUTE_COLOR;
    }

    set color(color) {
        this._color = color;
    }

    get textColor() {
        return this._textColor || DEFAULT_ROUTE_TEXT_COLOR;
    }

    set textColor(textColor) {
        this._textColor = textColor;
    }

    get tripShortName() {
        return this._tripShortName;
    }

    _createBBox() {
        let bbox = new BoundingBox.BoundingBox();

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
                    return 'route-transit-cablecar-symbolic';
                default:
                    let hvtSupertype = HVT.supertypeOf(type);

                    if (hvtSupertype !== -1)
                        type = hvtSupertype;

                    switch (type) {
                        case RouteType.TRAM:
                        case HVT.TRAM_SERVICE:
                            return 'route-transit-tram-symbolic';

                        case RouteType.SUBWAY:
                        case HVT.METRO_SERVICE:
                        case HVT.URBAN_RAILWAY_SERVICE:
                        case HVT.UNDERGROUND_SERVICE:
                            return 'route-transit-subway-symbolic';

                        case RouteType.TRAIN:
                        case HVT.RAILWAY_SERVICE:
                        case HVT.SUBURBAN_RAILWAY_SERVICE:
                            return 'route-transit-train-symbolic';

                        case RouteType.BUS:
                        case HVT.BUS_SERVICE:
                        case HVT.COACH_SERVICE:
                        case HVT.TROLLEYBUS_SERVICE:
                            /* TODO: handle a special case icon for trolleybus */
                            return 'route-transit-bus-symbolic';

                        case RouteType.FERRY:
                        case HVT.WATER_TRANSPORT_SERVICE:
                        case HVT.FERRY_SERVICE:
                            return 'route-transit-ferry-symbolic';

                        case RouteType.CABLE_CAR:
                            return 'route-transit-cablecar-symbolic';

                        case RouteType.GONDOLA:
                        case HVT.TELECABIN_SERVICE:
                            return 'route-transit-gondolalift-symbolic';

                        case RouteType.FUNICULAR:
                        case HVT.FUNICULAR_SERVICE:
                            return 'route-transit-funicular-symbolic';

                        case HVT.TAXI_SERVICE:
                            /* TODO: should we have a dedicated taxi icon? */
                            return 'route-car-symbolic';

                        case HVT.AIR_SERVICE:
                            return 'route-transit-airplane-symbolic';

                        default:
                            /* use a fallback question mark icon in case of some future,
                             * for now unknown mode appears */
                            return 'dialog-question-symbolic';
                    }
            }
        } else {
            return 'route-pedestrian-symbolic';
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
        /* take the itinerary departure time and offset using the timezone
         * offset of the first leg
         */
        return Time.formatTimeWithTZOffset(this.departure,
                                           this.agencyTimezoneOffset);
    }

    prettyPrintArrivalTime() {
        /* take the itinerary departure time and offset using the timezone
         * offset of the last leg
         */
        return Time.formatTimeWithTZOffset(this.arrival,
                                           this.agencyTimezoneOffset);
    }
};

var Stop = class Stop {

    constructor(params) {
        this._name = params.name;
        delete params.name;

        this._arrival = params.arrival;
        delete params.arrival;

        this._departure = params.departure;
        delete params.departure;

        this._agencyTimezoneOffset = params.agencyTimezoneOffset;
        delete params.agencyTimezoneOffset;

        this._coordinate = params.coordinate;
        delete params.coordinate;
    }

    get name() {
        return this._name;
    }

    get coordinate() {
        return this._coordinate;
    }

    prettyPrint(params) {
        if (params.isFinal) {
            /* take the stop arrival time and offset using the timezone
             * offset of the last leg
             */
            return Time.formatTimeWithTZOffset(this._arrival,
                                               this._agencyTimezoneOffset);
        } else {
            /* take the stop departure time and offset using the timezone
             * offset of the first leg
             */
            return Time.formatTimeWithTZOffset(this._departure,
                                               this._agencyTimezoneOffset);
        }
    }
};

function sortItinerariesByDepartureAsc(first, second) {
    /* always sort walk-only itineraries first, as they would always be
     * starting at the earliest possible departure time
     */
    if (first.isWalkingOnly)
        return -1;
    else if (second.isWalkingOnly)
        return 1;
    else
        return first.departure > second.departure;
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
        return first.arrival < second.arrival;
}
