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

const _ = imports.gettext.gettext;

const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Geocode = imports.gi.GeocodeGlib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;

const Application = imports.application;
const GeocodeFactory = imports.geocode;
const Location = imports.location;
const Place = imports.place;
const PlaceStore = imports.placeStore;
const PlacePopover = imports.placePopover;
const URIS = imports.uris;
const Utils = imports.utils;

// minimum number of characters to start completion
const MIN_CHARS_COMPLETION = 3;

// pattern matching CJK ideographic characters
const IDEOGRAPH_PATTERN = /[\u3300-\u9fff]/

var PlaceEntry = GObject.registerClass({
    Properties: {
        'place': GObject.ParamSpec.object('place',
                                          'Place',
                                          'The selected place',
                                          GObject.ParamFlags.READABLE |
                                          GObject.ParamFlags.WRITABLE,
                                          Geocode.Place)
    }
}, class PlaceEntry extends Gtk.SearchEntry {

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

        this.text = this._placeText;

        this._place = p;
        this.notify('place');
    }

    get place() {
        return this._place;
    }

    get popover() {
        return this._popover;
    }

    _init(props) {
        let numVisible = props.num_visible || 6;
        delete props.num_visible;
        this._mapView = props.mapView;
        delete props.mapView;

        if (!props.loupe)
            props.primary_icon_name = null;
        delete props.loupe;

        let maxChars = props.maxChars;
        delete props.maxChars;

        this._matchRoute = props.matchRoute || false;
        delete props.matchRoute;

        super._init(props);

        this._filter = new Gtk.TreeModelFilter({ child_model: Application.placeStore });
        this._filter.set_visible_func(this._completionVisibleFunc.bind(this));

        this._popover = this._createPopover(numVisible, maxChars);

        this.connect('search-changed', this._onSearchChanged.bind(this));

        this._cache = {};

        // clear cache when view moves, as result are location-dependent
        this._mapView.view.connect('notify::latitude', () => this._cache = {});
    }

    _onSearchChanged() {
        if (this._parse())
            return;

        // wait for an ongoing search
        if (this._cancellable)
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
            this._popover.hide();
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

    _createPopover(numVisible, maxChars) {
        let popover = new PlacePopover.PlacePopover({ num_visible:   numVisible,
                                                      relative_to:   this,
                                                      maxChars:      maxChars});

        this.connect('size-allocate', (widget, allocation) => {
            // Magic number to make the alignment pixel perfect.
            let width_request = allocation.width + 20;
            // set at least 320 px width to avoid too narrow in the sidebar
            popover.width_request = Math.max(width_request, 320);
        });

        popover.connect('selected', (widget, place) => {
            this.place = place;
            popover.hide();
        });

        return popover;
    }

    _completionVisibleFunc(model, iter) {
        let place = model.get_value(iter, PlaceStore.Columns.PLACE);
        let type = model.get_value(iter, PlaceStore.Columns.TYPE);

        if (type !== PlaceStore.PlaceType.CONTACT &&
            type !== PlaceStore.PlaceType.RECENT_ROUTE ||
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
            let location = new Geocode.Location();

            try {
                location.set_from_uri(this.text);
                this.place = new Place.Place({ location: location });
            } catch(e) {
                let msg = _("Failed to parse Geo URI");
                Utils.showDialog(msg, Gtk.MessageType.ERROR, this.get_toplevel());
            }

            parsed = true;
        }

        if (this.text.startsWith('maps:')) {
            let query = URIS.parseMapsURI(this.text);

            if (query) {
                this.text = query;
            } else {
                let msg = _("Failed to parse Maps URI");
                Utils.showDialog(msg, Gtk.MessageType.ERROR, this.get_toplevel());
            }

            parsed = true;
        }

        let parsedLocation = Place.Place.parseCoordinates(this.text);
        if (parsedLocation) {
            /* if the place was a parsed OSM coordinate URL, it will have
             * gotten re-written as bare coordinates and trigger a search-changed,
             * in this case don't re-set the place, as it will loose the zoom
             * level from the URL if set
             */
            if (!this.place ||
                !this._roundedLocEquals(parsedLocation, this.place.location))
                this.place = new Place.Place({ location: parsedLocation });
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
                    Utils.showDialog(error,
                                     Gtk.MessageType.ERROR, this.get_toplevel());
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
                                            this._mapView.view.latitude,
                                            this._mapView.view.longitude,
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

        places.forEach((place) => {
            let type;

            if (placeStore.exists(place, PlaceStore.PlaceType.RECENT))
                type = PlaceStore.PlaceType.RECENT;
            else if (placeStore.exists(place, PlaceStore.PlaceType.FAVORITE))
                type = PlaceStore.PlaceType.FAVORITE;
            else
                type = PlaceStore.PlaceType.ANY;

            completedPlaces.push({ place: place, type: type });
        });

        this._popover.updateResult(completedPlaces, searchText);
        this._popover.showResult();
    }
});
