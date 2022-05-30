/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2018 Marcus Lundblad
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
 * with GNOME Maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Marcus Lundblad <ml@update.uu.se>
 */

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {OSMEdit} from './osmEdit.js';

export class ZoomInDialog extends Gtk.Dialog {

    constructor(params) {
        let latitude = params.latitude;
        delete params.latitude;
        let longitude = params.longitude;
        delete params.longitude;
        let view = params.view;
        delete params.view;

        /* This is a construct-only property and cannot be set by GtkBuilder */
        params.use_header_bar = true;

        super(params);

        this._latitude = latitude;
        this._longitude = longitude;
        this._view = view;
        this._zoomInButton.connect('clicked', () => this._onZoomIn());
        this._cancelButton.connect('clicked', () => this._onCancel());
    }

    _onZoomIn() {
        this._view.zoom_level = OSMEdit.MIN_ADD_LOCATION_ZOOM_LEVEL;

        /* center on the position first selected */
        this._view.center_on(this._latitude, this._longitude);
        this.response(Gtk.ResponseType.OK);
    }

    _onCancel() {
        this.response(Gtk.ResponseType.CANCEL);
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/zoom-in-dialog.ui',
    InternalChildren: [ 'cancelButton',
                        'zoomInButton'],
}, ZoomInDialog);
