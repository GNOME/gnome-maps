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
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>.
 *
 * Author: Jonas Danielsson <jonas@threetimestwo.org>
 *         Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>
 */

import gettext from 'gettext';

import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import GeocodeGlib from 'gi://GeocodeGlib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {Application} from './application.js';
import * as GeocodeFactory from './geocode.js';
import {Location} from './location.js';
import {Place} from './place.js';
import {PlaceStore} from './placeStore.js';
import {PlacePopover} from './placePopover.js';
import * as URIS from './uris.js';
import * as Utils from './utils.js';

const _ = gettext.gettext;

// minimum number of characters to start completion
const MIN_CHARS_COMPLETION = 3;

// pattern matching CJK ideographic characters
const IDEOGRAPH_PATTERN = /[\u3300-\u9fff]/

export class PlaceEntry extends Gtk.SearchEntry {

    set place(p) {
        if (!this._place && !p)
            return;

        /* if this entry belongs to a routing query entry, don't notify when
         * setting the same place, otherwise it will trigger twice when
         * initiating from the context menu
         */
        if (!this._matchRoute && this._place && p && this._locEquals(this._place, p))
            return;

        if (p) {
            if (p.name)
                this._placeText = p.name;
            else
                this._placeText = '%.5f, %.5f'.format(p.location.latitude,
                                                      p.location.longitude);
        } else {
            this._placeText = '';
        }

        if (this.text !== this._placeText)
            this._setTextWithoutTriggerSearch(this._placeText);

        this._place = p;

        this.notify('place');
    }

    get place() {
        return this._place;
    }

    get popover() {
        return this._popover;
    }

    get mapView() {
        return this._mapView;
    }

    constructor({mapView, maxChars, matchRoute, ...params}) {
        super(params);

        this._mapView = mapView;
        this._matchRoute = matchRoute ?? false;
        this._filter = new Gtk.TreeModelFilter({ child_model: Application.placeStore });
        this._filter.set_visible_func(this._completionVisibleFunc.bind(this));

        this._keyController = new Gtk.EventControllerKey();
        this._keyController.connect('key-pressed', this._onKeyPressed.bind(this));
        this.add_controller(this._keyController);

        this.connect('activate', this._onActivate.bind(this));

        this._popover = this._createPopover(maxChars);

        this.connect('search-changed', this._onSearchChanged.bind(this));

        this._cache = {};

        // clear cache when view moves, as result are location-dependent
        this._mapView.map.viewport.connect('notify::latitude', () => this._cache = {});
        // clear cache when zoom level changes, to allow limiting location bias
        this._mapView.map.viewport.connect('notify::zoom-level', () => this._cache =  {});
    }

    _setTextWithoutTriggerSearch(text) {
        this._setText = text;
        this.text = text;
    }

    _onSearchChanged() {
        if (this._parse())
            return;

        // wait for an ongoing search
        if (this._cancellable)
            return;

        // don't trigger a search when setting explicit text (such as reordering points)
        if (this.text === this._setText)
            return;

        /* start search if more than the threshold number of characters have
         * been entered, or if the first character is in the ideographic CJK
         * block, as for these, shorter strings could be meaningful
         */
        if ((this.text.length >= MIN_CHARS_COMPLETION ||
             (this.text.length > 0 && this.text[0].match(IDEOGRAPH_PATTERN))) &&
            this.text !== this._placeText) {
            let cachedResults = this._cache[this.text];

            if (cachedResults) {
                this.updateResults(cachedResults, this.text, true);
            } else {
                // if no previous search has been performed, show spinner
                if (!this._previousSearch ||
                    this._previousSearch.length < MIN_CHARS_COMPLETION ||
                    this._placeText) {
                    this._popover.showSpinner();
                }
                this._placeText = '';
                this._doSearch();
            }
        } else {
            this._popover.popdown();
            this.grab_focus();
            if (this.text.length === 0)
                this.place = null;
            this._previousSearch = null;
        }
    }

    _locEquals(placeA, placeB) {
        if (!placeA.location || !placeB.location)
            return false;

        return (placeA.location.latitude === placeB.location.latitude &&
                placeA.location.longitude === placeB.location.longitude);
    }

    _createPopover(maxChars) {
        let popover = new PlacePopover({ entry:         this,
                                         maxChars:      maxChars });

        popover.set_parent(this);
        this.set_key_capture_widget(popover);

        popover.connect('selected', (widget, place) => {
            this.place = place;
            popover.popdown();
        });

        return popover;
    }

    _onKeyPressed(controller, keyval, keycode, state) {
        if (keyval === Gdk.KEY_Escape) {
            this._popover.popdown();
            this._popover.list.unselect_all();
            return true;
        } else if (keyval === Gdk.KEY_KP_Up ||
                   keyval === Gdk.KEY_Up ||
                   keyval === Gdk.KEY_KP_Down ||
                   keyval === Gdk.KEY_Down) {
            let length = this._popover.numResults;
            let direction =
                (keyval === Gdk.KEY_KP_Up || keyval === Gdk.KEY_Up) ? -1 : 1;

            /* if the popover is not already showing and there are previous
             * results when pressing arrow down, show the results
             */
            if (direction === 1 && !this._popover.visible && length > 0) {
                this._popover.popup();
                return true;
            }

            let row = this._popover.list.get_selected_row();
            let idx;

            if (!row)
                idx = (direction === 1) ? 0 : length - 1;
            else
                idx = row.get_index() + direction;

            let inBounds = 0 <= idx && idx < length;

            if (inBounds)
                this._popover.selectRow(this._popover.list.get_row_at_index(idx));
            else
                this._popover.list.unselect_all();

            return true;
        }

        return false;
    }

    _onActivate() {
        // if the popover is visible and we have a selected item, activate it
        let row = this._popover.list.get_selected_row();

        if (this._popover.visible && row)
            row.activate();
    }

    _completionVisibleFunc(model, iter) {
        let place = model.get_value(iter, PlaceStore.Columns.PLACE);
        let type = model.get_value(iter, PlaceStore.Columns.TYPE);

        if (type !== PlaceStore.PlaceType.RECENT_ROUTE ||
            (!this._matchRoute && type === PlaceStore.PlaceType.RECENT_ROUTE))
            return false;

        if (place !== null)
            return place.match(this.text);
        else
            return false;
    }

    /**
     * Returns true if two locations are equal when rounded to displayes
     * coordinate precision
     */
    _roundedLocEquals(locA, locB) {
        return '%.5f, %.5f'.format(locA.latitude, locA.longitude) ===
               '%.5f, %.5f'.format(locB.latitude, locB.longitude)
    }

    _parse() {
        let parsed = false;

        if (this.text.startsWith('geo:')) {
            let location = new GeocodeGlib.Location();

            try {
                location.set_from_uri(this.text);
                this.place = new Place({ location: location });
            } catch(e) {
                this.root.showToast(_("Failed to parse Geo URI"));
            }

            parsed = true;
        }

        if (this.text.startsWith('maps:')) {
            let query = URIS.parseMapsURI(this.text);

            if (query) {
                this.text = query;
            } else {
                this.root.showToast(_("Failed to parse Maps URI"));
            }

            parsed = true;
        }

        let parsedLocation = Place.parseCoordinates(this.text);
        if (parsedLocation) {
            /* if the place was a parsed OSM coordinate URL, it will have
             * gotten re-written as bare coordinates and trigger a search-changed,
             * in this case don't re-set the place, as it will loose the zoom
             * level from the URL if set
             */
            if (!this.place ||
                !this._roundedLocEquals(parsedLocation, this.place.location))
                this.place = new Place({ location: parsedLocation });
            parsed = true;
        }

        if (this.text.startsWith('http://') ||
            this.text.startsWith('https://')) {
            if (this._cancellable)
                this._cancellable.cancel();
            this._cancellable = null;
            Place.parseHttpURL(this.text, (place, error) => {
                if (place)
                    this.place = place;
                else
                    this.root.showToast(error);
            });

            /* don't cancel ongoing search, as we have started an async
             * operation looking up the OSM object
             */
            return true;
        }

        if (parsed && this._cancellable)
            this._cancellable.cancel();

        return parsed;
    }

    _doSearch() {
        if (this._cancellable)
            this._cancellable.cancel();
        this._cancellable = new Gio.Cancellable();
        this._previousSearch = this.text;

        GeocodeFactory.getGeocoder().search(this.text,
                                            this._mapView.map.viewport.latitude,
                                            this._mapView.map.viewport.longitude,
                                            this._cancellable,
                                            (places, error) => {
            this._cancellable = null;

            if (error) {
                this.place = null;
                this._popover.showError();
            } else {
                this.updateResults(places, this.text, true);

                // cache results for later
                this._cache[this._previousSearch] = places;
            }

            // if search input has been updated, trigger a refresh
            if (this.text !== this._previousSearch)
                this._onSearchChanged();
        });
    }

    /**
     * Update results popover
     * places array of places from search result
     * searchText original search string to highlight in results
     * includeContactsAndRoute whether to include contacts and recent routes
     *                         among results
     */
    updateResults(places, searchText, includeContactsAndRoutes) {
        if (!places) {
                this.place = null;
                this._popover.showNoResult();
                return;
        }

        let completedPlaces = [];


        if (includeContactsAndRoutes) {
            this._filter.refilter();
            this._filter.foreach((model, path, iter) => {
                let place = model.get_value(iter, PlaceStore.Columns.PLACE);
                let type = model.get_value(iter, PlaceStore.Columns.TYPE);

                completedPlaces.push({ place: place, type: type });
            });
        }

        let placeStore = Application.placeStore;

        completedPlaces =
            completedPlaces.concat(placeStore.getCompletedPlaces(places));

        this._popover.updateResult(completedPlaces, searchText);
        this._popover.showResult();
    }
}

GObject.registerClass({
    Properties: {
        'place': GObject.ParamSpec.object('place',
                                          'Place',
                                          'The selected place',
                                          GObject.ParamFlags.READABLE |
                                          GObject.ParamFlags.WRITABLE,
                                          GeocodeGlib.Place)
    }
}, PlaceEntry);
