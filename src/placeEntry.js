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
import {Place} from './place.js';
import {PlaceStore} from './placeStore.js';
import {PlacePopover} from './placePopover.js';
import * as URIS from './uris.js';
import { StoredRoute } from './storedRoute.js';

const _ = gettext.gettext;

// minimum number of characters to start completion
const MIN_CHARS_COMPLETION = 3;

// pattern matching CJK ideographic characters
const IDEOGRAPH_PATTERN = /[\u3300-\u9fff]/

const SEARCH_TIMEOUT = 150; // ms

export class PlaceEntry extends Gtk.Entry {

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
            this.setTextWithoutTriggeringSearch(this._placeText);

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

    constructor({mapView, maxChars, matchRoute, hasPoiBrowser = false,
                 ...params}) {
        super({ secondary_icon_activatable: true, ...params });

        this._mapView = mapView;
        this._matchRoute = matchRoute ?? false;
        this._filter = new Gtk.FilterListModel({
            model: Application.placeStore,
            filter: Gtk.CustomFilter.new(this._completionVisibleFunc.bind(this)),
        });

        this._keyController = new Gtk.EventControllerKey();
        this._keyController.connect('key-pressed', this._onKeyPressed.bind(this));
        this.add_controller(this._keyController);

        this.connect('activate', this._onActivate.bind(this));

        this._popover =
            this._createPopover(maxChars, hasPoiBrowser);

        this.connect('changed', this._onChanged.bind(this));
        this.connect('icon-press', this._onIconClick.bind(this));

        this._cache = {};
        this._searchTimeoutId = 0;

        // clear cache when view moves, as result are location-dependent
        this._mapView.map.viewport.connect('notify::latitude', () => this._cache = {});
        // clear cache when zoom level changes, to allow limiting location bias
        this._mapView.map.viewport.connect('notify::zoom-level', () => this._cache =  {});

        this._updateIcon();
        this.add_css_class('search');
    }

    setTextWithoutTriggeringSearch(text) {
        this._setText = text;
        this.text = text;
    }

    _onChanged() {
        this._updateIcon();

        // cancel already ongoing timeout
        if (this._searchTimeoutId)
            GLib.source_remove(this._searchTimeoutId);

        this._searchTimeoutId = GLib.timeout_add(null, SEARCH_TIMEOUT, () => {
            this._searchTimeoutId = 0;
            this._onSearchChanged();
        });
    }

    _updateIcon() {
        this.secondary_icon_name =
            this.text?.length > 0 ? 'edit-clear-symbolic' : null;
        this.secondary_icon_tooltip_text =
            this.text?.length > 0 ? _("Clear Entry") : null;
    }

    _onIconClick() {
        this.text = '';
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
            this._handleSearchInput();
        } else {
            /* if the popover is showing the POI browser, don't hide it,
             * this prevents the popover closing and popping up again if
             * the user starts typing to do a free-text search
             */
            if (!this._popover.isShowingPoiBrowser)
                this._popover.popdown();

            if (this.text.length === 0)
                this.place = null;
            this._previousSearch = null;
        }
    }

    _handleSearchInput() {
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
    }

    _locEquals(placeA, placeB) {
        if (!placeA.location || !placeB.location)
            return false;

        return (placeA.location.latitude === placeB.location.latitude &&
                placeA.location.longitude === placeB.location.longitude);
    }

    _createPopover(maxChars, hasPoiBrowser) {
        let popover = new PlacePopover({ entry:         this,
                                         maxChars:      maxChars,
                                         hasPoiBrowser: hasPoiBrowser });
        popover.set_parent(this);
        this._captureController = new Gtk.EventControllerKey();
        this._captureController.set_propagation_phase(Gtk.PHASE_BUBBLE);
        this._captureController.connect('key-pressed',
                                        this._onKeyPressed.bind());
        popover.add_controller(this._captureController);

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

            this._popover.handleArrowKey(direction);

            return true;
        }

        return false;
    }

    _onActivate() {
        /* if the search result is short enough and doesn't start with a CJK
         * ideograph, it wouldn't already have been triggered in the "search
         * changed" handler.
         * In case the popover isn't already showing (e.g. showing POI search)
         * trigger a search, allowing explicitly searching for short strings
         */
        if (!this._popover.visible && this.text.length > 0 &&
            this.text.length < MIN_CHARS_COMPLETION &&
            !(this.text.length > 0 && this.text[0].match(IDEOGRAPH_PATTERN))) {
            this._handleSearchInput();
        } else {
            this._popover.handleActivate();
        }
    }

    _completionVisibleFunc(placeItem) {
        if (!(placeItem.place instanceof StoredRoute) ||
            (!this._matchRoute && placeItem.place instanceof StoredRoute))
            return false;

        if (placeItem.place !== null)
            return placeItem.place.match(this.text);
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
            const query = URIS.getUriParam(this.text, 'q');

            if (query) {
                this.text = query;
            } else {
                try {
                    const location = new GeocodeGlib.Location();
                    const [
                        geoUri,
                        zoom = this._mapView.map.viewport.zoom_level
                    ] = URIS.parseAsGeoURI(this.text);

                    location.set_from_uri(geoUri);
                    this.place = new Place({ location:    location,
                                             store:       false,
                                             initialZoom: zoom });
                } catch(e) {
                    this.root.showToast(_("Failed to parse Geo URI"));
                }
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
     * @param {Place[]} places array of places from search result
     * @param {string} searchText original search string to highlight in results
     * @param {boolean} includeContactsAndRoute whether to include contacts and recent routes
     *                         among results
     */
    updateResults(places, searchText, includeContactsAndRoutes) {
        const parsedLocation = Place.parseCoordinates(searchText);
        let completedPlaces = parsedLocation ?
                              [new Place({ location: parsedLocation, store: false })] :
                              [];

        if (includeContactsAndRoutes) {
            this._filter.filter.changed(Gtk.FilterChange.DIFFERENT);
            for (let i = 0; i < this._filter.n_items; i++) {
                const placeItem = this._filter.get_item(i);
                completedPlaces.push(placeItem.place);
            }
        }

        if (places)
            completedPlaces = completedPlaces.concat(places);

        if (completedPlaces.length === 0) {
            this.place = null;
            this._popover.showNoResult();
            return;
        }

        this._popover.updateResult(completedPlaces, searchText);
        this._popover.showResult();
    }

    browsePois() {
        this._popover.showPoiMainCategories();
        /* clear text entry incase it has a previous selected place
         * highlighted to avoid confusion, as this text is not taken into
         * account when searching for POIs
         */
        this.text = '';
        this.grab_focus();
    }

    vfunc_size_allocate(width, height, baseline) {
        super.vfunc_size_allocate(width, height, baseline);
        this._popover.present();
    }
}

GObject.registerClass({
    Properties: {
        'place': GObject.ParamSpec.object('place',
                                          'Place',
                                          'The selected place',
                                          GObject.ParamFlags.READABLE |
                                          GObject.ParamFlags.WRITABLE,
                                          Place)
    }
}, PlaceEntry);
