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
 * with GNOME Maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Jonas Danielsson <jonas@threetimestwo.org>
 */

const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Geocode = imports.gi.GeocodeGlib;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Application = imports.application;
const Place = imports.place;
const Utils = imports.utils;

const _PLACES_STORE_FILE = 'maps-places.json';
const _ICON_SIZE = 20;

const PlaceType = {
    ANY: -1,
    RECENT: 0,
    FAVORITE: 1
};

const Columns = {
    PLACE_ICON: 0,
    PLACE: 1,
    NAME: 2,
    TYPE: 3,
    ADDED: 4
};

const PlaceStore = new Lang.Class({
    Name: 'PlaceStore',
    Extends: Gtk.ListStore,

    _init: function() {
        this.recentLimit = Application.settings.get('recent-places-limit');
        this._numRecent = 0;
        this.filename = GLib.build_filenamev([GLib.get_user_data_dir(),
                                              _PLACES_STORE_FILE]);
        this._typeTable = {};

        this.parent();
        this.set_column_types([GdkPixbuf.Pixbuf,
                               GObject.TYPE_OBJECT,
                               GObject.TYPE_STRING,
                               GObject.TYPE_INT,
                               GObject.TYPE_DOUBLE]);

        this.set_sort_column_id(Columns.ADDED, Gtk.SortType.ASCENDING);
    },

    _addPlace: function(place, type) {
        this._setPlace(this.append(), place, type, new Date().getTime());
        this._store();
    },

    _addFavorite: function(place) {
        if (this.exists(place, PlaceType.FAVORITE)) {
            return;
        }

        if (this.exists(place, PlaceType.RECENT)) {
            this._removeIf((function(model, iter) {
                let p = model.get_value(iter, Columns.PLACE);
                return p.uniqueID === place.uniqueID;
            }).bind(this), true);
        }
        this._addPlace(place, PlaceType.FAVORITE);
    },

    _addRecent: function(place) {
        if (this.exists(place, PlaceType.RECENT)) {
            this._updatePlace(place);
            return;
        }

        if (this._numRecent === this.recentLimit) {
            // Since we sort by added, the oldest recent will be
            // the first one we encounter.
            this._removeIf((function(model, iter) {
                let type = model.get_value(iter, Columns.TYPE);

                if (type === PlaceType.RECENT) {
                    let place = model.get_value(iter, Columns.PLACE);
                    this._typeTable[place.uniqueID] = null;
                    this._numRecent--;
                    return true;
                }
                return false;
            }).bind(this), true);
        }
        this._addPlace(place, PlaceType.RECENT);
        this._numRecent++;
    },

    load: function() {
        if (!GLib.file_test(this.filename, GLib.FileTest.EXISTS))
            return;

        let buffer = Utils.readFile(this.filename);
        if (buffer === null)
            return;

        try {
            let jsonArray = JSON.parse(buffer);
            jsonArray.forEach((function({ place, type, added }) {
                // We expect exception to be thrown in this line when parsing
                // gnome-maps 3.14 or below place stores since the "place"
                // key is not present.
                if (!place.id)
                    return;

                let p = Place.Place.fromJSON(place);
                this._setPlace(this.append(), p, type, added);
                if (type === PlaceType.RECENT)
                    this._numRecent++;
            }).bind(this));
        } catch (e) {
            throw new Error('failed to parse places file');
        }
    },

    addPlace: function(place, type) {
        if (type === PlaceType.FAVORITE)
            this._addFavorite(place, type);
        else if (type === PlaceType.RECENT)
            this._addRecent(place, type);
    },

    removePlace: function(place, placeType) {
        if (!this.exists(place, placeType))
            return;

        this._removeIf((function(model, iter) {
            let p = model.get_value(iter, Columns.PLACE);
            if (p.uniqueID === place.uniqueID) {
                this._typeTable[place.uniqueID] = null;
                return true;
            }
            return false;
        }).bind(this), true);
        this._store();
    },

    getModelForPlaceType: function(placeType) {
        let filter = new Gtk.TreeModelFilter({ child_model: this });

        filter.set_visible_func(function(model, iter) {
            let type = model.get_value(iter, Columns.TYPE);
            return (type === placeType);
        });

        return filter;
    },

    _store: function() {
        let jsonArray = [];
        this.foreach(function(model, path, iter) {
            let place = model.get_value(iter, Columns.PLACE);
            let type = model.get_value(iter, Columns.TYPE);
            let added = model.get_value(iter, Columns.ADDED);

            jsonArray.push({
                place: place.toJSON(),
                type: type,
                added: added
            });
        });

        let buffer = JSON.stringify(jsonArray);
        if (!Utils.writeFile(this.filename, buffer))
            log('Failed to write places file!');
    },

    _setPlace: function(iter, place, type, added) {
        this.set(iter,
                 [Columns.PLACE,
                  Columns.NAME,
                  Columns.TYPE,
                  Columns.ADDED],
                 [place,
                  place.name,
                  type,
                  added]);

        if (place.icon !== null) {
            Utils.load_icon(place.icon, _ICON_SIZE, (function(pixbuf) {
                this.set(iter, [Columns.ICON], [pixbuf]);
            }).bind(this));
        }
        this._typeTable[place.uniqueID] = type;
    },

    get: function(place) {
        let storedPlace = null;

        this.foreach((function(model, path, iter) {
            let p = model.get_value(iter, Columns.PLACE);
            if (p.uniqueID === place.uniqueID) {
                storedPlace = p;
                return true;
            }
            return false;
        }).bind(this));
        return storedPlace;
    },

    exists: function(place, type) {
        if (type !== undefined && type !== null)
            return this._typeTable[place.uniqueID] === type;
        else
            return this._typeTable[place.uniqueID] !== undefined;
    },

    _removeIf: function(evalFunc, stop) {
        this.foreach((function(model, path, iter) {
            if (evalFunc(model, iter)) {
                this.remove(iter);
                if (stop)
                    return true;
            }
            return false;
        }).bind(this));
    },

    _updatePlace: function(place) {
        this.foreach((function(model, path, iter) {
            let p = model.get_value(iter, Columns.PLACE);

            if (p.uniqueID === place.uniqueID) {
                let type = model.get_value(iter, Columns.TYPE);
                this._setPlace(iter, place, type, new Date().getTime());
                this._store();
                return;
            }
        }).bind(this));
    }
});
