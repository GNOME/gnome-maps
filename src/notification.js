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

const SECOND = 1000;

const Notification = new Lang.Class({
    Name: 'Notification',
    Extends: Gtk.Revealer,

    _init: function(msg, buttonLabel) {
        this.parent({ visible: true,
                      halign: Gtk.Align.CENTER,
                      valign: Gtk.Align.START });
        let ui = Utils.getUIObject('notification', [ 'frame',
                                                     'button',
                                                     'notification',
                                                     'dismiss-button']);
        ui.notification.label = msg;
        if(buttonLabel) {
            ui.button.show();
            ui.button.label = buttonLabel;
            ui.button.connect('clicked', (function() {
                this.emit('button-clicked');
            }).bind(this));
        }
        ui.dismissButton.connect('clicked', this.dismiss.bind(this));
        this.add(ui.frame);
    },

    reveal: function() {
        this.set_reveal_child(true);
    },

    dismiss: function() {
        this.set_reveal_child(false);
        Mainloop.timeout_add(this.transition_duration, (function() {
            this.destroy();
            return false;
        }).bind(this));
    }
});
Utils.addSignalMethods(Notification.prototype);
