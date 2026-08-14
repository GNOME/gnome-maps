/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2026 Peter Bittner
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
 * Author: Peter Bittner <peter@painless.software>
 */

const JsUnit = imports.jsUnit;

import Gio from "gi://Gio";

import { MapColorScheme } from "../src/mapColorScheme.js";
import { COLOR_SCHEMES } from "../src/preferences.js";

pkg.initGettext();

/* stand-ins for Application.settings and Adw.StyleManager, so that the
 * preference logic can be exercised without a GSettings schema or a display
 */
class FakeSettings {
    constructor(colorScheme) {
        this._colorScheme = colorScheme;
        this._handlers = [];
    }

    get(name) {
        JsUnit.assertEquals('color-scheme', name);

        return this._colorScheme;
    }

    connect(signal, handler) {
        JsUnit.assertEquals('changed::color-scheme', signal);
        this._handlers.push(handler);
    }

    /* simulate the user picking another option in the preferences dialog */
    setColorScheme(colorScheme) {
        this._colorScheme = colorScheme;
        this._handlers.forEach((handler) => handler());
    }
}

class FakeStyleManager {
    constructor(dark) {
        this.dark = dark;
        this._handlers = [];
    }

    connect(signal, handler) {
        JsUnit.assertEquals('notify::dark', signal);
        this._handlers.push(handler);
    }

    /* simulate the system-wide color scheme changing */
    setDark(dark) {
        this.dark = dark;
        this._handlers.forEach((handler) => handler());
    }
}

function setup(colorScheme, systemDark) {
    const settings = new FakeSettings(colorScheme);
    const styleManager = new FakeStyleManager(systemDark);
    const mapColorScheme = new MapColorScheme({ settings, styleManager });
    const notifications = { count: 0 };

    mapColorScheme.connect('notify::dark', () => notifications.count++);

    return { settings, styleManager, mapColorScheme, notifications };
}

/* "system" follows the system-wide preference */
JsUnit.assertEquals(false, setup('system', false).mapColorScheme.dark);
JsUnit.assertEquals(true, setup('system', true).mapColorScheme.dark);

/* "light" and "dark" override the system-wide preference in both directions */
JsUnit.assertEquals(false, setup('light', true).mapColorScheme.dark);
JsUnit.assertEquals(false, setup('light', false).mapColorScheme.dark);
JsUnit.assertEquals(true, setup('dark', false).mapColorScheme.dark);
JsUnit.assertEquals(true, setup('dark', true).mapColorScheme.dark);

/* changing the setting away from the system preference notifies once */
let { settings, mapColorScheme, notifications } = setup('system', true);

settings.setColorScheme('light');
JsUnit.assertEquals(false, mapColorScheme.dark);
JsUnit.assertEquals(1, notifications.count);

/* setting an option that doesn't change the effective scheme is not notified,
 * so that the map style is not regenerated needlessly
 */
({ settings, mapColorScheme, notifications } = setup('system', true));

settings.setColorScheme('dark');
JsUnit.assertEquals(true, mapColorScheme.dark);
JsUnit.assertEquals(0, notifications.count);

/* while following the system, a system change is picked up */
let styleManager;

({ styleManager, mapColorScheme, notifications } = setup('system', false));

styleManager.setDark(true);
JsUnit.assertEquals(true, mapColorScheme.dark);
JsUnit.assertEquals(1, notifications.count);

/* while overridden, a system change is ignored */
({ styleManager, mapColorScheme, notifications } = setup('light', false));

styleManager.setDark(true);
JsUnit.assertEquals(false, mapColorScheme.dark);
JsUnit.assertEquals(0, notifications.count);

const schema =
    Gio.SettingsSchemaSource.get_default().lookup('org.gnome.Maps', true);
const schemaSettings =
    new Gio.Settings({ settings_schema: schema,
                       backend: Gio.memory_settings_backend_new() });

/* the schema offers exactly the values the preferences dialog lists, in the
 * same order, as the dialog selects a row by its position in that list
 */
JsUnit.assertEquals(COLOR_SCHEMES.join(),
                    schema.get_key('color-scheme')
                          .get_range().deepUnpack()[1].deepUnpack().join());

/* every value is numbered the way the application expects it to be */
COLOR_SCHEMES.forEach((colorScheme, value) => {
    schemaSettings.set_enum('color-scheme', value);
    JsUnit.assertEquals(colorScheme,
                        schemaSettings.get_string('color-scheme'));
});
