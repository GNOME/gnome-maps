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

import Adw from 'gi://Adw';
import GObject from 'gi://GObject';

import {Application} from './application.js';

let instance = null;

/**
 * The color scheme to use for map content: the map itself, markers, and route
 * layers. This is separate from the color scheme of the application window,
 * which always follows the system preference.
 *
 * Mirrors the "dark" property and "notify::dark" signal of Adw.StyleManager,
 * so that it can be used in its place by anything drawing map content.
 */
export class MapColorScheme extends GObject.Object {

    static getDefault() {
        if (!instance) {
            instance =
                new MapColorScheme({ settings:     Application.settings,
                                     styleManager: Adw.StyleManager.get_default() });
        }

        return instance;
    }

    constructor({ settings, styleManager }) {
        super();

        this._settings = settings;
        this._styleManager = styleManager;
        this._dark = this._computeDark();

        this._styleManager.connect('notify::dark', () => this._update());
        this._settings.connect('changed::color-scheme', () => this._update());
    }

    get dark() {
        return this._dark;
    }

    _computeDark() {
        switch (this._settings.get('color-scheme')) {
        case 'light':
            return false;
        case 'dark':
            return true;
        default:
            return this._styleManager.dark;
        }
    }

    _update() {
        const dark = this._computeDark();

        if (dark !== this._dark) {
            this._dark = dark;
            this.notify('dark');
        }
    }
}

GObject.registerClass({
    Properties: {
        'dark': GObject.ParamSpec.boolean('dark', '', '',
                                          GObject.ParamFlags.READABLE, false)
    }
}, MapColorScheme);
