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

const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Geocode = imports.gi.GeocodeGlib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;

const Application = imports.application;
const Location = imports.location;
const Place = imports.place;
const PlaceStore = imports.placeStore;
const PlacePopover = imports.placePopover;
const Utils = imports.utils;

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

        if (this._place && p && this._locEquals(this._place, p))
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

        let parseOnFocusOut = props.parseOnFocusOut;
        delete props.parseOnFocusOut;

        this._matchRoute = props.matchRoute || false;
        delete props.matchRoute;

        super._init(props);

        this._filter = new Gtk.TreeModelFilter({ child_model: Application.placeStore });
        this._filter.set_visible_func(this._completionVisibleFunc.bind(this));

        this._popover = this._createPopover(numVisible, maxChars);

        this.connect('activate', this._onActivate.bind(this));
        this.connect('search-changed', () => {
            if (this._cancellable)
                this._cancellable.cancel();

            this._refreshFilter();

            if (this.text.length === 0) {
                this._popover.hide();
                this.place = null;
                return;
            }

            if (this._filter.iter_n_children(null) > 0)
                this._popover.showCompletion();
            else
                this._popover.hide();
        });

        if (parseOnFocusOut) {
            this.connect('focus-out-event', () => {
                this._parse();
                return false;
            });
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
            popover.width_request = width_request;
        });

        popover.connect('selected', (widget, place) => {
            this.place = place;
            popover.hide();
        });

        return popover;
    }

    _refreshFilter() {
        /* Filter model based on input text */
        this._filter.refilter();
        this._popover.updateCompletion(this._filter, this.text);
    }

    _completionVisibleFunc(model, iter) {
        let place = model.get_value(iter, PlaceStore.Columns.PLACE);
        let type = model.get_value(iter, PlaceStore.Columns.TYPE);

        if (!this._matchRoute && type === PlaceStore.PlaceType.RECENT_ROUTE)
            return false;

        if (place !== null)
            return place.match(this.text);
        else
            return false;
    }

    _parse() {
        if (this.text.length === 0) {
            this.place = null;
            return true;
        }

        if (this.text.startsWith('geo:')) {
            let location = new Geocode.Location();

            try {
                location.set_from_uri(this.text);
                this.place = new Place.Place({ location: location });
            } catch(e) {
                let msg = _("Failed to parse Geo URI");
                Application.notificationManager.showMessage(msg);
            }

            return true;
        }

        let parsedLocation = Place.Place.parseCoordinates(this.text);
        if (parsedLocation) {
            this.place = new Place.Place({ location: parsedLocation });
            return true;
        }

        return false;
    }

    _onActivate() {
        if (this._parse())
            return;

        let bbox = this._mapView.view.get_bounding_box();

        this._popover.showSpinner();
        this._cancellable = new Gio.Cancellable();
        Application.geocodeService.search(this.text, bbox, this._cancellable, (places) => {
            if (!places) {
                this.place = null;
                this._popover.showNoResult();
                return;
            }
            this._popover.updateResult(places, this.text);
            this._popover.showResult();
        });
    }
});
