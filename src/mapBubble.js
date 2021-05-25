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

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;

const Application = imports.application;
const ContactPlace = imports.contactPlace;
const GeocodeFactory = imports.geocode;
const Place = imports.place;
const PlaceView = imports.placeView;
const PlaceButtons = imports.placeButtons;
const PlaceFormatter = imports.placeFormatter;
const PlaceStore = imports.placeStore;
const Utils = imports.utils;

/* Maximum width of the popover content before it's forced to wrap */
const MAX_CONTENT_WIDTH = 350;
/* Margin between the height of the main window and the height of the popover
   contents */
const HEIGHT_MARGIN = 100;

var MapBubble = GObject.registerClass(
class MapBubble extends Gtk.Popover {

    _init(params) {
        let place = params.place;
        delete params.place;

        let mapView = params.mapView;
        delete params.mapView;

        params.relative_to = mapView;
        params.transitions_enabled = false;
        params.modal = false;

        super._init(params);

        let content = new PlaceView.PlaceView({ place, mapView, visible: true });

        let scrolledWindow = new MapBubbleScrolledWindow({ visible: true,
                                                           propagateNaturalWidth: true,
                                                           propagateNaturalHeight: true,
                                                           hscrollbarPolicy: Gtk.PolicyType.NEVER });
        scrolledWindow.add(content);
        this.add(scrolledWindow);

        this.get_style_context().add_class("map-bubble");
    }
});

var MapBubbleScrolledWindow = GObject.registerClass(
class MapBubbleScrolledWindow extends Gtk.ScrolledWindow {
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
});

