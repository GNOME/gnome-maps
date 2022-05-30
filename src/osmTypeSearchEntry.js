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

import {OSMTypePopover} from './osmTypePopover.js';
import * as OSMTypes from './osmTypes.js';
import * as Utils from './utils.js';

const MAX_MATCHES = 10;

export class OSMTypeSearchEntry extends Gtk.SearchEntry {

    constructor(props) {
        super(props);

        this._popover = new OSMTypePopover({relative_to: this});

        this.connect('size-allocate', (widget, allocation) => {
            /* Magic number to make the alignment pixel perfect. */
            let width_request = allocation.width + 20;
            this._popover.width_request = width_request;
        });

        this.connect('search-changed', this._onSearchChanged.bind(this));
        this.connect('activate', this._onSearchChanged.bind(this));
    }

    get popover() {
        return this._popover;
    }

    _onSearchChanged() {
        if (this.text.length === 0) {
            this._popover.hide();
            return;
        }

        /* Note: Not sure if searching already on one character might be a bit
         * too much, but unsure about languages such as Chinese and Japanese
         * using ideographs. */
        if (this.text.length >= 1) {
            let matches = OSMTypes.findMatches(this.text, MAX_MATCHES);

            if (matches.length > 0) {
                /* show search results */
                this._popover.showMatches(matches);
            } else {
                this._popover.hide();
            }
        }
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/osm-type-search-entry.ui'
}, OSMTypeSearchEntry);
