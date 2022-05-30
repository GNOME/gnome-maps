/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2015 Marcus Lundblad.
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
 */

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {OSMTypeListRow} from './osmTypeListRow.js';
import {SearchPopover} from './searchPopover.js';

export class OSMTypePopover extends SearchPopover {

    constructor(props) {
        super(props);

        this._list.connect('row-activated', (list, row) => {
            if (row)
                this.emit('selected', row.key, row.value, row.title);
        });
    }

    showMatches(matches) {
        this._list.foreach((row) => this._list.remove(row));

        matches.forEach((type) => this._addRow(type));
        this.show();
    }

    _addRow(type) {
        let row = new OSMTypeListRow({ type: type, can_focus: true });

        this._list.insert(row, -1);
    }
}

GObject.registerClass({
    InternalChildren: ['list'],
    Template: 'resource:///org/gnome/Maps/ui/osm-type-popover.ui',
    Signals : {
        /* signal emitted when selecting a type, indicates OSM key and value
         * and display title */
        'selected' : { param_types: [ GObject.TYPE_STRING,
                                      GObject.TYPE_STRING,
                                      GObject.TYPE_STRING ] }
    }
}, OSMTypePopover);
