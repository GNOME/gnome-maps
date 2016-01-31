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
const Lang = imports.lang;

/* Abstract search result popover that progagates keypress events from a
   focus-taking internal widget to the spawning search entry widget */
const SearchPopover = new Lang.Class({
    Name: 'SearchPopover',
    Extends: Gtk.Popover,
    Abstract: true,

    _init: function(props) {
        this.parent(props);

        this._entry = this.relative_to;

        // We need to propagate events to the listbox so that we can
        // keep typing while selecting a place. But we do not want to
        // propagate the 'enter' key press if there is a selection.
        this._entry.connect('key-press-event',
                            this._propagateKeys.bind(this));
        this._entry.connect('button-press-event',
                            this._list.unselect_all.bind(this._list));
    },

    _propagateKeys: function(entry, event) {
        let row;

        if (this.visible) {
            row = this._list.get_selected_row();
            if (!row)
                row = this._list.get_row_at_index(0);
        } else
            row = this._list.get_row_at_index(0);

        if (!row)
            return false;

        let length = this._list.get_children().length;
        let keyval = event.get_keyval()[1];

        if (keyval === Gdk.KEY_Escape) {
            this._list.unselect_all();
            this.hide();
            return false;
        }

        // If we get an 'enter' keypress and we have a selected
        // row, we do not want to propagate the event.
        if ((this.visible && row.is_selected()) &&
            keyval === Gdk.KEY_Return ||
            keyval === Gdk.KEY_KP_ENTER ||
            keyval === Gdk.KEY_ISO_Enter) {
            row.activate();

            return true;
        } else if (keyval === Gdk.KEY_KP_Up || keyval === Gdk.KEY_Up) {
            this.show();

            if (!row.is_selected()) {
                let pRow = this._list.get_row_at_index(length - 1);
                this._list.select_row(pRow);
                return false;
            }

            if (row.get_index() > 0) {
                let pRow = this._list.get_row_at_index(row.get_index() - 1);
                this._list.select_row(pRow);
            } else
                this._list.unselect_all();
        } else if (keyval === Gdk.KEY_KP_Down || keyval === Gdk.KEY_Down) {
            this.show();

            if (!row.is_selected()) {
                this._list.select_row(row);
                return true;
            }

            if (row.get_index() !== (length - 1)) {
                let nRow = this._list.get_row_at_index(row.get_index() + 1);
                this._list.select_row(nRow);
            } else
                this._list.unselect_all();
            return true;
        }
        return false;
    }
});

