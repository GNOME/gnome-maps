/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2026 Jan-Michael Brummer
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
 * Author: Jan-Michael Brummer <jan-michael.brummer@tabos.org>
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import * as Utils from './utils.js';

export class Speech {

    constructor() {
        this._subprocess = null;
        this._language = this._getLanguage();
    }

    get available() {
        return GLib.find_program_in_path('espeak-ng') !== null;
    }

    _getLanguage() {
        const locale = GLib.get_language_names()[0] ?? 'en_US';
        return locale.split('.')[0].split('@')[0].replace('_', '-').toLowerCase();
    }

    speak(text) {
        if (!text)
            return;

        this.cancel();

        try {
            this._subprocess =
                Gio.Subprocess.new(['espeak-ng', '-v', this._language,
                                    '--', text],
                                   Gio.SubprocessFlags.STDOUT_SILENCE |
                                   Gio.SubprocessFlags.STDERR_SILENCE);
        } catch (e) {
            Utils.debug('Speech: espeak-ng failed: ' + e.message);
        }
    }

    cancel() {
        if (this._subprocess) {
            this._subprocess.force_exit();
            this._subprocess = null;
        }
    }
}
