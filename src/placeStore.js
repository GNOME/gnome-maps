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

const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Geocode = imports.gi.GeocodeGlib;
const Gtk = imports.gi.Gtk;

const ContactPlace = imports.contactPlace;
const Place = imports.place;
const StoredRoute = imports.storedRoute;
const Utils = imports.utils;

const _PLACES_STORE_FILE = 'maps-places.json';
const _ICON_SIZE = 20;
const _ONE_DAY = 1000 * 60 * 60 * 24; // one day in ms
const _STALE_THRESHOLD = 7; // mark the osm information as stale after a week

var PlaceType = {
    ANY: -1,
    RECENT: 0,
    FAVORITE: 1,
    CONTACT: 2,
    RECENT_ROUTE: 3
};

var Columns = {
    PLACE_ICON: 0,
    PLACE: 1,
    NAME: 2,
    TYPE: 3,
    ADDED: 4,
    LANGUAGE: 5
};

var PlaceStore = GObject.registerClass(
class PlaceStore extends Gtk.ListStore {

    _init(params) {
        this._recentPlacesLimit = params.recentPlacesLimit;
        delete params.recentPlacesLimit;

        this._recentRoutesLimit = params.recentRoutesLimit;
        delete params.recentRoutesLimit;

        this._numRecentPlaces = 0;
        this._numRecentRoutes = 0;
        this.filename = GLib.build_filenamev([GLib.get_user_data_dir(),
                                              _PLACES_STORE_FILE]);
        this._typeTable = {};
        this._language = Utils.getLanguage();

        super._init(params);
        this.set_column_types([GdkPixbuf.Pixbuf,
                               GObject.TYPE_OBJECT,
                               GObject.TYPE_STRING,
                               GObject.TYPE_INT,
                               GObject.TYPE_DOUBLE,
                               GObject.TYPE_STRING]);

        this.set_sort_column_id(Columns.ADDED, Gtk.SortType.ASCENDING);
    }

    _addPlace(place, type) {
        this._setPlace(this.append(), place, type, new Date().getTime(),
                       this._language);
        this._store();
    }

    _addContact(place) {
        if (this.exists(place, PlaceType.CONTACT)) {
            return;
        }

        this._addPlace(place, PlaceType.CONTACT);
    }

    _addFavorite(place) {
        if (!place.store)
            return;

        if (this.exists(place, PlaceType.FAVORITE)) {
            return;
        }

        if (this.exists(place, PlaceType.RECENT)) {
            this._removeIf((model, iter) => {
                let p = model.get_value(iter, Columns.PLACE);
                return p.uniqueID === place.uniqueID;
            }, true);
        }
        this._addPlace(place, PlaceType.FAVORITE);
    }

    _addRecent(place) {
        if (!place.store)
            return;

        if (this.exists(place, PlaceType.RECENT)) {
            this.updatePlace(place);
            return;
        }

        if (this._numRecentPlaces === this._recentPlacesLimit) {
            // Since we sort by added, the oldest recent will be
            // the first one we encounter.
            this._removeIf((model, iter) => {
                let type = model.get_value(iter, Columns.TYPE);

                if (type === PlaceType.RECENT) {
                    let place = model.get_value(iter, Columns.PLACE);
                    this._typeTable[place.uniqueID] = null;
                    this._numRecentPlaces--;
                    return true;
                }
                return false;
            }, true);
        }
        this._addPlace(place, PlaceType.RECENT);
        this._numRecentPlaces++;
    }

    _addRecentRoute(stored) {
        if (this.exists(stored, PlaceType.RECENT_ROUTE))
            return;

        if (stored.containsCurrentLocation)
            return;

        if (this._numRecentRoutes >= this._recentRoutesLimit) {
            this._removeIf((model, iter) => {
                let type = model.get_value(iter, Columns.TYPE);

                if (type === PlaceType.RECENT_ROUTE) {
                    let place = model.get_value(iter, Columns.PLACE);
                    this._typeTable[place.uniqueID] = null;
                    this._numRecentRoutes--;
                    return true;
                }
                return false;
            }, true);
        }
        this._addPlace(stored, PlaceType.RECENT_ROUTE);
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
            jsonArray.forEach(({ place, type, added, language }) => {
                // We expect exception to be thrown in this line when parsing
                // gnome-maps 3.14 or below place stores since the "place"
                // key is not present.
                if (!place.id)
                    return;

                // GtkListStore doesn't seem to handle null/undefined for strings
                if (!language)
                    language = '';

                let p;
                if (type === PlaceType.RECENT_ROUTE) {
                    if (this._numRecentRoutes >= this._recentRoutesLimit)
                        return;
                    p = StoredRoute.StoredRoute.fromJSON(place);
                    this._numRecentRoutes++;
                } else {
                    p = Place.Place.fromJSON(place);
                    if (type === PlaceType.RECENT)
                        this._numRecentPlaces++;
                }
                this._setPlace(this.append(), p, type, added, language);
            });
        } catch (e) {
            throw new Error('failed to parse places file');
        }
    }

    addPlace(place, type) {
        if (type === PlaceType.FAVORITE)
            this._addFavorite(place, type);
        else if (type === PlaceType.RECENT)
            this._addRecent(place, type);
        else if (type === PlaceType.CONTACT)
            this._addContact(place, type);
        else if (type === PlaceType.RECENT_ROUTE)
            this._addRecentRoute(place);
    }

    removePlace(place, placeType) {
        if (!this.exists(place, placeType))
            return;

        this._removeIf((model, iter) => {
            let p = model.get_value(iter, Columns.PLACE);
            if (p.uniqueID === place.uniqueID) {
                this._typeTable[place.uniqueID] = null;
                return true;
            }
            return false;
        }, true);
        this._store();
    }

    getModelForPlaceType(placeType) {
        let filter = new Gtk.TreeModelFilter({ child_model: this });

        filter.set_visible_func((model, iter) => {
            let type = model.get_value(iter, Columns.TYPE);
            return (type === placeType);
        });

        return filter;
    }

    _store() {
        let jsonArray = [];
        this.foreach((model, path, iter) => {
            let place = model.get_value(iter, Columns.PLACE);
            let type = model.get_value(iter, Columns.TYPE);
            let added = model.get_value(iter, Columns.ADDED);
            let language = model.get_value(iter, Columns.LANGUAGE);

            if (!place || !place.store)
                return;
            jsonArray.push({
                place: place.toJSON(),
                type: type,
                added: added,
                language: language
            });
        });

        let buffer = JSON.stringify(jsonArray);
        if (!Utils.writeFile(this.filename, buffer))
            log('Failed to write places file!');
    }

    _setPlace(iter, place, type, added, language) {
        this.set(iter,
                 [Columns.PLACE,
                  Columns.NAME,
                  Columns.TYPE,
                  Columns.ADDED,
                  Columns.LANGUAGE],
                 [place,
                  place.name,
                  type,
                  added,
                  language]);

        if (place.icon !== null) {
            Utils.load_icon(place.icon, _ICON_SIZE, (pixbuf) => {
                this.set(iter, [Columns.ICON], [pixbuf]);
            });
        }
        this._typeTable[place.uniqueID] = type;
    }

    get(place) {
        let storedPlace = null;

        this.foreach((model, path, iter) => {
            let p = model.get_value(iter, Columns.PLACE);
            if (p.uniqueID === place.uniqueID) {
                storedPlace = p;
                return true;
            }
            return false;
        });
        return storedPlace;
    }

    isStale(place) {
        if (!this.exists(place, null))
            return false;

        let added = null;
        let language = null;
        this.foreach((model, path, iter) => {
            let p = model.get_value(iter, Columns.PLACE);

            if (p.uniqueID === place.uniqueID) {
                let p_type = model.get_value(iter, Columns.TYPE);
                added = model.get_value(iter, Columns.ADDED);
                language = model.get_value(iter, Columns.LANGUAGE);
            }
        });

        let now = new Date().getTime();
        let days = Math.abs(now - added) / _ONE_DAY;

        return language !== this._language || days >= _STALE_THRESHOLD;
    }

    exists(place, type) {
        if (type !== undefined && type !== null && this._typeTable[place.uniqueID] !== undefined)
            return this._typeTable[place.uniqueID] === type;
        else
            return this._typeTable[place.uniqueID] !== undefined &&
                   this._typeTable[place.uniqueID] !== null;
    }

    existsWithOsmTypeAndId(osmType, osmId) {
        let id = osmType + '-' + osmId;
        if (this._typeTable[id])
            return this._typeTable[id];
        else
            return null;
    }

    _removeIf(evalFunc, stop) {
        this.foreach((model, path, iter) => {
            if (evalFunc(model, iter)) {
                this.remove(iter);
                if (stop)
                    return true;
            }
            return false;
        });
    }

    updatePlace(place) {
        this.foreach((model, path, iter) => {
            let p = model.get_value(iter, Columns.PLACE);

            if (p.uniqueID === place.uniqueID) {
                let type = model.get_value(iter, Columns.TYPE);
                this._setPlace(iter, place, type, new Date().getTime(),
                               this._language);
                this._store();
                return;
            }
        });
    }
});
