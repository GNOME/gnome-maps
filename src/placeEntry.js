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

const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Geocode = imports.gi.GeocodeGlib;
const Lang = imports.lang;

const Application = imports.application;
const PlaceStore = imports.placeStore;
const SearchPopup = imports.searchPopup;
const Utils = imports.utils;

const PlaceEntry = new Lang.Class({
    Name: 'PlaceEntry',
    Extends: Gtk.SearchEntry,
    Properties: {
        'place': GObject.ParamSpec.object('place',
                                          'Place',
                                          'The selected place',
                                          GObject.ParamFlags.READWRITE,
                                          Geocode.Place)
    },

    set place(p) {
        this._place = p;
        this.text   = p ? p.name : "";
        this.notify("place");
    },
    get place() {
        return this._place;
    },

    get popover() {
        return this._popover;
    },

    _init: function(props) {
        let numVisible = props.num_visible || 10;
        delete props.num_visible;
        this._mapView = props.mapView;
        delete props.mapView;

        props.completion = this._createCompletion();
        this.parent(props);

        this._popover = this._createPopover(numVisible);

        this.connect('activate', this._onActivate.bind(this));
        this.connect('search-changed', (function() {
            this.popover.hide();

            if (this.text.length === 0)
                this.place = null;
        }).bind(this));
    },

    _createCompletion: function() {
        let { completion } = Utils.getUIObject('place-entry',
                                               ['completion']);

        completion.set_model(Application.placeStore);
        completion.set_match_func(PlaceStore.completionMatchFunc);

        completion.connect('match-selected', (function(c, model, iter) {
            this.place = model.get_value(iter, PlaceStore.Columns.PLACE);
        }).bind(this));

        return completion;
    },

    _createPopover: function(numVisible) {
        let popover = new SearchPopup.SearchPopup({ num_visible:   numVisible,
                                                    relative_to:   this,
                                                    no_show_all:   true,
                                                    visible:       true });
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

    _onActivate: function() {
        if (this.text.length === 0) {
            this.place = null;
            return;
        }

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
