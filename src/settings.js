/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2013 Mattias Bengtsson
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

const Lang = imports.lang;

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const Settings = new Lang.Class({
    Name: "Settings",
    Extends: Gio.Settings,

    // The GVariant types of the settings
    _keyTypes: {},

    _init: function(schema) {
        this.parent({ schema: schema });
        for (let key of this.list_keys()) {
            this._keyTypes[key] = this.get_value(key)
                                      .get_type()
                                      .dup_string();
        }
    },

    get: function(name) {
        return this.get_value(name).deep_unpack();
    },

    set: function(name, value) {
        this.set_value(name, GLib.Variant.new (this._keyTypes[name], value));
    }
});
