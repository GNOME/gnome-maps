/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
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
 * with GNOME Maps; if not, see <https://www.gnu.org/licenses/>.
 *
 * Author: Jonas Danielsson <jonas@threetimestwo.org>
 */

const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const Application = imports.application;
const PlaceListRow = imports.placeListRow;
const PlaceStore = imports.placeStore;

const _N_VISIBLE = 6;

var FavoritesPopover = GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/favorites-popover.ui',
    InternalChildren: [ 'mainGrid',
                        'revealer',
                        'entry',
                        'scrolledWindow',
                        'list' ],
    Properties: {
        'rows': GObject.ParamSpec.int('rows',
                                        '',
                                        '',
                                        GObject.ParamFlags.READABLE |
                                        GObject.ParamFlags.WRITABLE,
                                        0, GLib.MAXINT32, 0)
    }
}, class FavoritesPopover extends Gtk.Popover {

    _init(params) {
        params = params || { };

        this._mapView = params.mapView;
        delete params.mapView;

        params.transitions_enabled = false;
        super._init(params);

        this._rows = 0;

        let placeType = PlaceStore.PlaceType.FAVORITE;
        this._model = Application.placeStore.getModelForPlaceType(placeType);

        this._model.connect('row-deleted',
                            this._updateList.bind(this));
        this._model.connect('row-inserted',
                            this._updateList.bind(this));

        this._list.set_header_func(function(row, before) {
            let header = before ? new Gtk.Separator() : null;
            row.set_header(header);
        });

        this.connect('notify::rows', () => {
            let visible = Math.min(this._rows, _N_VISIBLE);
            let separators = visible - 1; // separators are 1px
            let height = (PlaceListRow.ROW_HEIGHT + 6) * visible + separators;

            this._scrolledWindow.min_content_height = height;
            this._revealer.reveal_child = this._rows > _N_VISIBLE;
        });

        this._entry.connect('changed',
                            () => this._list.invalidate_filter(this._list));

        this._list.connect('row-activated', (list, row) => {
            this.hide();
            this._mapView.showPlace(row.place, true);
        });

        this._list.set_filter_func((row) => {
            return row.place.match(this._entry.text);
        });

        this._updateList();
    }

    set rows(rows) {
        if (rows !== this._rows) {
            this._rows = rows;
            this.notify('rows');
        }
    }

    get rows() {
        return this._rows;
    }

    _updateList() {
        this._list.forall((row) => row.destroy());

        let rows = 0;
        this._model.foreach((model, path, iter) => {
            let place = model.get_value(iter, PlaceStore.Columns.PLACE);

            let row = new PlaceListRow.PlaceListRow({ place: place,
                                                      maxChars: 15,
                                                      can_focus: true });
            this._list.add(row);
            rows++;
        });

        this.rows = rows;
    }
});
