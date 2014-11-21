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
 * with GNOME Maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Jonas Danielsson <jonas@threetimestwo.org>
 */

const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Application = imports.application;
const PlaceListRow = imports.placeListRow;
const PlaceStore = imports.placeStore;

const _N_VISIBLE = 6;
const _ROW_HEIGHT = 50;

const FavoritesPopover = new Lang.Class({
    Name: 'FavoritesPopover',
    Extends: Gtk.Popover,
    Template: 'resource:///org/gnome/maps/favorites-popover.ui',
    InternalChildren: [ 'stack',
                        'mainGrid',
                        'revealer',
                        'entry',
                        'scrolledWindow',
                        'list',
                        'noFavoritesLabel'],
    Signals: { 'rows-changed': { } },

    _init: function(params) {
        params = params || { };

        this._mapView = params.mapView;
        delete params.mapView;

        this.parent(params);

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

        this._entry.connect('changed',
                            this._list.invalidate_filter.bind(this._list));

        this._list.connect('row-activated', (function(list, row) {
            this.hide();
            this._mapView.showSearchResult(row.place);
        }).bind(this));

        this._list.set_filter_func((function(row) {
            let text = this._entry.text.toLowerCase();
            let title = row.title.toLowerCase();
            let length = text.length;
            
            return title.substring(0, length) === text.substring(0, length);
        }).bind(this));

        this._updateList();
    },
    
    get rows() {
        return this._rows;
    },
    
    _updateList: function() {
        this._list.forall(function(row) {
            row.destroy();
        });

        this._rows = 0;
        this._model.foreach((function(model, path, iter) {
            let place = model.get_value(iter, PlaceStore.Columns.PLACE);

            let row = new PlaceListRow.PlaceListRow({ place: place,
                                                      maxChars: 15,
                                                      can_focus: true });
            this._list.add(row);
            this._rows++;
        }).bind(this));

        if (this._rows === 0) {
            this._stack.visible_child = this._noFavoritesLabel;
        } else {
            this._stack.visible_child = this._mainGrid;
            let visible = Math.min(this._rows, _N_VISIBLE);

            this._scrolledWindow.min_content_height = visible * PlaceListRow.ROW_HEIGHT + 3;
            if (this._rows > _N_VISIBLE)
                this._revealer.reveal_child = true;
            else
                this._revealer.reveal_child = false;
        }
        this.emit('rows-changed');
    }
});
