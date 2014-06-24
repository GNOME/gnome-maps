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

const Geocode = imports.gi.GeocodeGlib;
const Gtk = imports.gi.Gtk;

const Lang = imports.lang;

const MapBubble = imports.mapBubble;
const Utils = imports.utils;
const _ = imports.gettext.gettext;

const SearchResultBubble = new Lang.Class({
    Name: "SearchResultBubble",
    Extends: MapBubble.MapBubble,

    _init: function(params) {
        this.parent(params);

        let ui = Utils.getUIObject('search-result-bubble', [ 'grid',
                                                             'box-right',
                                                             'image',
                                                             'label-title' ]);
        let place = this.place;

        Utils.load_icon(this.place.icon, 48, function(pixbuf) {
            ui.image.pixbuf = pixbuf;
        });

        let title = null;
        let content = [];

        if (this._isBrokenPlace(place)) {
            // Fallback for places coming from PlaceStore
            title = place.name;
        } else {
            switch (place.place_type) {
            case Geocode.PlaceType.COUNTRY:
                title = place.country;
                if (place.country_code)
                    content.push(_("Country code: %s").format(place.country_code));
                break;

            case Geocode.PlaceType.TOWN:
                title = place.town;
                if (place.postal_code)
                    content.push(_("Postal code: %s").format(place.postal_code));
                if (place.state)
                    content.push(place.state + ', ' + place.country);
                else
                    content.push(place.country);
                break;

            //TODO: add specific UIs for the rest of the place types
            default:
                title = place.name;
                break;
            }
        }

        ui.labelTitle.label = title;

        content.forEach(function(c) {
            let label = new Gtk.Label({ label: c,
                                        visible: true,
                                        halign: Gtk.Align.START });
            ui.boxRight.pack_start(label, false, true, 0);
        });

        this.add(ui.grid);
    },

    _isBrokenPlace: function(place) {
        // Broken places are GeocodePlace objects coming from PlaceStore,
        // which doesn't save most of the place properties.
        // See: https://bugzilla.gnome.org/show_bug.cgi?id=726625
        return !place.country && !place.state && !place.county && !place.town &&
               !place.street && !place.street_address;
    }
});
