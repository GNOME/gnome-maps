/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2014 Damián Nohales
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
 * Author: Damián Nohales <damiannohales@gmail.com>
 */

const GObject = imports.gi.GObject;

const MapMarker = imports.mapMarker;
const PlaceBubble = imports.placeBubble;

var PlaceMarker = GObject.registerClass(
class PlaceMarker extends MapMarker.MapMarker {

    _init(params) {
        super._init(params);

        this.add_actor(this._actorFromIconName('mark-location', 32));
    }

    get anchor() {
        return { x: Math.floor(this.width / 2),
                 y: this.height - 3 };
    }

    _createBubble() {
        if (this.place.name) {
            return new PlaceBubble.PlaceBubble({ place: this.place,
                                                 mapView: this._mapView });
        } else
            return null;
    }
});
