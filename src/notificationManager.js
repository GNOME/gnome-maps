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
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>.
 *
 * Author: Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>
 *         Jonas Danielsson <jonas@threetimestwo.org>
 */

const Mainloop = imports.mainloop;

const Notification = imports.notification;

const _TIMEOUT = 5000; /* ms */

var NotificationManager = class NotificationManager {

    constructor(overlay) {
        this._overlay = overlay;
    }

    _add(notification) {
        this._current = notification;
        if (!(notification instanceof Notification.Plain)) {
            let dismissId = notification.connect('dismissed', () => {
                this._overlay.remove(notification);
                notification.disconnect(dismissId);
                this._current = null;
            });
        }
        this._overlay.add_overlay(notification);
        let timeoutId = Mainloop.timeout_add(_TIMEOUT, () => {
            timeoutId = 0;
            notification.dismiss();
        });
        notification.connect('destroy', () => {
            if (timeoutId !== 0)
                Mainloop.source_remove(timeoutId);
        });
        notification.reveal();
    }

    showMessage(msg) {
        let notification = new Notification.Plain(msg);
        notification.connect('dismissed', () => {
            this._current = null;
            notification.destroy();
        });
        this.showNotification(notification);
    }

    showNotification(notification) {
        if(notification.get_parent() === this._overlay)
            return;
        if (!this._current) {
            this._add(notification);
        } else {
            this._current.dismiss();
            Mainloop.timeout_add(this._current.transition_duration,
                                 this._add.bind(this, notification));
        }
    }
};
