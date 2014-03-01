/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
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
 * Author: Dario Di Nucci <linkin88mail@gmail.com>
 */

const Gtk = imports.gi.Gtk;

const Lang = imports.lang;
const Utils = imports.utils;

const LayersPopover = new Lang.Class({
    Name: 'LayersPopover',
    Extends: Gtk.Popover,

    _init: function() {
        let ui = Utils.getUIObject('layers-popover', [ 'grid',
                                                       'street-layer-button',
                                                       'aerial-layer-button' ]);

        this.parent({ width_request: 200,
                      no_show_all: true,
                      visible: false });

        ui.aerialLayerButton.join_group(ui.streetLayerButton);

        this.get_style_context().add_class('maps-popover');
        this.add(ui.grid);
    }
});
Utils.addSignalMethods(LayersPopover.prototype);
