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
 */

const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;

const Utils = imports.utils;

var Notification = GObject.registerClass({
    Signals: {
        'revealed': { },
        'dismissed': { }
    },
    Abstract: true
}, class Notification extends Gtk.Revealer {

    _init() {
        super._init({ visible: true,
                      halign: Gtk.Align.CENTER,
                      valign: Gtk.Align.START });

        this._ui = Utils.getUIObject('notification', [ 'frame',
                                                       'body',
                                                       'dismiss-button']);

        this._ui.dismissButton.connect('clicked', this.dismiss.bind(this));
        this.add(this._ui.frame);
    }

    reveal() {
        this._setRevealAndEmit(true, 'revealed');
    }

    dismiss() {
        this._setRevealAndEmit(false, 'dismissed');
    }

    _setRevealAndEmit(state, signal) {
        // We only want to send a dismissed / shown -signal
        // if there is an actual change in revealed state.
        if (state !== this.child_revealed) {
            this.set_reveal_child(state);
            Mainloop.timeout_add(this.transition_duration, () => {
                this.emit(signal);
                return false;
            });
        }
    }
});

var Plain = GObject.registerClass(
class Plain extends Notification {

    _init(msg) {
        super._init();
        let label = new Gtk.Label({ visible : true,
                                    hexpand : true,
                                    halign  : Gtk.Align.START,
                                    label   : msg });
        this._ui.body.add(label);
    }
});
