/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2024, Marcus Lundblad
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
 * Author: Marcus Lundblad <ml@dfupdate.se>
 */

import gettext from 'gettext';

import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {PlaceListRow} from './placeListRow.js';

const _ = gettext.gettext;

export class FavoriteListRow extends PlaceListRow {
    constructor({ placeItem, filter, ...params} ) {
        super({ place: placeItem.place, showSecondaryIcon: false, ...params} );

        this._placeItem = placeItem;
        this._filter = filter;
    }

    _onRemoveClicked() {
        const undoToast =
            new Adw.Toast({ title:        _("Favorite removed"),
                            button_label: _("_Undo") });

        undoToast.connect('button-clicked', () => {
            this._placeItem.isFavorite = true;
            this._filter.changed(Gtk.FilterChange.DIFFERENT);
        });

        this.get_root().addToast(undoToast);

        this._placeItem.isFavorite = false;
        this._filter.changed(Gtk.FilterChange.DIFFERENT);
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/favorite-list-row.ui',
}, FavoriteListRow);
