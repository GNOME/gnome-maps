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
        this._providerCache = [];
        this._language = Utils.getLanguage();
    }

    get enabled() {
        return this._providers !== undefined;
    }

    get plan() {
        return this._plan;
    }

    fetchFirstResults() {
        let bestProvider = this._getBestProviderForQuery();

        if (bestProvider) {
            let provider = bestProvider[0];

            this._currPluginInstance = bestProvider[1];
            this._plan.attribution = this._getAttributionForProvider(provider);
            if (provider.attributionUrl)
                this._plan.attributionUrl = provider.attributionUrl;
            this._currPluginInstance.fetchFirstResults();
        } else {
            this._plan.reset();
            this._query.reset();
            this._plan.noProvider();
        }
    }

    fetchMoreResults() {
        if (this._currPluginInstance)
            this._currPluginInstance.fetchMoreResults();
        else
            throw new Error('No previous provider');
    }

    _getAttributionForProvider(provider) {
        if (provider['attribution:' + this._language])
            return provider['attribution:' + this._language];
        else if (provider.attribution)
            return provider.attribution;
        else
            return null;
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

        let matchingProviders = [];

        this._providers.forEach((p) => {
            let provider = p.provider;
            let areas = provider.areas;

            if (!areas) {
                Utils.debug('No coverage info for provider ' + provider.name);
                return;
            }

            areas.forEach((area) => {
                /* if the area has a specified priority, override the
                 * overall area priority, this allows sub-areas of of
                 * coverage for a provider to have higher or lowe priorities
                 * than other providers (e.g. one "native" to that area
                 */
                if (area.priority)
                    provider.priority = area.priority;

                let countries = area.countries;

                if (countries) {
                    if (countries.includes(startCountry) &&
                        countries.includes(endCountry)) {
                        matchingProviders.push(provider);
                        return;
                    }
                }

                let bbox = area.bbox;

                if (bbox) {
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
                                     startLocation.longitude) &&
                        cbbox.covers(endLocation.latitude,
                                     endLocation.longitude)) {
                        matchingProviders.push(provider);
                        return;
                    }
                }
            });
        });

        if (matchingProviders.length === 0)
            return null;

        matchingProviders.sort(this._sortProviders);

        for (let i = 0; i < matchingProviders.length; i++) {
            let provider = matchingProviders[i];
            let plugin = provider.plugin;

            if (this._providerCache[plugin])
                return [provider, this._providerCache[plugin]];

            let module =
                plugin[0].toLowerCase() + plugin.substring(1, plugin.length);

            try {
                let params = provider.params;
                let instance =
                    params ? new imports.transitplugins[module][plugin](params) :
                             new imports.transitplugins[module][plugin]();

                this._providerCache[plugin] = instance;

                return [provider, instance];
            } catch (e) {
                Utils.debug('Failed to load plugin: ' + plugin + ": " + e);
            }
        }

        Utils.debug('No suitable provider found');
        return null;
    }

    _sortProviders(p1, p2) {
        if (p1.priority && p2.priority)
            return p1.priority - p2.priority;
        else if (p1.priority)
            return -1;
        else if (p2.priority)
            return 1;
        else
            return 0;
    }
};
