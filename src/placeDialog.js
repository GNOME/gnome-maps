/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2020 James Westman
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
 * Author: James Westman <james@flyingpimonster.net>
 */

import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import { lookupType } from './osmTypes.js';
import {PlaceFormatter} from './placeFormatter.js';
import {PlaceView} from './placeView.js';

export class PlaceDialog extends Adw.Dialog {
    constructor({place, mapView, ...params}) {
        super(params);

        this._placeView = new PlaceView({ place,
                                          mapView,
                                          valign: Gtk.Align.START,
                                          visible: true });
        this._scroll.child = this._placeView;

        const title = new PlaceFormatter(place).title ??
                      lookupType(place.osmKey, place.osmValue);

        this.title = title;
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/place-dialog.ui',
    InternalChildren: [ 'scroll' ]
}, PlaceDialog);
