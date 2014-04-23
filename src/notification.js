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
    Extends: Gtk.Revealer,
    Abstract: true,

    _init: function() {
        this.parent({ visible: true,
                      halign: Gtk.Align.CENTER,
                      valign: Gtk.Align.START });

        this._ui = Utils.getUIObject('notification', [ 'frame',
                                                       'body',
                                                       'dismiss-button']);

        this._ui.dismissButton.connect('clicked', this.dismiss.bind(this));
        this.add(this._ui.frame);
    },

    reveal: function() {
        this._setRevealAndEmit(true, 'revealed');
    },

    dismiss: function() {
        this._setRevealAndEmit(false, 'dismissed');
    },

    _setRevealAndEmit: function(state, signal) {
        // We only want to send a dismissed / shown -signal
        // if there is an actual change in revealed state.
        if (state !== this.child_revealed) {
            this.set_reveal_child(state);
            Mainloop.timeout_add(this.transition_duration, (function() {
                this.emit(signal);
                return false;
            }).bind(this));
        }
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
