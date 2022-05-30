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
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>.
 *
 * Author: Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import * as system from 'system';

export class Settings extends Gio.Settings {

    static getSettings(schemaId, path) {
        const GioSSS = Gio.SettingsSchemaSource;
        let schemaSource;

        if (!pkg.moduledir.startsWith('resource://')) {
            // Running from the source tree
            schemaSource = GioSSS.new_from_directory(pkg.pkgdatadir,
                                                     GioSSS.get_default(),
                                                     false);
        } else {
            schemaSource = GioSSS.get_default();
        }

        let schemaObj = schemaSource.lookup(schemaId, true);
        if (!schemaObj) {
            log('Missing GSettings schema ' + schemaId);
            system.exit(1);
        }

        if (path === undefined)
            return new Settings({ settings_schema: schemaObj });
        else
            return new Settings({ settings_schema: schemaObj,
                                  path: path });
    }

    constructor(params) {
        super(params);
        // The GVariant types of the settings
        this._keyTypes = {};
        this.list_keys().forEach((key) => {
            this._keyTypes[key] = this.get_value(key)
                                      .get_type()
                                      .dup_string();
        });
    }

    get(name) {
        return this.get_value(name).deep_unpack();
    }

    set(name, value) {
        this.set_value(name, GLib.Variant.new (this._keyTypes[name], value));
    }
}

GObject.registerClass(Settings);
