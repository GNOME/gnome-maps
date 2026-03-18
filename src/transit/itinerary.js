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

import GObject from 'gi://GObject';

import {BoundingBox} from '../boundingBox.js';
import * as Time from '../time.js';
import * as Utils from '../utils.js';

const _ = gettext.gettext;
const ngettext = gettext.ngettext;

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
