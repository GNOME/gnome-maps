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

const Geocode = imports.gi.GeocodeGlib;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Gtk = imports.gi.Gtk;

const Lang = imports.lang;
const Mainloop = imports.mainloop;

const Utils = imports.utils;
const Application = imports.application;

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
        this._dirty = false;
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
    },

    addFavorite: function(place) {
        if (this._exists(place, PlaceType.FAVORITE))
            return;

        if (this._exists(place, PlaceType.RECENT)) {
            this._removeIf((function(model, iter) {
                let p = model.get_value(iter, Columns.PLACE);
                return p.name === place.name;
            }), true);
        }
        this._addPlace(place, PlaceType.FAVORITE, new Date().getTime());
    },

    addRecent: function(place) {
        if (this._exists(place, PlaceType.RECENT))
            return;

        if (this._numRecent === this.recentLimit) {
            // Since all we do is append, the oldest recent will be
            // the first one we encounter.
            this._removeIf((function(model, iter) {
                let type = model.get_value(iter, Columns.TYPE);
                return type === PlaceType.RECENT;
            }), true);
        }
        this._addPlace(place, PlaceType.RECENT, new Date().getTime());
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
            jsonArray.forEach((function(obj) {
                let location = new Geocode.Location({
                    latitude:    obj.latitude,
                    longitude:   obj.longitude,
                    altitude:    obj.altitude,
                    accuracy:    obj.accuracy,
                    description: obj.name
                });
                let place = Geocode.Place.new_with_location(obj.name,
                                                            obj.place_type,
                                                            location);

                this._addPlace(place, obj.type, obj.added);
                if (obj.type === PlaceType.RECENT)
                    this._numRecent++;
            }).bind(this));
        } catch (e) {
            throw new Error('failed to parse places file');
        }
    },

    store: function() {
        if (!this._dirty)
            return;

        let jsonArray = [];
        this.foreach(function(model, path, iter) {
            let place    = model.get_value(iter, Columns.PLACE),
                location = place.location,
                type     = model.get_value(iter, Columns.TYPE),
                added    = model.get_value(iter, Columns.ADDED);

            jsonArray.push({
                place_type: place.place_type,
                name:       place.name,
                latitude:   location.latitude,
                longitude:  location.longitude,
                altitude:   location.altitude,
                accuracy:   location.accuracy,
                type:       type,
                added:      added
            });
        });

        let buffer = JSON.stringify(jsonArray);
        if (!Utils.writeFile(this.filename, buffer))
            throw new Error('failed to write file');
        else
            this.dirty = false;
    },

    _addPlace: function(place, type, added) {
        let iter = this.append();

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
        this._typeTable[place.name] = type;
        this._dirty = true;

        try {
            this.store();
        } catch (e) {
            Utils.debug(e);
        }
    },

    _exists: function(place, type) {
        return this._typeTable[place.name] === type;
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
    }
});
