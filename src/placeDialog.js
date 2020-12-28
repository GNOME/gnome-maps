/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2020 James Westman
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
 * Author: James Westman <james@flyingpimonster.net>
 */

const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const PlaceFormatter = imports.placeFormatter;
const PlaceView = imports.placeView;

var PlaceDialog = GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/place-dialog.ui',
    InternalChildren: [ 'scroll' ]
}, class PlaceDialog extends Gtk.Dialog {
    _init(params) {
        let place = params.place;
        delete params.place;

        let mapView = params.mapView;
        delete params.mapView;

        params.use_header_bar = true;
        super._init(params);

        if (this.transient_for.is_maximized) {
            this.maximize();
        } else {
            let [width, height] = this.transient_for.get_size();

            // Don't let the dialog get too wide
            if (width > 400) {
                width = 400 - 36;
                height -= 36;
            }

            this.set_default_size(width, height);
        }

        this._placeView = new PlaceView.PlaceView({ place,
                                                    mapView,
                                                    valign: Gtk.Align.START,
                                                    visible: true });
        this._scroll.add(this._placeView);

        let formatter = new PlaceFormatter.PlaceFormatter(place);
        this.title = formatter.title;
    }
});
