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
 */

const Gtk = imports.gi.Gtk;

const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Utils = imports.utils;

const Notification = new Lang.Class({
    Name: 'Notification',
    Extends: Gtk.Bin,
    Abstract: true,

    _init: function() {
        this.parent({ visible: true });

        this._ui = Utils.getUIObject('notification', [ 'frame',
                                                       'body',
                                                       'dismiss-button']);

        this._ui.dismissButton.connect('clicked', (function() {
            this.emit('dismiss');
        }).bind(this));
        this.add(this._ui.frame);
    }
});
Utils.addSignalMethods(Notification.prototype);

const Plain = new Lang.Class({
    Name: 'Plain',
    Extends: Notification,

    _init: function(msg) {
        this.parent();
        let label = new Gtk.Label({ visible : true,
                                    hexpand : true,
                                    halign  : Gtk.Align.START,
                                    label   : msg });
        this._ui.body.add(label);
    }
});

const WithButton = new Lang.Class({
    Name: 'WithButton',
    Extends: Notification,
    Abstract: true,

    _init: function(msg, buttonLabel, callback) {
        this.parent();
        let label = new Gtk.Label({ visible : true,
                                    hexpand : true,
                                    halign  : Gtk.Align.START,
                                    label   : msg });
        let button = new Gtk.Button({ visible : true,
                                      label   : buttonLabel });
        button.connect('clicked', callback);

        this._ui.body.add(label);
        this._ui.body.add(button);
    }
});

const NoNetwork = new Lang.Class({
    Name: 'NoNetwork',
    Extends: WithButton,

    _init: function() {
        this.parent("Maps need a working network connection to function properly",
                    "Turn On",
                    (function() {
                        log("TODO: connect to network here…");
                    }));
    }
});

const NoLocation = new Lang.Class({
    Name: 'NoLocation',
    Extends: WithButton,

    _init: function() {
        this.parent("Turn on location services to find your location",
                    "Turn On",
                    (function() {
                        log("TODO: turn on location services here…");
                    }));
    }
});

const Type = {
    NO_NETWORK  : { name: "NO_NETWORK",  Class: NoNetwork },
    NO_LOCATION : { name: "NO_LOCATION", Class: NoLocation }
};

const Manager = new Lang.Class({
    Name: 'Manager',
    Extends: Gtk.Revealer,

    _init: function(overlay) {
        this._cache = {};

        this.parent({ visible: true,
                      halign: Gtk.Align.CENTER,
                      valign: Gtk.Align.START });

        this._stack = new Gtk.Stack({ visible: true,
                                      transition_type: Gtk.StackTransitionType.SLIDE_DOWN,
                                      transition_duration: this.transition_duration });
        this.add(this._stack);
    },

    showMessage: function (msg) {
        let notification = new Plain(msg);
        this._revealNotification(notification);
    },

    // Shows a static (reusable) notification
    showNotification: function(notificationType) {
        let notification = this._getNotification(notificationType);
        if(!notification.get_parent())
            this._revealNotification(notification);
    },

    _revealNotification: function(notification) {
        // only conceal the notification when it's the last one
        notification.connect('dismiss', (function() {
            if (this._stack.get_children().length > 1) {
                this._stack.remove(notification);
            } else {
                this.set_reveal_child(false);
                Mainloop.timeout_add(this.transition_duration, (function() {
                    this._stack.remove(notification);
                }).bind(this));
            }
        }).bind(this));

        this._stack.add(notification);
        this._stack.child_set_property(notification, 'position', 0);
        this._stack.set_visible_child(notification);
        this.set_reveal_child(true);
    },

    _getNotification: function(notificationType) {
        if(!this._cache.hasOwnProperty(notificationType.name)) {
            this._createNotification(notificationType);
        }
        return this._cache[notificationType.name];
    },

    _createNotification: function(notificationType) {
        let notification = new notificationType.Class();
        this._cache[notificationType.name] = notification;
    }
});
