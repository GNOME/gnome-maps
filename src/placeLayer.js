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

const MapLocation = imports.mapLocation;

const PlaceLayer = new Lang.Class({
    Name: 'PlaceLayer',
    Extends: Champlain.MarkerLayer,

    _init: function(props) {
        props = props || {};

        this._mapView = props.mapView;
        delete props.mapView;

        if(props.selection_mode === undefined)
            props.selection_mode = Champlain.SelectionMode.SINGLE;

        this.parent(props);
    },

    showPlace: function(place) {
        this.remove_all();

        let mapLocation = new MapLocation.MapLocation(place, this._mapView);
        mapLocation.show(this);

        return mapLocation;
    },

    showAndGotoPlace: function(place) {
        let location = this.showPlace(place);
        location.goTo(true);
    }
});
