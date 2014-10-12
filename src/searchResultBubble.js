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
const _ = imports.gettext.gettext;

const MapBubble = imports.mapBubble;
const PlaceFormatter = imports.placeFormatter;
const Utils = imports.utils;

const SearchResultBubble = new Lang.Class({
    Name: "SearchResultBubble",
    Extends: MapBubble.MapBubble,

    _init: function(params) {
        let ui = Utils.getUIObject('search-result-bubble', [ 'box-content',
                                                             'label-title']);
        params.buttons = MapBubble.Button.ROUTE;
        this.parent(params);

        let place = this.place;

        Utils.load_icon(this.place.icon, 48, (function(pixbuf) {
            this.image.pixbuf = pixbuf;
        }).bind(this));

        let formatter = new PlaceFormatter.PlaceFormatter(place);
        let infos = [];

        ui.labelTitle.label = formatter.title;
        infos = formatter.rows.map(function(row) {
            row = row.map(function(prop) {
                switch (prop) {
                case 'postal_code':
                    return _("Postal code: %s").format(place[prop]);
                case 'country_code':
                    return _("Country code: %s").format(place[prop]);
                default:
                    return place[prop];
                }
            });
            return row.join(', ');
        });

        infos.forEach(function(info) {
            let label = new Gtk.Label({ label: info,
                                        visible: true,
                                        halign: Gtk.Align.START });
            ui.boxContent.pack_start(label, false, true, 0);
        });

        this.content.add(ui.boxContent);
    }
});
