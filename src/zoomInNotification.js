/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2016 Marcus Lundblad.
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
 * Author: Marcus Lundblad <ml@update.uu.se>
 */

const GObject = imports.gi.GObject;

const Application = imports.application;
const Notification = imports.notification;
const OSMEdit = imports.osmEdit;
const Utils = imports.utils;

var ZoomInNotification = GObject.registerClass(
class ZoomInNotification extends Notification.Notification {

    _init(props) {
        this._latitude = props.latitude;
        this._longitude = props.longitude;
        this._view = props.view;
        super._init();

        let ui = Utils.getUIObject('zoom-in-notification', [ 'grid',
                                                             'okButton' ]);

        ui.okButton.connect('clicked', () => this._onZoomIn());
        this._ui.body.add(ui.grid);
    }

    _onZoomIn() {
        this._view.zoom_level = OSMEdit.MIN_ADD_LOCATION_ZOOM_LEVEL;

        /* center on the position first selected */
        this._view.center_on(this._latitude, this._longitude);
        this.dismiss();
    }
})
