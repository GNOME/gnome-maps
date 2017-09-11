/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2017 Marcus Lundblad
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
 * Author: Marcus Lundblad <ml@update.uu.se>
 */

const Lang = imports.lang;

const Gdk = imports.gi.Gdk;

const Location = imports.location;
const MapMarker = imports.mapMarker;
const Place = imports.place;

var TransitArrivalMarker = new Lang.Class({
    Name: 'TransitArrivalMarker',
    Extends: MapMarker.MapMarker,

    _init: function(params) {
        let lastPoint = params.leg.polyline[params.leg.polyline.length - 1];
        let location =
            new Location.Location({ latitude: lastPoint.latitude,
                                    longitude: lastPoint.longitude
                                  });

        delete params.leg;
        params.place = new Place.Place({ location: location });

        this.parent(params);

        let color = new Gdk.RGBA({ red: 0,
                                   green: 0,
                                   blue: 0,
                                   alpha: 1.0
                                 });
        let actor =
            this._actorFromIconName('maps-point-end-symbolic', 0, color);

        this.add_actor(actor);
    },

    get anchor() {
        return { x: Math.floor(this.width / 2) - 1,
                 y: Math.floor(this.height / 2) - 1 };
    }
});
