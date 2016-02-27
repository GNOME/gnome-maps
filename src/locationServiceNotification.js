/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2011, 2012, 2013 Red Hat, Inc.
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
 * Author: Jonas Danielsson <jonas@threetimestwo.org>
 */

const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

const Application = imports.application;
const Geoclue = imports.geoclue;
const Notification = imports.notification;
const Utils = imports.utils;

const _PRIVACY_PANEL = 'gnome-privacy-panel.desktop';

const LocationServiceNotification = new Lang.Class({
    Name: 'LocationServiceNotification',
    Extends: Notification.Notification,

    _init: function() {
        this.parent();

        let ui = Utils.getUIObject('location-service-notification',
                                   [ 'button', 'grid' ]);

        ui.button.connect('clicked', (function() {
            let privacyInfo = Gio.DesktopAppInfo.new(_PRIVACY_PANEL);

            try {
                let display = Gdk.Display.get_default();

                privacyInfo.launch([], display.get_app_launch_context());
            } catch(e) {
                Utils.debug('launching privacy panel failed: ' + e);
            }

            Application.geoclue.connect('notify::state', (function() {
                if (!this.parent)
                    return;

                if (Application.geoclue.state === Geoclue.State.ON)
                    this.dismiss();
            }).bind(this));

        }).bind(this));

        this._ui.body.add(ui.grid);
    }
});
