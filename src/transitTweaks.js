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

const GLib = imports.gi.GLib;

const Utils = imports.utils;

var TransitTweaks = class {
    constructor(params) {
        this._name = params.name;

        if (!this._name)
            throw new Error('Missing tweak name');
    }

    applyTweaks(itineraries, callback) {
        /* TODO: for now read tweaks from a file, pointed to by
         * a TRANSIT_TWEAKS_<NAME> env variable
         */
        if (!this._tweaks) {
            let variable = 'TRANSIT_TWEAKS_' + this._name.toUpperCase();
            let filename = GLib.getenv(variable);
            let data = Utils.readFile(filename);

            if (!data) {
                Utils.debug('Failed to read from tweak file');
                callback();
            }

            try {
                this._tweaks = JSON.parse(Utils.getBufferText(data));
            } catch (e) {
                Utils.debug('Failed to parse tweaks: ' + e);
                this._tweaks = {};
            }
        }

        if (this._tweaks !== {}) {
            itineraries.forEach((itinerary) =>
                this._applyTweaksToItinerary(itinerary));
        }

        callback();
    }

    _applyTweaksToItinerary(itinerary) {
        itinerary.legs.forEach((leg) => {
            if (leg.transit)
                this._applyTweaksToLeg(leg);
        });
    }

    _applyTweaksToLeg(leg) {
        let agencyTweaks = this._tweaks.agencies[leg.agencyName];

        Utils.debug('agency: ' + leg.agencyName);
        Utils.debug('agency tweaks: ' + JSON.stringify(agencyTweaks, null, 2));

        if (agencyTweaks) {
            let routeTypeTweaks = agencyTweaks.routeTypes[leg.routeType];

            Utils.debug('route type tweaks: ' + JSON.stringify(routeTypeTweaks, null, 2));

            if (routeTypeTweaks) {
                let tweakToApply;
                let routeTweaks = routeTypeTweaks.routes ?
                                  routeTypeTweaks.routes[leg.route] : null;
                let routePatternTweaks = routeTypeTweaks.routePatterns;

                if (routeTweaks) {
                    tweakToApply = routeTweaks;
                } else if (routePatternTweaks) {
                    routePatternTweaks.forEach((pattern) => {
                        if (!(pattern.regex instanceof RegExp)) {
                            pattern.regex = new RegExp(pattern.regex);
                        }

                        if (leg.route.match(pattern.regex))
                            tweakToApply = pattern;
                    });
                }

                if (!tweakToApply) {
                    tweakToApply = routeTypeTweaks;
                }

                Utils.debug('tweak to apply: ' +
                            JSON.stringify(tweakToApply, null, 2));

                this._applyRouteTweaksToLeg(leg, tweakToApply);
            }
        }
    }

    _applyRouteTweaksToLeg(leg, tweaks) {
        if (tweaks.route)
            leg.route = tweaks.route;

        if (tweaks.routeType)
            leg.routeType = tweaks.routeType;

        if (tweaks.color)
            leg.color = tweaks.color;

        if (tweaks.textColor)
            leg.textColor = tweaks.textColor;
    }
}
