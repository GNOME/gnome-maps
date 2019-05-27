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

const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const Application = imports.application;
const PlaceListRow = imports.placeListRow;
const PlaceStore = imports.placeStore;
const SearchPopover = imports.searchPopover;

const _PLACE_ICON_SIZE = 20;

const Mode = {
    IDLE: 0, // Nothing going on
    ACTIVATED: 1, // Just activated, ignore changes to text
    COMPLETION: 2, // We are doing completion against placeStore
    RESULT: 3 // We are displaying results
};

var PlacePopover = GObject.registerClass({
    Signals : {
        'selected' : { param_types: [ GObject.TYPE_OBJECT ] }
    },
    Template: 'resource:///org/gnome/Maps/ui/place-popover.ui',
    InternalChildren: [ 'scrolledWindow',
                        'stack',
                        'spinner',
                        'list',
                        'noResultsLabel' ],
}, class PlacePopover extends SearchPopover.SearchPopover {

    _init(props) {
        let numVisible = props.num_visible;
        delete props.num_visible;

        this._maxChars = props.maxChars;
        delete props.maxChars;

        props.transitions_enabled = false;
        super._init(props);

        this._entry = this.relative_to;
        this._entry.connect('notify::place', () => this._mode = Mode.ACTIVATED);

        Application.routingDelegator.graphHopper.route.connect('update', () => {
            this._mode = Mode.ACTIVATED;
        });

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
        this._mode = Mode.RESULT;

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
        this._mode = Mode.IDLE;

        if (this._spinner.active)
            this._spinner.stop();

        this._stack.visible_child = this._noResultsLabel;
    }

    showCompletion() {
        if (this._mode === undefined || this._mode === Mode.ACTIVATED) {
            this._mode = Mode.IDLE;
            return;
        }

        this._mode = Mode.COMPLETION;
        this._stack.visible_child = this._scrolledWindow;

        if (!this.visible)
            this.show();
    }

    updateResult(places, searchString) {
        this._list.forall((row) => row.destroy());

        places.forEach((place) => {
            if (!place.place.location)
                return;

            this._addRow(place.place, place.type, searchString);
        });
    }

    updateCompletion(filter, searchString) {
        this._list.forall((row) => row.destroy());

        filter.foreach((model, path, iter) => {
            let place = model.get_value(iter, PlaceStore.Columns.PLACE);
            let type = model.get_value(iter, PlaceStore.Columns.TYPE);
            this._addRow(place, type, searchString);
        });
    }

    _addRow(place, type, searchString) {
        let row = new PlaceListRow.PlaceListRow({ place: place,
                                                  searchString: searchString,
                                                  type: type,
                                                  maxChars: this._maxChars,
                                                  can_focus: true });
        this._list.add(row);
    }
});
