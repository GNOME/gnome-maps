/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2013,2014 Jonas Danielsson, Mattias Bengtsson.
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
 * with GNOME Maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Jonas Danielsson <jonas@threetimestwo.org>
 *         Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>
 */

const GObject = imports.gi.GObject;
const Geocode = imports.gi.GeocodeGlib;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Application = imports.application;
const PlaceStore = imports.placeStore;
const SearchPopup = imports.searchPopup;
const Utils = imports.utils;

Geocode.Location.prototype.equals = function(location) {
    return (location.latitude === this.latitude &&
            location.longitude === this.longitude);
};

// Matches coordinates string with the format "<lat>, <long>"
const COORDINATES_REGEX = /^\s*(\-?\d+(?:\.\d+)?)\s*,\s*(\-?\d+(?:\.\d+)?)\s*$/;

const PlaceEntry = new Lang.Class({
    Name: 'PlaceEntry',
    Extends: Gtk.SearchEntry,
    Properties: {
        'place': GObject.ParamSpec.object('place',
                                          'Place',
                                          'The selected place',
                                          GObject.ParamFlags.READABLE |
                                          GObject.ParamFlags.WRITABLE,
                                          Geocode.Place)
    },

    set place(p) {
        if (!this._place && !p)
            return;

        if (this._place && p && this._place.location.equals(p.location))
            return;

        if (p) {
            if (p.name) {
                this.text = p.name;
            } else
                this.text = p.location.latitude + ', ' + p.location.longitude;
        } else
            this.text = '';

        this._place = p;
        this.notify('place');
    },

    get place() {
        return this._place;
    },

    get popover() {
        return this._popover;
    },

    _init: function(props) {
        let numVisible = props.num_visible || 6;
        delete props.num_visible;
        this._mapView = props.mapView;
        delete props.mapView;

        if (!props.loupe)
            props.primary_icon_name = null;
        delete props.loupe;

        let maxChars = props.maxChars;
        delete props.maxChars;

        let parseOnFocusOut = props.parseOnFocusOut;
        delete props.parseOnFocusOut;

        props.completion = this._createCompletion();
        this.parent(props);

        this._popover = this._createPopover(numVisible, maxChars);

        this.connect('activate', this._onActivate.bind(this));
        this.connect('search-changed', (function() {
            this.popover.hide();

            if (this.text.length === 0)
                this.place = null;
        }).bind(this));

        if (parseOnFocusOut) {
            this.connect('focus-out-event', (function() {
                this._parse();
                return false;
            }).bind(this));
        }
    },

    _createCompletion: function() {
        let { completion } = Utils.getUIObject('place-entry',
                                               ['completion']);

        completion.set_model(Application.placeStore);
        completion.set_match_func(PlaceStore.completionMatchFunc);

        completion.connect('match-selected', (function(c, model, iter) {
            this.place = model.get_value(iter, PlaceStore.Columns.PLACE);
            return true;
        }).bind(this));

        return completion;
    },

    _createPopover: function(numVisible, maxChars) {
        let popover = new SearchPopup.SearchPopup({ num_visible:   numVisible,
                                                    relative_to:   this,
                                                    maxChars:      maxChars});

        this.connect('size-allocate', (function(widget, allocation) {
            // Magic number to make the alignment pixel perfect.
            let width_request = allocation.width + 20;
            popover.width_request = width_request;
        }).bind(this));

        popover.connect('selected', (function(widget, place) {
            this.place = place;
            popover.hide();
        }).bind(this));

        return popover;
    },

    _validateCoordinates: function(lat, lon) {
        return lat <= 90 && lat >= -90 && lon <= 180 && lon >= -180;
    },

    _parseCoordinates: function(text) {
        let match = text.match(COORDINATES_REGEX);

        if (match) {
            let latitude = parseFloat(match[1]);
            let longitude = parseFloat(match[2]);

            if (this._validateCoordinates(latitude, longitude)) {
                return new Geocode.Location({ latitude: latitude,
                                              longitude: longitude });
            } else
                return null;
        } else
            return null;
    },

    _parse: function() {
        if (this.text.length === 0) {
            this.place = null;
            return true;
        }

        let parsedLocation = this._parseCoordinates(this.text);
        if (parsedLocation) {
            this.place = new Geocode.Place({ location: parsedLocation });
            return true;
        }

        return false;
    },

    _onActivate: function() {
        if (this._parse())
            return;

        let bbox = this._mapView.view.get_bounding_box();

        this._popover.showSpinner();
        Application.geocodeService.search(this.text, bbox, (function(places) {
            if (!places) {
                this.place = null;
                this._popover.hide();
                return;
            }
            this._popover.updateResult(places, this.text);
            this._popover.showResult();
        }).bind(this));
    }
});
