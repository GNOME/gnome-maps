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

export class MapBubble extends Gtk.Popover {

    constructor({place, mapView, ...params}) {
        super(params);

        const content = new PlaceView({ place, mapView });
        const scrolledWindow =
            new Gtk.ScrolledWindow({ propagateNaturalWidth:  true,
                                     propagateNaturalHeight: true,
                                     hscrollbarPolicy:       Gtk.PolicyType.NEVER,
                                     child:                  content });
        this.child = scrolledWindow;

        /* focus on the map when the bubble is closed, to allow continuing
         * keyboard navigation
         */
        this.connect('closed', () => {
            this.unparent();
            mapView.map.grab_focus();
        });

        this.get_style_context().add_class("map-bubble");
    }
}

GObject.registerClass(MapBubble);


