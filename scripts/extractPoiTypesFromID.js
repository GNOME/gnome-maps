#!/usr/bin/env -S gjs -m

/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2016 Marcus Lundblad.
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
 * Author: Marcus Lundblad <ml@update.uu.se>
 */

/*
 * Script to generate a simplified JSON mapping file for POI types from the
 * presets definitions from the iD Web-based OpenStreetMap editor
 * 
 * Usage: ./extractPoiTypesFromID.js <path to iD checkout> > osm-types.json
 *
 */

import Gio from 'gi://Gio';

const PRESETS_PATH = 'data/presets';
const LOCALES_PATH = 'dist/translations';
const PRESET_TYPES = [ 'aerialway',
                       'aeroway',
                       'amenity',
                       'barrier',
                       'education',
                       'highway',
                       'historic',
                       'landuse',
                       'leisure',
                       'office',
                       'place',
                       'railway',
                       'shop',
                       'tourism' ];

const OUTPUT = {};

const REPLACEMENTS = {};

let decoder = new TextDecoder('utf-8');

function parseJson(basePath, path, keyValueOverride) {
    let file = Gio.File.new_for_path(`${basePath}/${path}`);
    let [status, buffer] = file.load_contents(null);
    let {tags, name} = JSON.parse(decoder.decode(buffer));

    if (keyValueOverride) {
        OUTPUT[keyValueOverride] = { 'title': { 'C': name } };
        return;
    }

    for (let key in tags) {
        const value = tags[key];
        const keyValue = `${key}/${value}`;

        /* if name is the form {type/subtype/...} parse the referenced
         * replacement defintion and store a mapping from the original
         * key/value pair for referencing when collecting translations
         */
        if (name.startsWith('{') && name.endsWith('}')) {
            const replacement = name.slice(1, -1);

            REPLACEMENTS[keyValue] = replacement;

            // parse replacement defintion with reference to original key/value
            parseJson(basePath, `${PRESETS_PATH}/${replacement}.json`,
                      keyValue);
        } else {
            OUTPUT[keyValue] = { 'title': { 'C': name } };
        }
    }
}

function processType(type, basePath) {
    let dirPath = [PRESETS_PATH, type].join('/');
    let dir = Gio.File.new_for_path(`${basePath}/${dirPath}`);
    let enumerator =
        dir.enumerate_children('*',
                               Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);

    while (true) {
        let file = enumerator.next_file(null);

        if (file === null)
            break;

        if (file.get_name().endsWith('.json'))
            parseJson(basePath, `${dirPath}/${file.get_name()}`);
    }
}

function processTypes(basePath) {
    PRESET_TYPES.forEach(function(type) {
        processType(type, basePath);
    });
}

function processLocale(dirPath, fileName) {
    let file = Gio.File.new_for_path(dirPath + '/' + fileName);
    let [status, buffer] = file.load_contents(null);
    let object = JSON.parse(decoder.decode(buffer));
    let lang = fileName.substring(0, fileName.indexOf('.json'));

    for (let type in OUTPUT) {
        let name;
        const finalType = REPLACEMENTS[type] ?? type;

        try {
            name = object[lang].presets.presets[finalType].name;
        } catch (ex) {
            continue;
        }

        OUTPUT[type].title[lang] = name;
    }
}

function processLocales(basePath) {
    let dirPath = basePath + '/' + LOCALES_PATH;
    let dir = Gio.File.new_for_path(dirPath);
    let enumerator =
        dir.enumerate_children('*.json',
                               Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);

    while (true) {
        let file = enumerator.next_file(null);

        if (file === null)
            break;

        if (file.get_name().endsWith('.json'))
            processLocale(dirPath, file.get_name());
    }
}

function outputJson() {
    print(JSON.stringify(OUTPUT, null, 2));
}

function main(args) {
    let path = args[0];

    processTypes(path);
    processLocales(path);

    outputJson();
}

main(ARGV);
