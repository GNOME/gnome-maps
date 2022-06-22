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

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {Application} from './application.js';
import * as GeocodeFactory from './geocode.js';
import {Place} from './place.js';
import {PlaceView} from './placeView.js';
import {PlaceButtons} from './placeButtons.js';
import {PlaceFormatter} from './placeFormatter.js';
import {PlaceStore} from './placeStore.js';
import * as Utils from './utils.js';

/* Maximum width of the popover content before it's forced to wrap */
const MAX_CONTENT_WIDTH = 350;
/* Margin between the height of the main window and the height of the popover
   contents */
const HEIGHT_MARGIN = 100;

export class MapBubble extends Gtk.Popover {

    constructor(params) {
        let place = params.place;
        delete params.place;

        let mapView = params.mapView;
        delete params.mapView;

        params.relative_to = mapView;
        params.transitions_enabled = false;
        params.modal = false;

        super(params);

        let content = new PlaceView({ place, mapView, visible: true });

        let scrolledWindow = new MapBubbleScrolledWindow({ visible: true,
                                                           propagateNaturalWidth: true,
                                                           propagateNaturalHeight: true,
                                                           hscrollbarPolicy: Gtk.PolicyType.NEVER });
        scrolledWindow.add(content);
        this.add(scrolledWindow);

        this.get_style_context().add_class("map-bubble");
    }
}

GObject.registerClass(MapBubble);

export class MapBubbleScrolledWindow extends Gtk.ScrolledWindow {
    vfunc_get_preferred_width() {
        let [min, nat] = this.get_child().get_preferred_width();
        min = Math.min(min, MAX_CONTENT_WIDTH);
        nat = Math.min(nat, MAX_CONTENT_WIDTH);
        return [min, nat];
    }

    vfunc_get_preferred_height_for_width(width) {
        let windowHeight = this.get_toplevel().get_allocated_height() - HEIGHT_MARGIN;
        let [min, nat] = this.get_child().get_preferred_height_for_width(width);
        min = Math.min(min, windowHeight);
        nat = Math.min(nat, windowHeight);
        return [min, nat];
    }

    vfunc_draw(cr) {
        let popover = this.get_ancestor(Gtk.Popover);
        if (popover) {
            let [{x, y, width, height}, baseline] = this.get_allocated_size();

            // clip the top corners to the rounded corner
            let radius = popover.get_style_context()
                                .get_property(Gtk.STYLE_PROPERTY_BORDER_RADIUS, popover.get_state_flags())
                                * this.scale_factor;

            // bottom left
            cr.moveTo(0, height);
            cr.lineTo(0, radius);
            cr.arc(radius, radius, radius, Math.PI, -Math.PI / 2.0);
            cr.arc(width - radius, radius, radius, -Math.PI / 2.0, 0);
            cr.lineTo(width, height);

            cr.clip();
        }

        return super.vfunc_draw(cr);
    }
}

GObject.registerClass(MapBubbleScrolledWindow);

