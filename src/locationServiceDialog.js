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

import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as Utils from './utils.js';

const _PRIVACY_PANEL = 'gnome-location-panel.desktop';

export class LocationServiceDialog extends Gtk.Dialog {

    constructor(params) {
        /* use_header_bar is a construct-only property and cannot be set by GtkBuilder */
        super({...params, use_header_bar: true});

        this._settingsButton.connect('clicked', () => this._onSettings());
        this._cancelButton.connect('clicked', () => this._onCancel());
    }

    _onSettings() {
        let privacyInfo = Gio.DesktopAppInfo.new(_PRIVACY_PANEL);

        try {
            let display = Gdk.Display.get_default();

            privacyInfo.launch([], display.get_app_launch_context());
        } catch(e) {
            Utils.debug('launching privacy panel failed: ' + e);
        }

        this.response(Gtk.ResponseType.OK);
    }

    _onCancel() {
        this.response(Gtk.ResponseType.CANCEL);
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/location-service-dialog.ui',
    InternalChildren: [ 'cancelButton',
                        'settingsButton'],
}, LocationServiceDialog);
