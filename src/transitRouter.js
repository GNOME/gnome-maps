/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2019 Marcus Lundblad
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

const Champlain = imports.gi.Champlain;

const Service = imports.service;
const TransitPlan = imports.transitPlan;
const Utils = imports.utils;

var TransitRouter = class TransitRoute {
    constructor(params) {
        this._plan = new TransitPlan.Plan();
        this._query = params.query;
        this._providers = Service.getService().transitProviders;
    }

    get enabled() {
        return this._providers !== undefined;
    }

    get plan() {
        return this._plan;
    }

    fetchFirstResults() {
        let provider = this._getBestProviderForQuery();
    }

    fetchMoreResults() {

    }

    _getBestProviderForQuery() {
        let startLocation = this._query.filledPoints[0].place.location;
        let endLocation =
            this._query.filledPoints[this._query.points.length - 1].place.location;
        let startCountry =
            Utils.getCountryCodeForCoordinates(startLocation.latitude,
                                               startLocation.longitude);
        let endCountry =
            Utils.getCountryCodeForCoordinates(endLocation.latitude,
                                               endLocation.longitude);

        Utils.debug('country of start and end: ' + startCountry + ', ' + endCountry);

        let matchingProviders = [];

        this._providers.forEach((p) => {
            let provider = p.provider;
            let coverage = provider.coverage;

            Utils.debug('checking provider ' + provider.name);

            if (!coverage) {
                Utils.debug('No coverage info for provider ' + provider.name);
                return;
            }

            let countries = coverage.countries;

            if (countries) {
                Utils.debug('Number of countries covered: ' + countries.length);

                if (countries.includes(startCountry) &&
                    countries.includes(endCountry)) {
                    Utils.debug('Provider matches on country');
                    matchingProviders.push(provider);
                    return;
                }
            }

            let bboxes = coverage.bboxes;

            if (bboxes) {
                let coversStart = false;
                let coversEnd = false;
                bboxes.forEach((bbox) => {
                    if (bbox.length !== 4) {
                        Utils.debug('malformed bounding box for provider ' + provider.name);
                        return;
                    }

                    let [x1, y1, x2, y2] = bbox;
                    let cbbox = new Champlain.BoundingBox({ bottom: x1,
                                                            left: y1,
                                                            top: x2,
                                                            right: y2 });

                    if (cbbox.covers(startLocation.latitude,
                                     startLocation.longitude))
                        coversStart = true;

                    if (cbbox.covers(endLocation.latitude,
                                     endLocation.longitude))
                        coversEnd = true;
                });

                if (coversStart && coversEnd) {
                    Utils.debug('Provider matches on bounding boxes');
                    matchingProviders.push(provider);
                    return;
                }
            }
        });

        Utils.debug('Number of matching providers: ' + matchingProviders.length);
    }
};
