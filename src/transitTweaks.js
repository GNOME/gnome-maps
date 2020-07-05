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
 * with GNOME Maps; if not, see <https://www.gnu.org/licenses/>.
 *
 * Author: Marcus Lundblad <ml@update.uu.se>
 */

const Champlain = imports.gi.Champlain;
const GLib = imports.gi.GLib;
const Soup = imports.gi.Soup;

const Utils = imports.utils;

const BASE_URL = 'https://gis.gnome.org/services/aux';

var TransitTweaks = class {
    constructor(params) {
        this._name = params.name;
        this._session =
            new Soup.Session({ user_agent: 'gnome-maps/' + pkg.version });

        if (!this._name)
            throw new Error('Missing tweak name');
    }

    applyTweaks(itineraries, callback) {
        if (!this._tweaks) {
            let variable = 'TRANSIT_TWEAKS_' + this._name.toUpperCase();
            let filename = GLib.getenv(variable);

            if (filename) {
                this._readTweaksFromFile(filename);
                this._doApplyTweaks(itineraries, callback);
            } else {
                this._fetchTweaksAsync(itineraries, callback);
            }
        } else {
            this._doApplyTweaks(itineraries, callback);
        }
    }

    _doApplyTweaks(itineraries, callback) {
        if (Object.keys(this._tweaks).length !== 0) {
            itineraries.forEach((itinerary) =>
                this._applyTweaksToItinerary(itinerary));
        }

        callback();
    }

    _readTweaksFromFile(filename) {
        let data = Utils.readFile(filename);

        if (!data) {
            Utils.debug('Failed to read from tweak file');
            this._tweaks = {};
            callback();
        }

        try {
            this._tweaks = JSON.parse(Utils.getBufferText(data));
        } catch (e) {
            Utils.debug('Failed to parse tweaks: ' + e);
            this._tweaks = {};
        }
    }

    _fetchTweaksAsync(itineraries, callback) {
        let uri = new Soup.URI(BASE_URL + '/' + 'tweaks-' + this._name + '.json');
        let request = new Soup.Message({ method: 'GET', uri: uri });

        this._session.queue_message(request, (obj, message) => {
            if (message.status_code !== Soup.Status.OK) {
                Utils.debug('Failed to download tweaks');
                this._tweaks = {};
                callback();
            } else {
                try {
                    this._tweaks = JSON.parse(message.response_body.data);
                } catch (e) {
                    Utils.debug('Failed to parse tweaks: ' + e);
                    this._tweaks = {};
                }

                this._doApplyTweaks(itineraries, callback);
            }
        });
    }

    _applyTweaksToItinerary(itinerary) {
        itinerary.legs.forEach((leg) => {
            if (leg.transit)
                this._applyTweaksToLeg(leg);
        });
    }

    _applyTweaksToLeg(leg) {
        let agencyTweaks = this._tweaks.agencies[leg.agencyName];

        if (agencyTweaks) {
            let routeTypeTweaks = agencyTweaks.routeTypes[leg.routeType];

            if (routeTypeTweaks) {
                let tweakToApply;
                let bboxTweaks = routeTypeTweaks.bboxes;
                let routeTweaks = routeTypeTweaks.routes ?
                                  routeTypeTweaks.routes[leg.route] || null : null;
                let routePatternTweaks = routeTypeTweaks.routePatterns;

                // first check for boundingbox-specific tweaks
                if (bboxTweaks) {
                    bboxTweaks.forEach((tweak) => {
                        let bbox = tweak.bbox;
                        let cbbox = new Champlain.BoundingBox({ bottom: bbox[0],
                                                                left: bbox[1],
                                                                top: bbox[2],
                                                                right: bbox[3] });

                        if (cbbox.covers(leg.polyline[0].latitude,
                                         leg.polyline[0].longitude)) {
                            /* if boundingbox fits, use embedded route or
                             * route pattern tweaks
                             */
                            routeTweaks = tweak.routes ?
                                          tweak.routes[leg.route] : null;
                            routePatternTweaks = tweak.routePatterns;
                        }
                    });
                }

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
