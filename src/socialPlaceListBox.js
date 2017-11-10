/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2014 Damián Nohales
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
 * Author: Damián Nohales <damiannohales@gmail.com>
 */

const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

var SocialPlaceRow = new Lang.Class({
    Name: 'SocialPlaceRow',
    Extends: Gtk.ListBoxRow,
    Template: 'resource:///org/gnome/Maps/ui/social-place-row.ui',
    InternalChildren: [ 'nameLabel',
                        'categoryLabel' ],

    _init: function(params) {
        this.place = params.place;
        delete params.place;

        this.parent(params);

        this._nameLabel.label = this.place.name;
        if (this.place.category)
            this._categoryLabel.label = this.place.category;
        else
            this._categoryLabel.visible = false;
    }
});

var SocialPlaceMoreResultsRow = new Lang.Class({
    Name: 'SocialPlaceMoreResultsRow',
    Extends: Gtk.ListBoxRow,
    Template: 'resource:///org/gnome/Maps/ui/social-place-more-results-row.ui'
});

var SocialPlaceListBox = new Lang.Class({
    Name: 'SocialPlaceListBox',
    Extends: Gtk.ListBox,
    Signals: {
        'place-selected': { param_types: [GObject.TYPE_OBJECT] }
    },

    _init: function(params) {
        params.activate_on_single_click = true;
        this.parent(params);

        this.connect('row-activated', (list, row) => {
            if (!row.place) {
                // "Show more results" row activated
                row.destroy();
                this._showBadMatches();
            } else
                this.emit('place-selected', row.place);
        });
    },

    get matches() {
        return this._matches;
    },

    set matches(matches) {
        this.forall(function(row) {
            row.destroy();
        });

        this._matches = matches;

        if (this._matches.exactMatches.length +
            this._matches.goodMatches.length === 0) {
            this._showBadMatches();
        } else {
            this._matches.exactMatches.forEach(this._addPlace.bind(this));
            this._matches.goodMatches.forEach(this._addPlace.bind(this));

            if (this._matches.badMatches.length > 0)
                this._addMoreResults();
        }
    },

    _showBadMatches: function() {
        this._matches.badMatches.forEach(this._addPlace.bind(this));
    },

    _addPlace: function(place) {
        this.add(new SocialPlaceRow({ place: place }));
    },

    _addMoreResults: function() {
        this.add(new SocialPlaceMoreResultsRow({}));
    }
});
