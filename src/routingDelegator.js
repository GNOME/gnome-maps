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
import { Route } from './route.js';
import { StoredRoute } from './storedRoute.js';

export class RoutingDelegator {

    constructor({query}) {
        this._query = query;
        this._route = new Route();

        this._transitRouting = false;
        this._graphHopper = new GraphHopper({ query: this._query, route: this._route });
        this._transitRouter = new TransitRouter({ query: this._query });
        this._query.connect('notify::points', this._onQueryChanged.bind(this));
        this._ignoreNextQueryChange = false;
        this._lastUsedRouter = null;
    }

    get graphHopper() {
        return this._graphHopper;
    }

    get transitRouter() {
        return this._transitRouter;
    }

    get route() {
        return this._route;
    }

    set useTransit(useTransit) {
        this._transitRouting = useTransit;
    }

    reset() {
        if (this._transitRouting)
            this._transitRouter.plan.reset();
        else
            this._route.reset();
    }

    _onQueryChanged() {
        if (this._ignoreNextQueryChange) {
            this._ignoreNextQueryChange = false;
            return;
        }

        if (this._lastUsedRouter) {
            this._lastUsedRouter.cancelCurrentRequest();
        }

        this._query.emit('cancel');

        if (this._query.isValid()) {
            this._query.emit('run');
            if (this._transitRouting) {
                this._lastUsedRouter = this._transitRouter;
                this._transitRouter.fetchFirstResults();
            } else {
                this._lastUsedRouter = this._graphHopper;
                this._graphHopper.fetchRoute(this._query.filledPoints,
                                             this._query.transportation);
            }
        }
    }

    /**
     * @param {StoredRoute} stored
     */
    replaceRoute(stored) {
        const query = this._query;
        query.freeze_notify();

        let storedLast = stored.places.length - 1;
        query.points[0].place = stored.places[0];
        query.points[1].place = stored.places[storedLast];
        query.transportation = stored.transportation;

        for (let i = 1; i < storedLast; i++) {
            let point = query.addPoint(i);
            point.place = stored.places[i];
        }

        this._ignoreNextQueryChange = true;
        query.thaw_notify();

        this.route.update({ path: stored.route.path,
                            turnPoints: stored.route.turnPoints,
                            distance: stored.route.distance,
                            time: stored.route.time,
                            bbox: stored.route.bbox});

    }
}
