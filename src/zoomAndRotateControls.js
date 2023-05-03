/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2023 Marcus Lundblad
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
 * with GNOME Maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Marcus Lundblad <ml@dfupdate.se>
 */

import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';

class RotationButton extends Gtk.Button {

    vfunc_snapshot(snapshot) {
        let mapView = this.parent.parent.mapView;

        snapshot.save();

        if (mapView?.map.viewport.rotation != 0.0) {
            // rotate around the center of the icon
            let width = this.get_width();
            let height = this.get_height();
            let point = new Graphene.Point();

            point.init(width / 2, height / 2);
            snapshot.translate(point);
            snapshot.rotate(mapView.map.viewport.rotation * 180 / Math.PI);
            point.init(-width / 2, -height / 2);
            snapshot.translate(point);
        }

        super.vfunc_snapshot(snapshot);
        snapshot.restore();
    }
}
GObject.registerClass(RotationButton);

export class ZoomAndRotateControls extends Gtk.Box {
    constructor({ mapView, ...params }) {
        super(params);

        this._mapView = mapView;

        this._mapView.map.viewport.connect('notify::rotation', () => {
            this._updateRotationButton();
        });

        this._updateRotationButton();
    }

    _updateRotationButton() {
        let rotation = this._mapView.map.viewport.rotation;

        if (rotation != 0)
            this._rotationButton.queue_draw();

        this._revealer.reveal_child = rotation != 0;
    }

    get mapView() {
        return this._mapView;
    }
}
GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/zoom-and-rotate-controls.ui',
    InternalChildren: ['rotationButton',
                       'revealer']
}, ZoomAndRotateControls);
