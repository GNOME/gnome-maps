/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2013, 2014 Red Hat, Inc., Mattias Bengtsson
 *
 * gnome-maps is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 2 of the License, or (at your
 * option) any later version.
 *
 * gnome-maps is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with gnome-maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Zeeshan Ali (Khattak) <zeeshanak@gnome.org>
 *         Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>
 */

const Geocode = imports.gi.GeocodeGlib;
const Lang = imports.lang;

const Application = imports.application;
const Place = imports.place;
const Utils = imports.utils;

var GeocodeService = new Lang.Class({
    Name: 'GeocodeService',

    _init: function() { },

    search: function(string, bbox, cancellable, callback) {
        let answerCount = Application.settings.get('max-search-results');
        let forward     = Geocode.Forward.new_for_string(string);

        if (bbox) {
            forward.search_area = new Geocode.BoundingBox({
                top:    bbox.top,
                left:   bbox.left,
                bottom: bbox.bottom,
                right:  bbox.right
            });
        }
        forward.bounded = false;
        forward.set_answer_count(answerCount);
        forward.search_async(cancellable, (forward, res) => {
            try {
                let places = forward.search_finish(res);

                if (places !== null) {
                    places = places.map((p) => new Place.Place({ place: p }));
                }

                callback(places);
            } catch (e) {
                callback(null);
            }
        });
    },

    reverse: function(location, cancellable, callback) {
        let reverse = Geocode.Reverse.new_for_location(location);

        Application.application.mark_busy();
        reverse.resolve_async(cancellable, (reverse, res) => {
            Application.application.unmark_busy();
            try {
                let place = new Place.Place({ place: reverse.resolve_finish(res) });
                callback(place);
            } catch (e) {
                Utils.debug("Error finding place at " +
                            this._latitude + ", " +
                            this._longitude + ": " +
                            e.message);
                callback(null);
            }
        });
    }
});
