/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2014 Mattias Bengtsson
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
 * Author: Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>
 *         Jonas Danielsson <jonas@threetimestwo.org>
 */

const Notification = imports.notification;

const Lang = imports.lang;

const NotificationManager = new Lang.Class({
    Name: 'NotificationManager',

    _init: function(overlay) {
        this._overlay = overlay;
        this._cache = {};
    },

    showMessage: function (msg) {
        let notification = new Notification.Plain(msg);
        notification.connect('dismissed',
                             notification.destroy.bind(notification));
        this._overlay.add_overlay(notification);
        notification.reveal();
    },

    showNotification: function(notification) {
        if(notification.get_parent() !== this._overlay) {
            this._overlay.add_overlay(notification);

            notification.connect('dismissed', (function() {
                this._overlay.remove(notification);
                notification.disconnectAll();
            }).bind(this));
        }
        notification.reveal();
    },
});
