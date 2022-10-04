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
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>.
 *
 * Author: Jonas Danielsson <jonas@threetimestwo.org>
 */

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {Application} from './application.js';
import {PlaceListRow} from './placeListRow.js';
import {PlaceStore} from './placeStore.js';

const _N_VISIBLE = 6;

export class FavoritesPopover extends Gtk.Popover {

    constructor({mapView, ...params}) {
        super(params);

        this._mapView = mapView;
        this._rows = 0;

        let placeType = PlaceStore.PlaceType.FAVORITE;
        this._model = Application.placeStore.getModelForPlaceType(placeType);

        this._model.connect('row-deleted',
                            this._updateList.bind(this));
        this._model.connect('row-inserted',
                            this._updateList.bind(this));

        this.connect('notify::rows', () => {
            this._entryBox.visible = this.rows > _N_VISIBLE;
        });

        this._entry.connect('changed',
                            () => this._list.invalidate_filter(this._list));

        this._list.connect('row-activated', (list, row) => {
            this.hide();
            mapView.showPlace(row.place, true);
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
        let listRows = [];

        for (let row of this._list) {
            if (row instanceof Gtk.ListBoxRow)
                listRows.push(row);
        }

        for (let row of listRows) {
            this._list.remove(row);
        }

        let rows = 0;
        this._model.foreach((model, path, iter) => {
            let place = model.get_value(iter, PlaceStore.Columns.PLACE);
            let row = new PlaceListRow({ place: place, can_focus: true });

            this._list.insert(row, -1);
            rows++;
        });

        this.rows = rows;
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/favorites-popover.ui',
    InternalChildren: [ 'entryBox',
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
}, FavoritesPopover);
