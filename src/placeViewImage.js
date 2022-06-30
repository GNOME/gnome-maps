/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2020 James Westman
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
 * Author: James Westman <james@flyingpimonster.net>
 */

import Cairo from 'cairo';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import Gtk from 'gi://Gtk';

/* The maximum aspect ratio, after which the image will be cropped vertically */
const MAX_ASPECT_RATIO = 1;

export class PlaceViewImage extends Gtk.DrawingArea {
    constructor(params) {
        super(params);

        this._pixbuf = null;
        this._cached = null;
    }

    get pixbuf() {
        return this._pixbuf;
    }

    set pixbuf(val) {
        /* crop the pixbuf to the max aspect ratio, if necessary */
        if (val.height / val.width > MAX_ASPECT_RATIO) {
            let y = (val.height - val.width * MAX_ASPECT_RATIO) / 2;
            val = val.new_subpixbuf(0, y, val.width, val.width * MAX_ASPECT_RATIO);
        }

        this._pixbuf = val;
        this.queue_resize();
    }

    vfunc_snapshot(snapshot) {
        let {x, y, width, height} = this.get_allocation();

        if (this._pixbuf === null || width === 0 || height === 0) {
            return;
        }

        let rect = new Graphene.Rect();

        rect.init(x, y, width, height);

        let cr = snapshot.append_cairo(rect);

        width *= this.scale_factor;
        height *= this.scale_factor;

        /* Cache surfaces so we don't have to do as much scaling */
        if (this._cached === null || width !== this._cached.getWidth() || height !== this._cached.getHeight()) {
            // create a new, scaled image
            this._cached = new Cairo.ImageSurface(Cairo.Format.ARGB32, width, height);

            let cr_scaled = new Cairo.Context(this._cached);
            cr_scaled.scale(width / this._pixbuf.width, height / this._pixbuf.height);
            Gdk.cairo_set_source_pixbuf(cr_scaled, this._pixbuf, 0, 0);
            cr_scaled.paint();
        }

        cr.save();

        if (this.scale_factor !== 1) {
            cr.scale(1 / this.scale_factor, 1 / this.scale_factor);
        }

        cr.setSourceSurface(this._cached, 0, 0);

        cr.paint();
        cr.restore();

        super.vfunc_snapshot(snapshot);
        cr.$dispose();
    }

    vfunc_get_request_mode() {
        return Gtk.SizeRequestMode.HEIGHT_FOR_WIDTH;
    }

    vfunc_measure(orientation, forSize) {
        if (orientation === Gtk.Orientation.VERTICAL) {
            if (this._pixbuf) {
                let height = (this._pixbuf.height / this._pixbuf.width) * forSize;
                return [height, height, 0, 0];
            } else {
                return [0, 0, 0, 0];
            }
        } else {
            return [forSize, forSize, 0, 0];
        }
    }
    /*
    vfunc_get_preferred_height_for_width(width) {
        if (this._pixbuf) {
            let height = (this._pixbuf.height / this._pixbuf.width) * width;
            return [height, height];
        } else {
            return [0, 0];
        }
    }
    */
}

GObject.registerClass(PlaceViewImage);
