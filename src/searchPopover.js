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

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

/* Abstract search result popover that progagates keypress events from a
   focus-taking internal widget to the spawning search entry widget */
export class SearchPopover extends Gtk.Popover {

    constructor({entry, ...params}) {
        super(params);

        this._entry = entry;

        this._buttonPressGesture = new Gtk.GestureSingle();
        this._entry.add_controller(this._buttonPressGesture);
        this._buttonPressGesture.connect('begin',
                                         () => this.list.unselect_all());

        this._numResults = 0;

        this.add_css_class('suggestions');
    }

    get numResults() {
        return this._numResults;
    }
}

GObject.registerClass({
    Abstract: true
}, SearchPopover);

