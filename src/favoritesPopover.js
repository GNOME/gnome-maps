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
import {FavoriteListRow} from './favoriteListRow.js';
import {PlaceStore} from './placeStore.js';

const _N_VISIBLE = 6;

export class FavoritesPopover extends Gtk.Popover {

    constructor({mapView, ...params}) {
        super(params);

        this._mapView = mapView;
        this._rows = 0;

        this._filter = Gtk.CustomFilter.new((placeItem) => placeItem.isFavorite);
        this._model = new Gtk.FilterListModel({ model: Application.placeStore,
                                                filter: this._filter });
        this.connect('show', () => this._filter.changed(Gtk.FilterChange.DIFFERENT));

        this._model.connect('items-changed',
                            this._updateList.bind(this));

        this._entry.connect('changed',
                            () => this._list.invalidate_filter());

        this._list.connect('row-activated', (list, row) => {
            this.hide();
            mapView.showPlace(row.place, true);
        });

        this._list.set_filter_func((row) => {
            return row.place.match(this._entry.text);
        });

        this._updateList();
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
        for (let i = 0; i < this._model.n_items; i++) {
            const placeItem = this._model.get_item(i);
            let row = new FavoriteListRow({ placeItem: placeItem,
                                            filter:    this._filter,
                                            can_focus: true });
            this._list.insert(row, -1);
            rows++;
        }

        this._stack.set_visible_child(rows === 0 ? this._empty : this._mainBox);
        this._entryBox.visible = rows > _N_VISIBLE;
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/favorites-popover.ui',
    InternalChildren: [ 'stack',
                        'empty',
                        'mainBox',
                        'entryBox',
                        'entry',
                        'scrolledWindow',
                        'list' ]
}, FavoritesPopover);
