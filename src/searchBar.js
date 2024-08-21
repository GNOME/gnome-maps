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

import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {PlaceEntry} from './placeEntry.js';
import { Place } from './place.js';

const _ = gettext.gettext;

// minimum zoom level to show the explore button
const EXPLORE_BUTTON_MIN_ZOOM = 12;

export class SearchBar extends PlaceEntry {
    constructor({mapView, ...params}) {
        super({ mapView:             mapView,
                max_width_chars:     50,
                matchRoute:          true,
                hasPoiBrowser:       true,
                placeholder_text:    _("Search"),
                primary_icon_name:   'system-search-symbolic',
                primary_icon_sensitive: false,
                ...params });

        this._mapView = mapView;
        this._keyCaptureController = new Gtk.EventControllerKey();
        this._keyCaptureController.set_propagation_phase(Gtk.PropagationPhase.BUBBLE);
        this._keyCaptureController.connect('key-pressed',
                                           this._onMapKeyPressed.bind(this));
        this._mapView.map.add_controller(this._keyCaptureController);
        this._mapView.map.viewport.connect('notify::zoom-level',
                                           this._updateIcon.bind(this));
        this._entry = this._getEntry();
    }

    _getEntry() {
        for (const child of this) {
            if (child instanceof Gtk.Text)
                return child;
        }
    }

    _updateIcon() {
        if (!this.text &&
            this._mapView.map.viewport.zoom_level >= EXPLORE_BUTTON_MIN_ZOOM) {
            this.secondary_icon_name = 'explore2-large-symbolic';
            this.secondary_icon_tooltip_text = _("Explore Nearby Places");
        } else {
            this.secondary_icon_tooltip_text = '';
            super._updateIcon();
        }
    }

    _onIconClick() {
        if (!this.text)
            this._onExploreClicked();
        else
            super._onIconClick();
    }

    _onMapKeyPressed(controller, keyval, keycode, state) {
        if (keyval === Gdk.KEY_Tab       || keyval === Gdk.KEY_KP_Tab ||
            keyval === Gdk.KEY_Up        || keyval === Gdk.KEY_KP_Up ||
            keyval === Gdk.KEY_Down      || keyval === Gdk.KEY_KP_Down ||
            keyval === Gdk.KEY_Left      || keyval === Gdk.KEY_KP_Left ||
            keyval === Gdk.KEY_Right     || keyval === Gdk.KEY_KP_Right ||
            keyval === Gdk.KEY_Home      || keyval === Gdk.KEY_KP_Home ||
            keyval === Gdk.KEY_End       || keyval === Gdk.KEY_KP_End ||
            keyval === Gdk.KEY_Page_Up   || keyval === Gdk.KEY_KP_Page_Up ||
            keyval === Gdk.KEY_Page_Down || keyval === Gdk.KEY_KP_Page_Down ||
            keyval === Gdk.KEY_Control_L || keyval === Gdk.KEY_KEY_Control_R ||
            keyval === Gdk.KEY_Alt_L     ||
            ((state & (Gdk.ModifierType.CONTROL_MASK |
                       Gdk.ModifierType.ALT_MASK)) !== 0)) {
            return false;
        } else {
            this.grab_focus();

            return controller.forward(this._entry);
        }
    }

    _onExploreClicked() {
        /* show main category if the popover isn't already visible,
         * or if a previous result is showing.
         * otherwise close the popover
         */
        if (!this.popover.visible || !this.popover.isShowingPoiBrowser)
            this.browsePois();
        else
            this.popover.popdown();
    }

    _updateExploreButtonSensitivity() {
        this.secondary_icon_sensitive =
            this._mapView.map.viewport.zoom_level >= EXPLORE_BUTTON_MIN_ZOOM;
    }
}

GObject.registerClass(SearchBar);

