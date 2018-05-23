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

const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const Utils = imports.utils;

const _PRIVACY_PANEL = 'gnome-privacy-panel.desktop';

var LocationServiceDialog = GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/location-service-dialog.ui',
    InternalChildren: [ 'cancelButton',
                        'settingsButton'],
}, class LocationServiceDialog extends Gtk.Dialog {

    _init(params) {
        /* This is a construct-only property and cannot be set by GtkBuilder */
        params.use_header_bar = true;

        super._init(params);

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
});