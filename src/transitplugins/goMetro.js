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

/**
 * This module implements a transit routing plugin for the South African
 * GoMetro API.
 * https://proserver.gometro.co.za/api/v1/docs/#multimodal-routing
 */

const BASE_URL = 'https://proserver.gometro.co.za/api';
const API_VERSION = 'v1';

const NATIVE_TIMEZONE = 'Africa/Cape_Town';

const GLib = imports.gi.GLib;

const OpenTripPlanner = imports.transitplugins.openTripPlanner;

const Application = imports.application;
const HVT = imports.hvt;
const TransitPlan = imports.transitPlan;
const Utils = imports.utils;

var GoMetro = class GoMetro extends OpenTripPlanner.OpenTripPlanner {
    constructor() {
        super({ baseUrl: BASE_URL });

        this._tz = GLib.TimeZone.new(NATIVE_TIMEZONE);
    }

    // the GoMetro API only supports start and destination points
    fetchFirstResults() {
        if (this._query.filledPoints.length > 2) {
            Utils.debug('This plugin does not support via locations');
            this._plan.reset();
            this._plan.requestFailed();
            this._query.reset();
        } else {
            super.fetchFirstResults();
        }
    }

    _getPlanUrlWithLocations() {
        let fromLocation = this._query.filledPoints[0].place.location;
        let toLocation = this._query.filledPoints.last().place.location;

        return '%s/%s/trips/%s,%s/%s,%s/%s/%s'.format(BASE_URL,
                                                      API_VERSION,
                                                      fromLocation.latitude,
                                                      fromLocation.longitude,
                                                      toLocation.latitude,
                                                      toLocation.longitude,
                                                      this._getDateAndTimeParams(),
                                                      this._getModesParam());
    }

    _getDateAndTimeParams() {
        let time;
        let date;
        let result;

        if (this._extendPrevious) {
            let params = {};

            this._addCommonParams(params);
            time = params.time;
            date = params.date;
        } else {
            time = this._query.time;
            date = this._query.date;
        }

        if (time) {
            return '%s/%s%s'.format(date, this._query.arriveBy ? '-' : '', time);
        } else  {
            let dateTime = GLib.DateTime.new_now(this._tz);

            return '%s-%s-%s/%s:%s'.format(dateTime.get_year(),
                                           dateTime.get_month(),
                                           dateTime.get_day_of_month(),
                                           dateTime.get_hour(),
                                           dateTime.get_minute())
        }
    }

    // GoMetro seems to (ab)use routeType ferry for communal taxi
    _createLeg(leg, index, legs) {
        let result = super._createLeg(leg, index, legs);

        if (result.routeType === TransitPlan.RouteType.FERRY)
            result.routeType = HVT.TAXI_SERVICE;

        return result;
    }

    _getModesParam() {
        let params = '';
        let transitOptions = this._query.transitOptions;

        if (transitOptions.showAllTransitTypes ||
            transitOptions.transitTypes.includes(TransitPlan.RouteType.TRAIN))
            params += 'RAIL,';
        if (transitOptions.showAllTransitTypes ||
            transitOptions.transitTypes.includes(TransitPlan.RouteType.BUS))
            params += 'BUS,';
        if (transitOptions.showAllTransitTypes ||
            transitOptions.transitTypes.includes(TransitPlan.RouteType.FERRY))
            params += 'FERRY,';
        if (transitOptions.showAllTransitTypes ||
            transitOptions.transitTypes.includes(TransitPlan.RouteType.TRAM))
            params += 'TRAM,';
        if (transitOptions.showAllTransitTypes)
            params += 'GONDOLA,';

        return params + 'WALK';
    }
}
