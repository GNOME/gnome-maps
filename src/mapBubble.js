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
 * with GNOME Maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Damián Nohales <damiannohales@gmail.com>
 */

const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Application = imports.application;
const Utils = imports.utils;

const Button = {
    NONE: 0
};

const MapBubble = new Lang.Class({
    Name: "MapBubble",
    Extends: Gtk.Popover,
    Abstract: true,

    _init: function(params) {
        this._place = params.place;
        delete params.place;

        this._mapView = params.mapView;
        params.relative_to = params.mapView;
        delete params.mapView;

        let buttonFlags = params.buttons || Button.NONE;
        delete params.buttons;

        params.modal = false;

        this.parent(params);
        let ui = Utils.getUIObject('map-bubble', [ 'bubble-main-grid',
                                                   'bubble-image',
                                                   'bubble-content-area',
                                                   'bubble-button-area']);
        this._image = ui.bubbleImage;
        this._content = ui.bubbleContentArea;

        if (!buttonFlags)
            ui.bubbleButtonArea.visible = false;

        this.add(ui.bubbleMainGrid);
    },

    get image() {
        return this._image;
    },

    get place() {
        return this._place;
    },

    get content() {
        return this._content;
    }
});
