/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2025 Marcus Lundblad
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

import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import Gtk from 'gi://Gtk';

import {MapMarker} from './mapMarker.js';

export class IconMarker extends MapMarker {

    constructor(params) {
        super(params);

        this._image = new Gtk.Image({ icon_size: Gtk.IconSize.NORMAL });
        this.child = this._image;
    }

    _paintableFromIconName(name, size, color) {
        let display = Gdk.Display.get_default();
        let theme = Gtk.IconTheme.get_for_display(display);
        let iconPaintable = theme.lookup_icon(name, null, size,
                                              this.scale_factor,
                                              Gtk.TextDirection.NONE, 0);

        if (color) {
            let snapshot = Gtk.Snapshot.new();
            let rect = new Graphene.Rect();

            iconPaintable.snapshot_symbolic(snapshot, size, size, [color]);
            rect.init(0, 0, size, size);

            let node = snapshot.to_node();
            let renderer = this._mapView.get_native().get_renderer();

            return renderer.render_texture(node, rect);
        } else {
            return iconPaintable;
        }
    }
}

GObject.registerClass({ Abstract: true }, IconMarker);
