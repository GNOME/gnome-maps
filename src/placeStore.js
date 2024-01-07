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

import GLib from "gi://GLib";
import Gio from "gi://Gio";
import GObject from "gi://GObject";

import * as epaf from "./epaf.js";
import { JsonStorage } from "./jsonStorage.js";
import { Place } from "./place.js";
import { StoredRoute } from "./storedRoute.js";
import * as Utils from "./utils.js";

const _ONE_DAY = 1000 * 60 * 60 * 24; // one day in ms
const _STALE_THRESHOLD = 7; // mark the osm information as stale after a week

export class PlaceStore extends GObject.Object {
    /**
     * @param {{
     *   storage: JsonStorage?,
     *   recentPlacesLimit: number?,
     *   recentRoutesLimit: number?,
     * }} params
     */
    constructor({ storage, recentPlacesLimit, recentRoutesLimit, ...params }) {
        super(params);

        /** @type {JsonStorage?} */
        this._storage = storage;
        /** @type {number?} */
        this._recentPlacesLimit = recentPlacesLimit;
        /** @type {number?} */
        this._recentRoutesLimit = recentRoutesLimit;
        /** @type {string} */
        this._filename = GLib.build_filenamev([
            GLib.get_user_data_dir(),
            "gnome-maps",
            "places.json",
        ]);

        /** @type {PlaceStoreItem[]} */
        this._places = [];

        /** For forward compatibility. @private */
        this._originalJSON = null;
        /** For forward compatibility. @private */
        this._unknownPlaces = [];

        /** For removing old places. @private */
        this._nextViewOrd = 0;
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

    /**
     * @param {PlaceStoreItem} placeItem
     * @private
     */
    _addPlaceItem(placeItem) {
        this._places.push(placeItem);
        this.items_changed(this._places.length - 1, 0, 1);
    }

    get item_type() {
        return PlaceStoreItem.$gtype;
    }

    get n_items() {
        return this._places.length;
    }

    *[Symbol.iterator]() {
        for (const item of this._places) yield item;
    }

    load() {
        let jsonData;

        try {
            if (this._storage) {
                jsonData = this._storage.load();
                if (jsonData === null) return;
            } else {
                this._storage = new JsonStorage(this._filename);

                jsonData = this._storage.load();
                if (jsonData === null) {
                    // Try the pre-46 location
                    const filename = GLib.build_filenamev([
                        GLib.get_user_data_dir(),
                        "maps-places.json",
                    ]);

                    let buffer = Utils.readFile(filename);
                    if (buffer === null) return;

                    jsonData = JSON.parse(Utils.getBufferText(buffer));
                }
            }

            if (jsonData.places === undefined) {
                jsonData = this._migrateFromPre46(jsonData);
            }

            this._originalJSON = jsonData;
            this._unknownPlaces = [];

            jsonData.places.forEach((stored) => {
                const placeItem = PlaceStoreItem.fromJSON(this, stored);
                if (placeItem) {
                    this._addPlaceItem(placeItem);
                } else {
                    this._unknownPlaces.push(stored);
                }
                this._nextViewOrd = Math.max(this._nextViewOrd, stored.viewOrd);
            });
        } catch (e) {
            logError(e);

            /* Make a backup of the unreadable file, so we don't destroy
               user data if it's a bug */
            const date = new Date();
            const backupFilename =
                this._filename +
                "-" +
                date.toISOString().replace(/[T:]/g, "-").substring(0, 19) +
                ".bak";
            const file = Gio.File.new_for_path(this._filename);
            const backupFile = Gio.File.new_for_path(backupFilename);
            file.copy(backupFile, Gio.FileCopyFlags.OVERWRITE, null, null);

            log(
                "The place store file could not be read. A backup has been saved to " +
                    backupFilename +
                    " and a new one will be created."
            );
        }
    }

    /** @private */
    _migrateFromPre46(jsonArray) {
        const placeItems = [];

        const migratePlace = (place) => {
            place.osmId = place.id;
            delete place.id;
            place.osmType = place.osm_type;
            delete place.osm_type;
            place.streetAddress = place.street_address;
            delete place.street_address;
            place.countryCode = place.country_code;
            delete place.country_code;
            place.boundingBox = place.bounding_box;
            delete place.bounding_box;
            place.postalCode = place.postal_code;
            delete place.postal_code;
            place.placeType = place.place_type;
            delete place.place_type;
        };

        let viewOrd = 0;
        for (const placeItem of jsonArray) {
            delete placeItem.language;

            placeItem.updated = placeItem.added;
            delete placeItem.added;

            if (placeItem.place) {
                migratePlace(placeItem.place);
            }

            placeItem.viewOrd = viewOrd++;

            switch (placeItem.type) {
                case 0:
                    /* Recent */
                    placeItem.place.type = PlaceStoreItem.PlaceType.PLACE;
                    delete placeItem.type;
                    placeItems.push(placeItem);
                    break;
                case 1:
                    /* Favorite */
                    placeItem.place.type = PlaceStoreItem.PlaceType.PLACE;
                    placeItem.isFavorite = true;
                    delete placeItem.type;
                    placeItems.push(placeItem);
                    break;
                case 2:
                    /* We don't handle contacts anymore */
                    break;
                case 3:
                    /* Recent route */
                    placeItem.place.type = PlaceStoreItem.PlaceType.ROUTE;
                    delete placeItem.type;

                    placeItem.place.route.path = epaf.encode(
                        placeItem.place.route.path
                    );

                    placeItem.place.places.forEach((p) => {
                        p.type = PlaceStoreItem.PlaceType.PLACE;
                        migratePlace(p);
                    });

                    placeItems.push(placeItem);
                    break;
            }
        }

        return { migration: 1, places: placeItems };
    }

    /**
     * Adds a place to the store, or updates an existing place if
     * there is a match.
     *
     * @param {Place} place
     * @returns {PlaceStoreItem}
     */
    addPlace(place) {
        const existing = this.getPlaceItem(place);
        if (existing) {
            existing.place = place;
            return existing;
        }

        const placeItem = new PlaceStoreItem(this, place);
        this._addPlaceItem(placeItem);
        this.markDirty();
        return placeItem;
    }

    /**
     * Indicates that a place in the place store has been changed
     * and the store should be saved to disk.
     */
    markDirty() {
        /* Remove old places */
        const removeIf = (filter, limit) => {
            if (limit === undefined) return;

            const realFilter = (x) => !x.isFavorite && filter(x);

            const viewOrds = this._places
                .filter(realFilter)
                .map((placeItem) => placeItem.viewOrd)
                .sort((a, b) => a - b);

            if (viewOrds.length <= limit) return;

            const threshold = viewOrds[viewOrds.length - limit];
            this._removeIf(
                (placeItem) =>
                    realFilter(placeItem) && placeItem.viewOrd < threshold
            );
        };

        removeIf(
            (placeItem) => !(placeItem.place instanceof StoredRoute),
            this._recentPlacesLimit
        );
        removeIf(
            (placeItem) => placeItem.place instanceof StoredRoute,
            this._recentRoutesLimit
        );

        this.save();
    }

    /**
     * Writes the place store to disk.
     */
    save() {
        let jsonArray = [];
        this._places.forEach((placeItem) => {
            if (!placeItem.place || !placeItem.place.store) return;
            jsonArray.push(placeItem.toJSON());
        });
        jsonArray = jsonArray.concat(this._unknownPlaces);

        const jsonObject = {
            ...this._originalJSON,
            places: jsonArray,
            version: pkg.version,
        };

        this._storage.save(jsonObject);
    }

    /**
     * Gets the Place in the store that matches the given place,
     * if any.
     *
     * @param {Place} place
     * @returns {Place?}
     */
    get(place) {
        return this.getPlaceItem(place)?.place ?? null;
    }

    /**
     * Searches the place store for a match for the given place
     * and returns its PlaceStoreItem, if any.
     *
     * In the future, this may find matches by name and location,
     * but for now it only matches by OSM ID.
     *
     * @param {Place} place
     * @returns {PlaceStoreItem?}
     */
    getPlaceItem(place) {
        return (
            this._places.find(
                (placeItem) => placeItem.place.uniqueID === place.uniqueID
            ) ?? null
        );
    }

    /**
     * Finds the PlaceStoreItem for the given OSM ID, if any.
     *
     * @param {number} osmType
     * @param {number} osmId
     * @returns {PlaceStoreItem?} the place store item, or null if it isn't in the store
     */
    getByOsmId(osmType, osmId) {
        return (
            this._places.find(
                (placeItem) =>
                    placeItem.place.osmType === osmType &&
                    placeItem.place.osmId === osmId
            )?.place.osmType ?? null
        );
    }

    /**
     * @param {(item: PlaceStoreItem) => boolean} evalFunc
     * @private
     */
    _removeIf(evalFunc) {
        for (let i = 0; i < this._places.length; ) {
            const placeItem = this._places[i];
            if (evalFunc(placeItem)) {
                this._places.splice(i, 1);
                this.items_changed(i, 1, 0);
            } else {
                i++;
            }
        }
    }
}

GObject.registerClass(
    {
        Implements: [Gio.ListModel],
        Properties: {
            "item-type": GObject.param_spec_gtype(
                "item-type",
                "",
                "",
                GObject.Object,
                GObject.ParamFlags.READABLE
            ),
            "n-items": GObject.ParamSpec.uint(
                "n-items",
                "",
                "",
                GObject.ParamFlags.READABLE,
                0,
                GLib.MAXUINT32,
                0
            ),
        },
    },
    PlaceStore
);

export class PlaceStoreItem extends GObject.Object {
    /** @enum {number} */
    static PlaceType = {
        PLACE: 1,
        ROUTE: 2,
    };

    /**
     * @param {PlaceStore} store
     * @param {{
     *   place: Place,
     *   type: number,
     *   updated?: Date,
     *   viewOrd?: number,
     * }} params
     */
    constructor(store, place, { isFavorite, updated, viewOrd } = {}) {
        super();

        /** @type {PlaceStore} @private */
        this._store = store;
        /** @type {Place} @private */
        this._place = place;
        /** @type {boolean} @private */
        this._isFavorite = isFavorite ?? false;
        /** @type {Date} @private */
        this._updated = updated ?? new Date();
        /** @type {number} @private */
        this._viewOrd = viewOrd ?? store._nextViewOrd++;
    }

    isStale() {
        if (!(this.place instanceof StoredRoute) && !this.place.osmTags)
            return true;

        let now = new Date().getTime();
        let days = Math.abs(now - this.updated.getTime()) / _ONE_DAY;

        return days >= _STALE_THRESHOLD;
    }

    /** @type {Place} */
    get place() {
        return this._place;
    }

    set place(place) {
        this._place = place;
        this._updated = new Date();
        this._store.markDirty();
    }

    get isFavorite() {
        return this._isFavorite;
    }

    set isFavorite(isFavorite) {
        this._isFavorite = isFavorite;
        this._store.markDirty();
    }

    /** @type {Date} */
    get updated() {
        return this._updated;
    }

    set updated(updated) {
        this._updated = updated;
        this._store.markDirty();
    }

    /** @type {Date} */
    get viewOrd() {
        return this._viewOrd;
    }

    updateViewed() {
        this._viewOrd = this._store.nextViewOrd();
        this._store.markDirty();
    }

    toJSON() {
        const type =
            this._place instanceof StoredRoute
                ? PlaceStoreItem.PlaceType.ROUTE
                : PlaceStoreItem.PlaceType.PLACE;

        return {
            ...this._originalJSON,
            place: {
                ...this._place.toJSON(),
                type,
            },
            isFavorite: this._isFavorite,
            updated: this._updated.getTime(),
            viewOrd: this._viewOrd,
        };
    }

    static fromJSON(store, json) {
        let place;
        switch (json.place?.type) {
            case PlaceStoreItem.PlaceType.PLACE:
                place = Place.fromJSON(json.place);
                break;
            case PlaceStoreItem.PlaceType.ROUTE:
                place = StoredRoute.fromJSON(json.place);
                break;
            default:
                return null;
        }

        const result = new PlaceStoreItem(store, place, {
            isFavorite: json.isFavorite,
            updated: new Date(json.updated),
        });
        result._viewOrd = json.viewOrd;
        result._originalJSON = json;
        return result;
    }
}

GObject.registerClass(PlaceStoreItem);
