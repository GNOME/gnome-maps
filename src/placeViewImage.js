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

import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import Gtk from 'gi://Gtk';

export class PlaceViewImage extends Gtk.Widget {
    /* The maximum aspect ratio, after which the image will be cropped vertically */
    static MAX_ASPECT_RATIO = 1;

    constructor(params) {
        super(params);

        this._paintable = null;
    }

    get paintable() {
        return this._paintable;
    }

    set paintable(val) {
        this._paintable = val;
        this.queue_resize();
    }

    vfunc_snapshot(snapshot) {
        const width = this.get_width();
        const height = this.get_height();

        if (this._paintable === null || width === 0 || height === 0) {
            return;
        }

        snapshot.save();

        const clipRect = new Graphene.Rect();

        clipRect.init(0, 0, width, height);
        snapshot.push_clip(clipRect);

        const paintableWidth = this._paintable.get_intrinsic_width();
        const paintableHeight = this._paintable.get_intrinsic_height();

        const scale = Math.max(width / paintableWidth, height / paintableHeight);
        const scaledWidth = paintableWidth * scale;
        const scaledHeight = paintableHeight * scale;

        const translate = new Graphene.Point();
        translate.init((width - scaledWidth) / 2, (height - scaledHeight) / 2);
        snapshot.translate(translate);

        this._paintable.snapshot(snapshot, scaledWidth, scaledHeight);

        snapshot.pop();
        snapshot.restore();

        super.vfunc_snapshot(snapshot);
    }

    vfunc_get_request_mode() {
        return Gtk.SizeRequestMode.HEIGHT_FOR_WIDTH;
    }

    vfunc_measure(orientation, forSize) {
        if (orientation === Gtk.Orientation.VERTICAL) {
            if (this._paintable) {
                const paintableWidth = this._paintable.get_intrinsic_width();
                const paintableHeight = this._paintable.get_intrinsic_height();
                const height =
                    Math.min(paintableHeight / paintableWidth,
                             PlaceViewImage.MAX_ASPECT_RATIO) * forSize;
                return [height, height, -1, -1];
            } else {
                return [0, 0, -1, -1];
            }
        } else {
            return [forSize, forSize, -1, -1];
        }
    }
}

GObject.registerClass(PlaceViewImage);
