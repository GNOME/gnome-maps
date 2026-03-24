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

import gettext from 'gettext';

import Shumate from 'gi://Shumate';

import * as HVT from './hvt.js';
import {BoundingBox} from '../boundingBox.js';
import {RouteType} from './routeType.js';
import * as Time from '../time.js';

const _ = gettext.gettext;

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

    get routeType() {
        return this._routeType;
    }

    get departure() {
        return this._departure;
    }

    get arrival() {
        return this._arrival;
    }

    get polyline() {
        if (!this._polyline)
            this._createPolyline();

        return this._polyline;
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

    get headsign() {
        return this._headsign;
    }

    get transit() {
        return this._isTransit;
    }

    get distance() {
        return this._distance;
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

    get textColor() {
        return this._textColor;
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
