/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2016 Marcus Lundblad.
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
 * Author: Marcus Lundblad <ml@update.uu.se>
 *         Jonas Danielsson <jonas@threetimestwo.org>
 */

const Gdk = imports.gi.Gdk;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const Utils = imports.utils;

/* Abstract search result popover that progagates keypress events from a
   focus-taking internal widget to the spawning search entry widget */
var SearchPopover = GObject.registerClass({
    Abstract: true
}, class SearchPopover extends Gtk.Popover {

    _init(props) {
        Utils.debug('SearchPopover::_init');
        let parent = props.parent;
        delete props.parent;

        super._init(props);

        Utils.debug('SearchPopover::_init 2');

        this.set_parent(parent);
        this._entry = parent;

        Utils.debug('SearchPopover::_init 3');

        // We need to propagate events to the listbox so that we can
        // keep typing while selecting a place. But we do not want to
        // propagate the 'enter' key press if there is a selection.
        // TODO: replace with GtkGesture for GTK 4
        //this._entry.connect('key-press-event',
        //                    this._propagateKeys.bind(this));
        //this._entry.connect('button-press-event', () => this._list.unselect_all());
    }

    _propagateKeys(entry, event) {
        let keyval = event.get_keyval()[1];

        if (keyval === Gdk.KEY_Escape) {
            this.hide();
            this._list.unselect_all();
            return Gdk.EVENT_STOP;
        }

        if (keyval === Gdk.KEY_Return ||
            keyval === Gdk.KEY_KP_ENTER ||
            keyval === Gdk.KEY_ISO_Enter) {

            // If we get an 'enter' keypress and we have a selected
            // row, we do not want to propagate the event.
            let row = this._list.get_selected_row();
            if (this.visible && row) {
                row.activate();
                return Gdk.EVENT_STOP;
            } else {
                return Gdk.EVENT_PROPAGATE;
            }
        }

        if (keyval === Gdk.KEY_KP_Up ||
            keyval === Gdk.KEY_Up ||
            keyval === Gdk.KEY_KP_Down ||
            keyval === Gdk.KEY_Down) {

            let length = this._list.get_children().length;
            if (length === 0) {
                return Gdk.EVENT_PROPAGATE;
            }

            let direction = (keyval === Gdk.KEY_KP_Up || keyval === Gdk.KEY_Up) ? -1 : 1;
            let row = this._list.get_selected_row();
            let idx;
            if (!row) {
                idx = (direction === 1) ? 0 :  length - 1;
            } else {
                idx = row.get_index() + direction;
            }
            let inBounds = 0 <= idx && idx < length;
            if (inBounds) {
                this.show();
                this._selectRow(this._list.get_row_at_index(idx));
            } else {
                this._list.unselect_all();
            }
            return Gdk.EVENT_STOP;
        }

        return Gdk.EVENT_PROPAGATE;
    }

    /* Selects given row and ensures that it is visible. */
    _selectRow(row) {
        this._list.select_row(row);
        let adjustment = this._list.get_adjustment();
        if (adjustment) {
            let allocation = row.get_allocation();
            adjustment.clamp_page(allocation.y, allocation.y + allocation.height);
        }
    }
});

