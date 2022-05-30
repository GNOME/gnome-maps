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

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {Application} from './application.js';
import {PlaceListRow} from './placeListRow.js';
import {PlaceStore} from './placeStore.js';
import {SearchPopover} from './searchPopover.js';

const _PLACE_ICON_SIZE = 20;

export class PlacePopover extends SearchPopover {

    constructor(props) {
        let numVisible = props.num_visible;
        delete props.num_visible;

        let maxChars = props.maxChars;
        delete props.maxChars;

        props.transitions_enabled = false;
        super(props);

        this._maxChars = maxChars;
        this._entry = this.relative_to;

        this._list.connect('row-activated', (list, row) => {
            if (row)
                this.emit('selected', row.place);
        });

        this._list.set_header_func((row, before) => {
            let header = new Gtk.Separator();
            if (before)
                row.set_header(header);
            else
                row.set_header(null);
        });

        let rowHeight = PlaceListRow.ROW_HEIGHT;
        this._scrolledWindow.min_content_height = numVisible * rowHeight + 6;

        // This silents warning at Maps exit about this widget being
        // visible but not mapped.
        this.connect('unmap', (popover) => popover.hide());
    }

    showSpinner() {
        this._spinner.start();
        this._stack.visible_child = this._spinner;

        if (!this.visible)
            this.show();
    }

    showResult() {
        if (this._spinner.active)
            this._spinner.stop();

        this._stack.visible_child = this._scrolledWindow;

        let row = this._list.get_row_at_index(0);
        if (row)
            this._list.select_row(row);

        if (!this.visible)
            this.show();
    }

    showNoResult() {
        if (this._spinner.active)
            this._spinner.stop();

        this._stack.visible_child = this._noResultsLabel;
    }

    showError() {
        if (this._spinner.active)
            this._spinner.stop();

        this._stack.visible_child = this._errorLabel;
    }

    updateResult(places, searchString) {
        let i = 0;

        places.forEach((p) => {
            let row = this._list.get_row_at_index(i);

            // update existing row, if there is one, otherwise create new
            if (row)
                row.update(p.place, p.type, searchString);
            else
                this._addRow(p.place, p.type, searchString);

            i++;
        });

        // remove remaining rows
        let row = this._list.get_row_at_index(i);

        while (row) {
            this._list.remove(row);
            row = this._list.get_row_at_index(i);
        }
    }

    _addRow(place, type, searchString) {
        let row = new PlaceListRow({ place:        place,
                                     searchString: searchString,
                                     type:         type,
                                     can_focus:    true });
        this._list.insert(row, -1);
    }
}

GObject.registerClass({
    Signals : {
        'selected' : { param_types: [ GObject.TYPE_OBJECT ] }
    },
    Template: 'resource:///org/gnome/Maps/ui/place-popover.ui',
    InternalChildren: [ 'scrolledWindow',
                        'stack',
                        'spinner',
                        'list',
                        'noResultsLabel',
                        'errorLabel' ],
}, PlacePopover);
