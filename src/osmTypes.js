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

import gettext from 'gettext';

const _ = gettext.gettext;

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Utils from './utils.js';

const _RECENT_TYPES_STORE_FILE = 'maps-recent-types.json';
const _NUM_RECENT_TYPES = 10;

const _file = Gio.file_new_for_uri('resource://org/gnome/Maps/osm-types.json');
const [_status, _buffer] = _file.load_contents(null);
const OSM_TYPE_MAP = JSON.parse(Utils.getBufferText(_buffer));

// dynamically type mapping, language-specifically generated
let TYPE_MAP = null;

export const TYPE_TAG_TITLES = {
  /* Translators: This represents the title for places tagged with the
   * "aerialway" OSM tag: https://wiki.openstreetmap.org/wiki/Map_features#Aerialway
   */
  aerialway: _("Aerialway"),
  /* Translators: This represents the title for places tagged with the
   * "aeroway" OSM tag: https://wiki.openstreetmap.org/wiki/Map_features#Aeroway
   */
  aeroway:   _("Aeroway"),
  /* Translators: This represents the title for places tagged with the
   * "amenity" OSM tag: https://wiki.openstreetmap.org/wiki/Map_features#Amenity
   */
  amenity:   _("Amenity"),
  /* Translators: This represents the title for places tagged with the
   * "barrier" OSM tag: https://wiki.openstreetmap.org/wiki/Map_features#Barrier
   */
  barrier:   _("Barrier"),
  /* Translators: This represents the title for places tagged with the
   * "highway" OSM tag: https://wiki.openstreetmap.org/wiki/Map_features#Highway
   */
  highway:   _("Road"),
  /* Translators: This represents the title for places tagged with the
   * "historic" OSM tag: https://wiki.openstreetmap.org/wiki/Map_features#Historic
   */
  historic:  _("Historic"),
  /* Translators: This represents the title for places tagged with the
   * "leisure" OSM tag: https://wiki.openstreetmap.org/wiki/Map_features#Leisure
   */
  leisure:   _("Leisure"),
  /* Translators: This represents the title for places tagged with the
   * "office" OSM tag: https://wiki.openstreetmap.org/wiki/Map_features#Office
   */
  office:    _("Office"),
  /* Translators: This represents the title for places tagged with the
   * "place" OSM tag: https://wiki.openstreetmap.org/wiki/Map_features#Place
   */
  place:     _("Place"),
  /* Translators: This represents the title for places tagged with the
   * "railway" OSM tag: https://wiki.openstreetmap.org/wiki/Map_features#Railway
   */
  railway:   _("Railway"),
  /* Translators: This represents the title for places tagged with the
   * "shop" OSM tag: https://wiki.openstreetmap.org/wiki/Map_features#Shop
   */
  shop:      _("Shop"),
  /* Translators: This represents the title for places tagged with the
   * "tourism" OSM tag: https://wiki.openstreetmap.org/wiki/Map_features#Tourism
   */
  tourism:   _("Tourism")
}

/* Lists the OSM tags we base our notion of location types on */
export const OSM_TYPE_TAGS = Object.getOwnPropertyNames(TYPE_TAG_TITLES);

export function getTitleForTag(tag) {
    const title = TYPE_TAG_TITLES[tag];

    /* Translators: "Other" refers to points-of-interest where we don't have
     * a known title corresponding to the raw OpenStreetMap tag
     */
    return title ? gettext.gettext(title) : _("Other");
}

/* Sort function comparing two type values according to the locale-specific
 * comparison of the type title */
function _sortType(t1, t2) {
    return t1.normalizedTitle.localeCompare(t2.normalizedTitle);
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
    if (!TYPE_MAP) {
        TYPE_MAP = {};

        for (const tag of OSM_TYPE_TAGS) {
            TYPE_MAP[tag] = [];
        }

        for (let type in OSM_TYPE_MAP) {
            let item = OSM_TYPE_MAP[type];
            let [title, normalizedTitle] = _lookupTitle(item);
            let parts = type.split('/');
            let tag = parts[0];

            if (!OSM_TYPE_TAGS.includes(tag))
                continue;

            TYPE_MAP[tag].push({ title:           title,
                                 normalizedTitle: normalizedTitle,
                                 value:           parts[1] });

        }
    }

    return TYPE_MAP;
}


export function findMatches(prefix, maxMatches, selectedTags) {
    let numMatches = 0;
    let prefixLength = prefix.length;
    let normalized = prefix.toLocaleLowerCase();
    let matches = [];

    // create dynamic type mapping if it doesn't already exist
    getAllTypes();

    for (const tag of (selectedTags ?? Object.getOwnPropertyNames(TYPE_MAP))) {
        for (const item of TYPE_MAP[tag]) {
            /* if the (locale-case-normalized) title matches parts of the search
             * string, or as a convenience for expert mappers, if the search string
             * is prefix of the raw OSM tag value */
            if (item.normalizedTitle.indexOf(normalized) != -1
                || (prefixLength >= 3 && item.value.startsWith(prefix))) {
                numMatches++;
                matches.push({key: tag, value: item.value, title: item.title,
                              normalizedTitle: item.normalizedTitle });
            }

            if (numMatches === maxMatches)
                break;
        }
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

export function getTypeNameForPlace(place) {
    // special case for railway station types
    if (place.osmKey === 'railway') {
        switch (place.station) {
            case 'funicular':
                return _("Funicular station");
            case 'light_rail':
                return _("Light rail stop");
            case 'monorail':
                return _("Monorail station");
            case 'station':
                return _("Railway station");
            case 'subway':
                return _("Subway station");
            default:
                switch (place.osmValue) {
                    case 'halt':
                        return _("Railway halt");
                    case 'tram_stop':
                        return _("Tram stop");
                    case 'station':
                        return _("Railway station");
                    default:
                        return lookupType(place.osmKey, place.osmValue);
                }
        }
    }

    return lookupType(place.osmKey, place.osmValue);
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
