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

/**
 * Class responsible for delegating requests to perform routing in transit
 * mode.
 * Holds the the shared plan instance (filled with journeys on successful
 * requests).
 */
var TransitRouter = class TransitRoute {
    constructor(params) {
        this._plan = new TransitPlan.Plan();
        this._query = params.query;
        this._providers = Service.getService().transitProviders;
        this._providerCache = [];
        this._language = Utils.getLanguage();
        this._probePlugins();
    }

    get enabled() {
        return this._providers !== undefined;
    }

    get plan() {
        return this._plan;
    }

    /**
     * Called when the query has been updated to trigger the first set
     * of results-
     */
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

    /**
     * Called to fetch additional (later or earlier) results depending on the
     * query settings.
     */
    fetchMoreResults() {
        if (this._currPluginInstance)
            this._currPluginInstance.fetchMoreResults();
        else
            throw new Error('No previous provider');
    }

    _probePlugins() {
        this._availablePlugins = [];

        for (let module in imports.transitplugins) {
            for (let pluginClass in imports.transitplugins[module]) {
                this._availablePlugins[pluginClass] = module;
            }
        }
    }

    /**
     * Get attribution for a provider. Returns a language-specific
     * 'attribution:<lang>' tag if available, otherwise 'attribution'
     */
    _getAttributionForProvider(provider) {
        if (provider['attribution:' + this._language])
            return provider['attribution:' + this._language];
        else if (provider.attribution)
            return provider.attribution;
        else
            return null;
    }

    _getMatchingProvidersForLocation(location) {
        let country = Utils.getCountryCodeForCoordinates(location.latitude,
                                                         location.longitude);

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
                    if (countries.includes(country)) {
                        matchingProviders[provider.name] = provider;
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

                    if (cbbox.covers(location.latitude,
                                     location.longitude)) {
                        matchingProviders[provider.name] = provider;
                        return;
                    }
                }
            });
        });

        Utils.debug('returning matching providers: ' + matchingProviders.length);
        return matchingProviders;
    }

    /**
     * Get the most preferred provider for a given query.
     * Return: an array with the provider definition and the plugin instance,
     *         or null if no matching provider was found.
     */
    _getBestProviderForQuery() {
        let startLocation = this._query.filledPoints[0].place.location;
        let endLocation =
            this._query.filledPoints[this._query.points.length - 1].place.location;

        let matchingProvidersForStart =
            this._getMatchingProvidersForLocation(startLocation);
        let matchingProvidersForEnd =
            this._getMatchingProvidersForLocation(endLocation);

        let matchingProviders = [];

        // check all candidate providers matching on the start location
        for (let name in matchingProvidersForStart) {
            let providerAtStart = matchingProvidersForStart[name];
            let providerAtEnd = matchingProvidersForEnd[name];

            /* if the provider also matches on the end location, consider it
             * as a potential candidate
             */
            if (providerAtEnd) {
                let order = this._sortProviders(providerAtStart, providerAtEnd);

                /* add the provider at it lowest priority to favor higher
                 * priority providers in "fringe cases"
                 */
                if (order < 0)
                    matchingProviders.push(providerAtStart);
                else
                    matchingProviders.push(providerAtEnd);
            }
        }

        matchingProviders.sort(this._sortProviders);

        for (let i = 0; i < matchingProviders.length; i++) {
            let provider = matchingProviders[i];
            let plugin = provider.plugin;

            if (this._providerCache[provider.name])
                return [provider, this._providerCache[provider.name]];

            let module = this._availablePlugins[plugin];

            if (module) {
                try {
                    let params = provider.params;
                    let instance =
                        params ? new imports.transitplugins[module][plugin](params) :
                                 new imports.transitplugins[module][plugin]();

                    this._providerCache[provider.name] = instance;

                    return [provider, instance];
                } catch (e) {
                    Utils.debug('Failed to instanciate transit plugin: ' +
                                plugin + ": " + e);
                }
            } else {
                Utils.debug('Transit provider plugin not available: ' + plugin);
            }
        }

        Utils.debug('No suitable transit provider found');
        return null;
    }

    /**
     * Sort function to sort providers in by preference.
     * If both providers have a priority set, prefers the one with a lower
     * value (higher prio), otherwise the one that has a priority set (if any),
     * else no specific order.
     */
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
