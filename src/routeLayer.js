/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
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
 * Author: Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>
 */

const Champlain = imports.gi.Champlain;
const Geocode = imports.gi.GeocodeGlib;
const Lang = imports.lang;

const MapLocation = imports.mapLocation;

const RouteLayer = new Lang.Class({
    Name: 'RouteLayer',
    Extends: Champlain.PathLayer,

    _init: function(props) {
        props = props || {};
        
        let model = props.model;
        delete props.model;

        this._mapView = props.mapView;
        delete props.mapView;

        props.stroke_width = 2.0;
        this.parent(props);

        if(model)
            this.setModel(model);
    },

    setModel: function(model) {
        this._model = model;
        this._model.connect('update', this._refresh.bind(this));
        this._model.connect('reset',  this.remove_all.bind(this));

        this._refresh();
    },

    _refresh: function() {
        this.remove_all();

        this._model.path.forEach(this.add_node.bind(this));
        this.focusRoute();
    },

    // Animate to the center of the route bounding box
    // goto() is currently implemented on mapLocation, so we need to go
    // through some hoops here.
    focusRoute: function() {
        if(!this._model.bbox)
            return;

        let bbox = this._model.bbox;
        let [lat, lon] = bbox.get_center();
        let place = new Geocode.Place({
            location: new Geocode.Location({ latitude:  lat,
                                             longitude: lon }),
            bounding_box: new Geocode.BoundingBox({ top:    bbox.top,
                                                    bottom: bbox.bottom,
                                                    left:   bbox.left,
                                                    right:  bbox.right })
        });
        let mapLocation = new MapLocation.MapLocation(place, this._mapView);

        mapLocation.goTo(true);
    }
});
