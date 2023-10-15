/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2015 Marcus Lundblad.
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

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Utils from './utils.js';

const _RECENT_TYPES_STORE_FILE = 'maps-recent-types.json';
const _NUM_RECENT_TYPES = 10;

const _file = Gio.file_new_for_uri('resource://org/gnome/Maps/osm-types.json');
const [_status, _buffer] = _file.load_contents(null);
const OSM_TYPE_MAP = JSON.parse(Utils.getBufferText(_buffer));

/* Lists the OSM tags we base our notion of location types on */
export const OSM_TYPE_TAGS = ['aerialway', 'aeroway', 'amenity', 'barrier',
                              'highway', 'historic', 'leisure', 'office', 'place',
                              'railway', 'shop', 'tourism'];

/* Sort function comparing two type values according to the locale-specific
 * comparison of the type title */
function _sortType(t1, t2) {
    return t1.title.toLocaleLowerCase().localeCompare(t2.title.toLocaleLowerCase());
}

/* find the localized display title and a normalized locale-specific lower case
 * value for search purposes, given a type mapping value,
 * also cache the title to avoid re-iterating the language map every time,
 * and store the lower-case normalized title in the current locale */
function _lookupTitle(item) {
    let langs = GLib.get_language_names();
    let title = item.cachedTitle;

    if (title)
        return [title, item.normalizedTitle];

    for (let i = 0; i < langs.length; i++) {
        title = item.title[langs[i].replace('_', '-')];

        if (title) {
            let normalizedTitle = title.toLocaleLowerCase();

            item.cachedTitle = title;
            item.normalizedTitle = normalizedTitle;
            return [title, normalizedTitle];
        }
    }

    return null;
}

export function getAllTypes() {
    let map = {};
    map['aeroway'] = [];
    map['amenity'] = [];
    map['leisure'] = [];
    map['office'] = [];
    map['place'] = [];
    map['shop'] = [];
    map['tourism'] = [];

    for (let type in OSM_TYPE_MAP) {
        let item = OSM_TYPE_MAP[type];
        let [title, normalizedTitle] = _lookupTitle(item);
        let parts = type.split('/');

        let tag = parts[0];

        if (tag === 'aeroway') {
            map['aeroway'].push(title);
        }

        if (tag === 'amenity') {
            map['amenity'].push(title);
        }

        if (tag === 'leisure') {
            map['leisure'].push(title);
        }

        if (tag === 'office') {
            map['office'].push(title);
        }

        if (tag === 'place') {
            map['place'].push(title);
        }

        if (tag === 'shop') {
            map['shop'].push(title);
        }

        if (tag === 'tourism') {
            map['tourism'].push(title);
        }
    }

    return map;
}

export function findMatches(prefix, maxMatches) {
    let numMatches = 0;
    let prefixLength = prefix.length;
    let normalized = prefix.toLocaleLowerCase();
    let matches = [];

    for (let type in OSM_TYPE_MAP) {
        let item = OSM_TYPE_MAP[type];
        let [title, normalizedTitle] = _lookupTitle(item);
        let parts = type.split('/');

        /* if the (locale-case-normalized) title matches parts of the search
         * string, or as a convenience for expert mappers, if the search string
         * is prefix of the raw OSM tag value */
        if (normalizedTitle.indexOf(normalized) != -1
            || (prefixLength >= 3 && parts[1].startsWith(prefix))) {
            numMatches++;
            matches.push({key: parts[0], value: parts[1], title: title});
        }

        if (numMatches === maxMatches)
            break;
    }

    return matches.sort(_sortType);
}

/* return the title of a type with a given key/value if it is known by us */
export function lookupType(key, value) {
    let item = OSM_TYPE_MAP[key + '/' + value];

    if (item) {
        let [title, _] = _lookupTitle(item);
        return title;
    } else
        return null;
}

export class RecentTypesStore {

    constructor() {
        this._filename = GLib.build_filenamev([GLib.get_user_data_dir(),
                                              _RECENT_TYPES_STORE_FILE]);
        this._load();
    }

    get recentTypes() {
        return this._recentTypes;
    }

    _load() {
        if (!GLib.file_test(this._filename, GLib.FileTest.EXISTS)) {
            this._recentTypes = [];
            return;
        }

        let buffer = Utils.readFile(this._filename);
        if (buffer === null) {
            this._recentTypes = [];
            return;
        }

        this._recentTypes = JSON.parse(Utils.getBufferText(buffer));
    }

    _save() {
        let buffer = JSON.stringify(this._recentTypes);
        if (!Utils.writeFile(this._filename, buffer))
            log('Failed to write recent types file!');
    }

    /* push a type key/value as the most recently used type */
    pushType(key, value) {
        /* find out if the type is already stored */
        let pos = -1;
        for (let i = 0; i < this._recentTypes.length; i++) {
            if (this._recentTypes[i].key === key &&
                this._recentTypes[i].value === value) {
                pos = i;
                break;
            }
        }

        /* remove the type if it was already found in the list */
        if (pos != -1)
            this._recentTypes.splice(pos, 1);

        this._recentTypes.unshift({key: key, value: value});

        /* prune the list */
        this._recentTypes.splice(_NUM_RECENT_TYPES);

        this._save();
    }
};

export const recentTypesStore = new RecentTypesStore();
