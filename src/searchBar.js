/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2023 Marcus Lundblad.
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
 * Author: Marcus Lundblad <ml@dfupdate.se>
 */

import gettext from 'gettext';

import GeocodeGlib from 'gi://GeocodeGlib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {PlaceEntry} from './placeEntry.js';

const _ = gettext.gettext;

// minimum zoom level to show the explore button
const EXPLORE_BUTTON_MIN_ZOOM = 15;

export class SearchBar extends Gtk.Grid {
    constructor({mapView, ...params}) {
        super(params);

        this._mapView = mapView;
        this._placeEntry = new PlaceEntry({ mapView: mapView,
                                            max_width_chars: 50,
                                            matchRoute: true,
                                            hasPoiBrowser: true,
                                            popoverParent: this,
                                            placeholder_text: _("Search") });
        this.attach(this._placeEntry, 0, 0, 1, 1);
        this._placeEntry.set_key_capture_widget(this._mapView.map);

        /* looks like we need to create the button in code as well, since
         * the place entry is created here and added after the template
         * was initialized, else the linked style doesn't get applied properly
         */
        this._exploreButton =
            new Gtk.Button({ valign: Gtk.Align.CENTER,
                             tooltip_text: _("Explore Nearby Places"),
                             icon_name: 'pan-down-symbolic' });
        this.attach(this._exploreButton, 1, 0, 1, 1);
        this._exploreButton.connect('clicked', () => this._onExploreButtonClicked());
        this._placeEntry.bind_property('place', this, 'place',
                                       GObject.BindingFlags.DEFAULT);
        this._mapView.map.viewport.connect('notify::zoom-level',
                                           this._updateExploreButtonSensitivity.bind(this));
        this._updateExploreButtonSensitivity();
    }

    get popover() {
        return this._placeEntry.popover;
    }

    get placeEntry()  {
        return this._placeEntry;
    }

    set text(text) {
        this._placeEntry.text = text;
    }

    /**
     * Update results popover
     * places array of places from search result
     * searchText original search string to highlight in results
     */
    updateResults(places, searchText) {
        this._placeEntry.updateResults(places, searchText, false);
    }

    _onExploreButtonClicked() {
        /* show main category if the popover isn't already visible,
         * or if a previous result is showing.
         * otherwise close the popover
         */
        if (!this.popover.visible || !this.popover.isShowingPoiBrowser)
            this._placeEntry.browsePois();
        else
            this.popover.popdown();
    }

    _updateExploreButtonSensitivity() {
        this._exploreButton.sensitive =
            this._mapView.map.viewport.zoom_level >= EXPLORE_BUTTON_MIN_ZOOM;
    }
}

GObject.registerClass({
    Properties: {
        'place': GObject.ParamSpec.object('place',
                                          'Place',
                                          'The selected place',
                                          GObject.ParamFlags.READABLE |
                                          GObject.ParamFlags.WRITABLE,
                                          GeocodeGlib.Place)
    },
    Template: 'resource:///org/gnome/Maps/ui/search-bar.ui'
}, SearchBar);

