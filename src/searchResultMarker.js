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
 * with GNOME Maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Damián Nohales <damiannohales@gmail.com>
 */

const Lang = imports.lang;

const MapMarker = imports.mapMarker;
const Path = imports.path;
const SearchResultBubble = imports.searchResultBubble;
const Utils = imports.utils;

const SearchResultMarker = new Lang.Class({
    Name: 'SearchResultMarker',
    Extends: MapMarker.MapMarker,

    _init: function(params) {
        this.parent(params);

        let iconActor = Utils.CreateActorFromImageFile(Path.ICONS_DIR + "/pin.svg");
        this.add_actor(iconActor);
    },

    get anchor() {
        return { x: Math.floor(this.width / 2),
                 y: this.height - 3 };
    },

    _createBubble: function() {
        return new SearchResultBubble.SearchResultBubble({ place: this.place,
                                                           mapView: this._mapView });
    }
});
