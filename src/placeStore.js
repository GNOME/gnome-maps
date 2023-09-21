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
 *
 * Author: Jonas Danielsson <jonas@threetimestwo.org>
 */

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {Place} from './place.js';
import {StoredRoute} from './storedRoute.js';
import * as Utils from './utils.js';

const _PLACES_STORE_FILE = 'maps-places.json';
const _ONE_DAY = 1000 * 60 * 60 * 24; // one day in ms
const _STALE_THRESHOLD = 7; // mark the osm information as stale after a week

export class PlaceStore extends GObject.Object {

    static PlaceType = {
        ANY: -1,
        RECENT: 0,
        FAVORITE: 1,
        CONTACT: 2, // Legacy, this is not handled anymore
        RECENT_ROUTE: 3
    }

    static Columns = {
        PLACE: 0,
        TYPE: 1,
        ADDED: 2,
        LANGUAGE: 3
    }

    constructor({recentPlacesLimit, recentRoutesLimit, ...params}) {
        super(params);

        this._recentPlacesLimit = recentPlacesLimit;
        this._recentRoutesLimit = recentRoutesLimit;
        this._numRecentPlaces = 0;
        this._numRecentRoutes = 0;
        this.filename = GLib.build_filenamev([GLib.get_user_data_dir(),
                                              _PLACES_STORE_FILE]);
        /** @type {{ [id: string]: number? }} */
        this._typeTable = {};
        this._language = Utils.getLanguage();

        /** @type {PlaceStoreItem[]} */
        this._places = [];
    }

    vfunc_get_item(position) {
        return this._places[position] ?? null;
    }

    vfunc_get_item_type() {
        return this.item_type;
    }

    vfunc_get_n_items() {
        return this.n_items;
    }

    /** @param {PlaceStoreItem} placeItem  */
    _addPlace(placeItem) {
        this._places.push(placeItem);
        this._typeTable[placeItem.place.uniqueID] = placeItem.type;
        this.items_changed(this._places.length - 1, 0, 1);
    }

    get item_type() {
        return PlaceStoreItem.$gtype;
    }

    get n_items() {
        return this._places.length;
    }

    *[Symbol.iterator]() {
        for (const item of this._places)
            yield item;
    }

    _addFavorite(place) {
        if (!place.store)
            return;

        if (this.exists(place, PlaceStore.PlaceType.FAVORITE)) {
            return;
        }

        if (this.exists(place, PlaceStore.PlaceType.RECENT)) {
            this._removeIf((placeItem) => {
                return placeItem.place.uniqueID === placeItem.place.uniqueID;
            });
        }

        this._addPlace(new PlaceStoreItem({
            place,
            type: PlaceStore.PlaceType.FAVORITE,
            added: new Date(),
        }));
    }

    /** @param {Place} place  */
    _addRecent(place) {
        if (!place.store)
            return;

        if (this.exists(place, PlaceStore.PlaceType.RECENT)) {
            this.updatePlace(place);
            return;
        }

        if (this._numRecentPlaces === this._recentPlacesLimit) {
            // Since we sort by added, the oldest recent will be
            // the first one we encounter.
            this._removeIf((placeItem) => {
                if (placeItem.type === PlaceStore.PlaceType.RECENT) {
                    this._typeTable[placeItem.place.uniqueID] = null;
                    this._numRecentPlaces--;
                    return true;
                }
                return false;
            });
        }
        this._addPlace(new PlaceStoreItem({
            place,
            type: PlaceStore.PlaceType.RECENT,
        }));
        this._numRecentPlaces++;
    }

    /** @param {StoredRoute} stored */
    _addRecentRoute(stored) {
        if (this.exists(stored, PlaceStore.PlaceType.RECENT_ROUTE))
            return;

        if (stored.containsCurrentLocation)
            return;

        if (this._numRecentRoutes >= this._recentRoutesLimit) {
            this._removeIf((placeItem) => {
                if (placeItem.type === PlaceStore.PlaceType.RECENT_ROUTE) {
                    this._typeTable[placeItem.place.uniqueID] = null;
                    this._numRecentRoutes--;
                    return true;
                }
                return false;
            });
        }
        this._addPlace(new PlaceStoreItem({
            place: stored,
            type: PlaceStore.PlaceType.RECENT_ROUTE,
        }));
        this._numRecentRoutes++;
    }

    load() {
        if (!GLib.file_test(this.filename, GLib.FileTest.EXISTS))
            return;

        let buffer = Utils.readFile(this.filename);
        if (buffer === null)
            return;
        try {
            let jsonArray = JSON.parse(Utils.getBufferText(buffer));
            jsonArray.forEach((stored) => {
                // We expect exception to be thrown in this line when parsing
                // gnome-maps 3.14 or below place stores since the "place"
                // key is not present.
                if (!stored.place.id)
                    return;

                // GtkListStore doesn't seem to handle null/undefined for strings
                if (!stored.language)
                    stored.language = '';

                let place;
                if (stored.type === PlaceStore.PlaceType.RECENT_ROUTE) {
                    if (this._numRecentRoutes >= this._recentRoutesLimit)
                        return;
                    place = StoredRoute.fromJSON(stored.place);
                    this._numRecentRoutes++;
                } else {
                    place = Place.fromJSON(stored.place);
                    if (stored.type === PlaceStore.PlaceType.RECENT)
                        this._numRecentPlaces++;
                }
                this._addPlace(new PlaceStoreItem({
                    place,
                    type: stored.type,
                    added: new Date(stored.added),
                    originalJSON: stored,
                }));
            });
        } catch (e) {
            throw new Error('failed to parse places file');
        }
    }

    /**
     * @param {Place} place
     * @param {number} type
     */
    addPlace(place, type) {
        if (type === PlaceStore.PlaceType.FAVORITE)
            this._addFavorite(place);
        else if (type === PlaceStore.PlaceType.RECENT)
            this._addRecent(place);
        else if (type === PlaceStore.PlaceType.RECENT_ROUTE)
            this._addRecentRoute(place);
    }

    removePlace(place, placeType) {
        if (!this.exists(place, placeType))
            return;

        this._removeIf((placeItem) => {
            if (placeItem.place.uniqueID === place.uniqueID) {
                this._typeTable[place.uniqueID] = null;
                return true;
            }
            return false;
        });
        this._store();
    }

    _store() {
        let jsonArray = [];
        this._places.forEach((placeItem) => {
            if (!placeItem.place || !placeItem.place.store)
                return;
            jsonArray.push(placeItem.toJSON());
        });

        let buffer = JSON.stringify(jsonArray);
        if (!Utils.writeFile(this.filename, buffer))
            log('Failed to write places file!');
    }

    /**
     * @param {Place} place
     * @returns {Place?}
     */
    get(place) {
        let storedPlace = null;

        this._places.forEach((placeItem) => {
            if (placeItem.place.uniqueID === place.uniqueID) {
                storedPlace = placeItem.place;
                return true;
            }
            return false;
        });
        return storedPlace;
    }

    /** @param {Place} place */
    isStale(place) {
        if (!this.exists(place, null))
            return false;

        let storedPlaceItem = null;
        this._places.forEach((placeItem) => {
            if (placeItem.place.uniqueID === place.uniqueID) {
                storedPlaceItem = placeItem;
            }
        });

        let now = new Date().getTime();
        let days = Math.abs(now - storedPlaceItem.added.getTime()) / _ONE_DAY;

        return storedPlaceItem.language !== this._language || days >= _STALE_THRESHOLD;
    }

    /**
     * @param {Place} place
     * @param {number?} type
     */
    exists(place, type) {
        if (type !== undefined && type !== null && this._typeTable[place.uniqueID] !== undefined)
            return this._typeTable[place.uniqueID] === type;
        else
            return this._typeTable[place.uniqueID] !== undefined &&
                   this._typeTable[place.uniqueID] !== null;
    }

    /**
     * @param {*} osmType
     * @param {*} osmId
     * @returns {number?}
     */
    existsWithOsmTypeAndId(osmType, osmId) {
        let id = osmType + '-' + osmId;
        if (this._typeTable[id])
            return this._typeTable[id];
        else
            return null;
    }

    /**
     * @param {(item: PlaceStoreItem) => boolean} evalFunc
     */
    _removeIf(evalFunc) {
        for (let i = 0; i < this._places.length;) {
            const placeItem = this._places[i];
            if (evalFunc(placeItem)) {
                this._places.splice(i, 1);
                this.items_changed(i, 1, 0);
            } else {
                i++;
            }
        }
    }

    /** @param {Place} place */
    updatePlace(place) {
        this._places.forEach((placeItem) => {
            if (placeItem.place.uniqueID === place.uniqueID) {
                placeItem.added = new Date();
                this._store();
                return;
            }
        });
    }

    /**
     * @param {Place[]} places
     */
    getCompletedPlaces(places) {
        let completedPlaces = [];

        places.forEach((place) => {
            let type;

            if (this.exists(place, PlaceStore.PlaceType.RECENT))
                type = PlaceStore.PlaceType.RECENT;
            else if (this.exists(place, PlaceStore.PlaceType.FAVORITE))
                type = PlaceStore.PlaceType.FAVORITE;
            else
                type = PlaceStore.PlaceType.ANY;

            completedPlaces.push({ place: place, type: type });
        });

        return completedPlaces;
    }
}

GObject.registerClass({
    Implements: [Gio.ListModel],
    Properties: {
        'item-type': GObject.param_spec_gtype('item-type', '', '', GObject.Object, GObject.ParamFlags.READABLE),
        'n-items': GObject.ParamSpec.uint('n-items', '', '', GObject.ParamFlags.READABLE, 0, GLib.MAXUINT32, 0),
    }
}, PlaceStore);

export class PlaceStoreItem extends GObject.Object {
    /**
     * @param {{
        * place: Place,
        * type: number,
        * added?: Date,
        * language?: string,
        * originalJSON?: Object,
     * }} params
     */
    constructor({place, type, added, language, originalJSON}) {
        super();
        this._place = place;
        this._type = type;
        this._added = added ?? new Date();
        this._language = language;
        this._originalJSON = originalJSON;
    }

    /** @type {Place} */
    get place() {
        return this._place;
    }

    get type() {
        return this._type;
    }

    /** @type {Date} */
    get added() {
        return this._added;
    }

    set added(added) {
        this._added = added;
    }

    /** @type {string?} */
    get language() {
        return this._language;
    }

    set language(language) {
        this._language = language;
    }

    toJSON() {
        return {
            ...this._originalJSON,
            place: this._place.toJSON(),
            type: this._type,
            added: this._added.getTime(),
            language: this._language,
        }
    }
}

GObject.registerClass(PlaceStoreItem);
