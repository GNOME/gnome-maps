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

const _ = gettext.gettext;

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
