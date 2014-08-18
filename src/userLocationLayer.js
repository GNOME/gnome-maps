/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2011, 2012, 2013 Red Hat, Inc.
 * Copyright (c) 2014 Mattias Bengtsson
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
 * Author: Zeeshan Ali (Khattak) <zeeshanak@gnome.org>
 *         Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>
 */

const Champlain = imports.gi.Champlain;
const Geocode = imports.gi.GeocodeGlib;
const Lang = imports.lang;

const UserLocation = imports.userLocation;

const UserLocationLayer = new Lang.Class({
    Name: 'UserLocationLayer',
    Extends: Champlain.MarkerLayer,

    _init: function(props) {
        props = props || {};

        let model = props.model;
        delete props.model;

        this._mapView = props.mapView;
        delete props.mapView;

        if (props.selection_mode === undefined)
            props.selection_mode = Champlain.SelectionMode.SINGLE;

        this.parent(props);

        if (model)
            this.setModel(model);
    },

    setModel: function(model) {
        this._model = model;

        this._model.connect("location-changed",
                            this._refresh.bind(this));
        this._refresh();
    },

    userLocationVisible: function() {
        let box = this._mapView.view.get_bounding_box();

        return box.covers(this._userLocation.latitude,
                          this._userLocation.longitude);
    },

    gotoUserLocation: function(animate) {
        this._userLocation.goTo(animate);
    },

    _refresh: function() {
        if (!this._model || !this._model.location)
            return;

        let location = this._model.location;
        let place = Geocode.Place.new_with_location(location.description,
                                                    Geocode.PlaceType.UNKNOWN,
                                                    location);

        let selected = this._userLocation && this._userLocation.getSelected();
        this._userLocation = new UserLocation.UserLocation(place,
                                                           this._mapView);
        this._userLocation.show(this);
        this._userLocation.setSelected(selected);
    }
});
