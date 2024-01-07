/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
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
 */

import Gio from 'gi://Gio';

import * as Utils from "./utils.js";

/**
 * Stores a JSON object to disk. Designed to be swapped out for a
 * test/mock implementation.
 */
export class JsonStorage {
    /**
     * @param {string} filename
     */
    constructor(filename) {
        this._filename = filename;
    }

    /**
     * Loads the JSON object from disk.
     * @returns {any} The JSON object, or null if the file doesn't exist.
     */
    load() {
        const buffer = Utils.readFile(this._filename);
        if (!buffer) {
            return null;
        }
        const text = Utils.getBufferText(buffer);
        return JSON.parse(text);
    }

    /**
     * Saves the JSON object to disk.
     * @param {any} json
     */
    save(json) {
        let buffer;
        if (pkg.name.endsWith('.Devel')) {
            buffer = JSON.stringify(json, null, 2);
        } else {
            buffer = JSON.stringify(json);
        }

        try {
            Gio.File.new_for_path(this._filename).get_parent().make_directory_with_parents(null);
        } catch {
            // probably already exists
        }

        if (!Utils.writeFile(this._filename, buffer)) {
            log("Failed to save file: " + this._filename);
        }
    }
}
