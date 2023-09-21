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

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {PlaceView} from './placeView.js';

/* Maximum width of the popover content before it's forced to wrap */
const MAX_CONTENT_WIDTH = 350;
/* Margin between the height of the main window and the height of the popover
   contents */
const HEIGHT_MARGIN = 100;

export class MapBubble extends Gtk.Popover {

    constructor({place, mapView, ...params}) {
        super(params);

        let content = new PlaceView({ place, mapView, visible: true });

        let scrolledWindow = new MapBubbleScrolledWindow({ visible: true,
                                                           propagateNaturalWidth: true,
                                                           propagateNaturalHeight: true,
                                                           hscrollbarPolicy: Gtk.PolicyType.NEVER,
                                                           child: content });
        this.child = scrolledWindow;

        /* focus on the map when the bubble is closed, to allow continuing
         * keyboard navigation
         */
        this.connect('closed', () => mapView.map.grab_focus());

        this.get_style_context().add_class("map-bubble");
    }
}

GObject.registerClass(MapBubble);

export class MapBubbleScrolledWindow extends Gtk.ScrolledWindow {
    /*
    vfunc_get_request_mode() {
        return Gtk.SizeRequestMode.HEIGHT_FOR_WIDTH;
    }
    */

    /*
    vfunc_measure(orientation, forSize) {
        log('measure: ' + orientation + ', ' + forSize);

        let [cm, cn, cbx, cby] = this.child.measure(orientation, forSize);

        log('child measure: ' + cm + ', ' + cn);

        // TODO: fix
        return [500, 500, null, null];

        if (orientation === Gtk.Orientation.HORIZONTAL) {
            let windowHeight = this.get_toplevel().get_allocated_height() - HEIGHT_MARGIN;
            let [min, nat] = this.get_child().get_preferred_height_for_width(width);
            min = Math.min(min, windowHeight);
            nat = Math.min(nat, windowHeight);
            return [min, nat, 0, 0];
        } else {
            let [min, nat] = this.get_child().get_preferred_width();
            min = Math.min(min, MAX_CONTENT_WIDTH);
            nat = Math.min(nat, MAX_CONTENT_WIDTH);
            return [min, nat, 0, 0];
        }
    }
    */

    /*
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
    */

    /*
    vfunc_snapshot(snapshot) {
        let popover = this.get_ancestor(Gtk.Popover);
        if (popover) {
            let {x, y, width, height} = this.get_allocation();
            let rect = new Graphene.Rect();

            log('allocation: ' + [x, y]);

            rect.init(x, y, width, height);

            let cr = snapshot.append_cairo(rect);
            // clip the top corners to the rounded corner

            let radius = popover.get_style_context()
                                .get_property(Gtk.STYLE_PROPERTY_BORDER_RADIUS, popover.get_state_flags())
                                * this.scale_factor;

            // TODO: how to do this?
            let radius = 0;

            // bottom left
            cr.moveTo(0, height);
            cr.lineTo(0, radius);
            cr.arc(radius, radius, radius, Math.PI, -Math.PI / 2.0);
            cr.arc(width - radius, radius, radius, -Math.PI / 2.0, 0);
            cr.lineTo(width, height);

            cr.clip();
            cr.$dispose();
        }

        super.vfunc_snapshot(snapshot);
    }
    */
}

GObject.registerClass(MapBubbleScrolledWindow);

