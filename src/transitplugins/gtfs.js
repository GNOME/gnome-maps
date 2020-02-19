/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2020 Marcus Lundblad
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

const Maps = imports.gi.GnomeMaps;

const Application = imports.application;
const Utils = imports.utils;

var GTFS = class GTFS {
    constructor(params) {
        // TODO: for now just read files from an unzipped GTFS file at path…
        this._gtfs = Maps.GTFS.new(params.name);
        this._query = Application.routeQuery;
        this._plan = Application.routingDelegator.transitRouter.plan;
        Utils.debug('end constructor');
    }

    fetchFirstResults() {
        let filledPoints = this._query.filledPoints;
        let startLat = filledPoints[0].place.location.latitude;
        let startLon = filledPoints[0].place.location.longitude;
        let endLat = filledPoints.last().place.location.latitude;
        let endLon = filledPoints.last().place.location.longitude;

        this._plan.progress(_("Creating database…"));
        this._gtfs.parse((success, error) => {
            this._plan.progress(null);
            if (success) {
                Utils.debug('stops near start');
                let startStops = this._gtfs.get_nearby_stops(startLat, startLon, 2000);

                Utils.debug('stops near end');
                let endStops = this._gtfs.get_nearby_stops(endLat, endLon, 2000);
            } else {
                this._plan.requestFailed();
            }
        });
    }

    fetchMoreResults() {

    }
}
