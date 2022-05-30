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

import {GraphHopper} from './graphHopper.js';
import {TransitRouter} from './transitRouter.js';
import {RouteQuery} from './routeQuery.js';

const _FALLBACK_TRANSPORTATION = RouteQuery.Transportation.PEDESTRIAN;

export class RoutingDelegator {

    constructor(params) {
        this._query = params.query;

        this._transitRouting = false;
        this._graphHopper = new GraphHopper({ query: this._query });
        this._transitRouter = new TransitRouter({ query: this._query });
        this._query.connect('notify::points', this._onQueryChanged.bind(this));

        /* if the query is set to transit mode when it's not available, revert
         * to a fallback mode
         */
        if (this._query.transportation === RouteQuery.Transportation.TRANSIT &&
            !this._transitRouter.enabled) {
            this._query.transportation = _FALLBACK_TRANSPORTATION;
        }
    }

    get graphHopper() {
        return this._graphHopper;
    }

    get transitRouter() {
        return this._transitRouter;
    }

    set useTransit(useTransit) {
        this._transitRouting = useTransit;
    }

    reset() {
        if (this._transitRouting)
            this._transitRouter.plan.reset();
        else
            this._graphHopper.route.reset();
    }

    _onQueryChanged() {
        if (this._query.isValid()) {
            this._query.emit('run');
            if (this._transitRouting) {
                this._transitRouter.fetchFirstResults();
            } else {
                this._graphHopper.fetchRoute(this._query.filledPoints,
                                             this._query.transportation);
            }
        }
    }
}
