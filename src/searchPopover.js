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

import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

/* Abstract search result popover that progagates keypress events from a
   focus-taking internal widget to the spawning search entry widget */
export class SearchPopover extends Gtk.Popover {

    constructor(props) {
        let entry = props.entry;
        delete props.entry;

        super(props);

        this._entry = entry;

        // We need to propagate events to the listbox so that we can
        // keep typing while selecting a place. But we do not want to
        // propagate the 'enter' key press if there is a selection.
        this._keyController = new Gtk.EventControllerKey();
        this.add_controller(this._keyController);
        this._keyController.connect('key-pressed',
                                    this._propagateKeys.bind(this));

        this._buttonPressGesture = new Gtk.GestureSingle();
        this._entry.add_controller(this._buttonPressGesture);
        this._buttonPressGesture.connect('begin',
                                         () => this._list.unselect_all());

        this._numResults = 0;
    }

    _propagateKeys(controller, keyval, keycode, state) {
        if (keyval === Gdk.KEY_Escape) {
            this.hide();
            this._list.unselect_all();
        } else if (keyval === Gdk.KEY_Return ||
                   keyval === Gdk.KEY_KP_ENTER ||
                   keyval === Gdk.KEY_ISO_Enter) {

            // If we get an 'enter' keypress and we have a selected
            // row, we do not want to propagate the event.
            let row = this._list.get_selected_row();

            if (this.visible && row) {
                row.activate();
            } else {
                controller.forward(this._entry);
            }
        } else if (keyval === Gdk.KEY_KP_Up ||
                   keyval === Gdk.KEY_Up ||
                   keyval === Gdk.KEY_KP_Down ||
                   keyval === Gdk.KEY_Down) {

            let length = this._numResults;
            if (length === 0) {
                controller.forward(this._entry);
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
        } else {
            if (keyval === Gdk.KEY_space) {
                /* forwarding space seems to not work for some reason,
                 * work around by manually injecting a space into the entry string
                 */
                this._entry.set_text(this._entry.text + ' ');
                this._entry.set_position(this._entry.text.length);
            } else {
                controller.forward(this._entry);
            }
        }
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
}

GObject.registerClass({
    Abstract: true
}, SearchPopover);

