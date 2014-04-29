/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2011, 2012, 2013 Red Hat, Inc.
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
 * Author: Zeeshan Ali (Khattak) <zeeshanak@gnome.org>
 */

const Clutter = imports.gi.Clutter;
const Champlain = imports.gi.Champlain;
const GObject = imports.gi.GObject;

const Lang = imports.lang;
const Mainloop = imports.mainloop;

const MapLocation = imports.mapLocation;
const Utils = imports.utils;
const Path = imports.path;
const _ = imports.gettext.gettext;

const UserLocation = new Lang.Class({
    Name: 'UserLocation',
    Extends: MapLocation.MapLocation,

    show: function(layer) {
        layer.remove_all();

        this._locationMarker = new Champlain.CustomMarker();
        this._locationMarker.set_location(this.latitude, this.longitude);
        this._locationMarker.connect('notify::size', (function() {
            let translate_x = -Math.floor(this._locationMarker.get_width() / 2);
            this._locationMarker.set_translation(translate_x,
                                                 -this._locationMarker.get_height(),
                                                 0);
        }).bind(this));
        let pin_actor = Utils.CreateActorFromImageFile(Path.ICONS_DIR + "/pin.svg");
        if (!pin_actor)
            return;
        let bubbleActor = Utils.CreateActorFromImageFile(Path.ICONS_DIR + "/bubble.svg");
        if (!bubbleActor)
            return;
        bubbleActor.set_x_expand(true);
        bubbleActor.set_y_expand(true);
        /* Translators: Showing name of place where user currently is and
                        accuracy of this information (which is translated
                        separately)
        */
        let text = _("%s\nPosition Accuracy: %s")
                .format (this.description, this.getAccuracyDescription());
        let textActor = new Clutter.Text({ text: text });
        textActor.set_use_markup(true);
        textActor.set_margin_left(6);
        textActor.set_margin_right(6);
        textActor.set_color(new Clutter.Color({ red: 255,
                                                blue: 255,
                                                green: 255,
                                                alpha: 255 }));
        let layout = new Clutter.BinLayout();
        let descriptionActor = new Clutter.Actor({ layout_manager: layout });
        descriptionActor.add_child(bubbleActor);
        descriptionActor.add_child(textActor);

        layout = new Clutter.BoxLayout({ vertical: true });
        let locationActor = new Clutter.Actor({ layout_manager: layout });
        locationActor.add_child(descriptionActor);
        locationActor.add_child(pin_actor);

        this._locationMarker.add_actor(locationActor);

        this._locationMarker.bind_property("selected",
                                           descriptionActor, "visible",
                                           GObject.BindingFlags.SYNC_CREATE);
        this._view.connect('button-press-event',
                           this.setSelected.bind(this, false));

        if (this.accuracy === 0) {
            layer.add_marker(this._locationMarker);
            return;
        }

        // FIXME: Perhaps this is a misuse of Champlain.Point class and we
        // should draw the cirlce ourselves using Champlain.CustomMarker?
        // Although for doing so we'll need to add a C lib as cairo isn't
        // exactly introspectable.
        this._accuracyMarker = new Champlain.Point();
        this._accuracyMarker.set_color(new Clutter.Color({ red: 0,
                                                           blue: 255,
                                                           green: 0,
                                                           alpha: 50 }));
        this._accuracyMarker.set_location(this.latitude, this.longitude);
        this._accuracyMarker.set_reactive(false);

        this._updateAccuracyMarker();
        if (this._selectedId > 0)
            this._locationMarker.disconnect(this._selectedId);
        this._selectedId = this._locationMarker.connect("notify::selected",
                                                        this._updateAccuracyMarker.bind(this));

        layer.add_marker(this._accuracyMarker);
        layer.add_marker(this._locationMarker);

        if (this._zoomLevelId > 0)
            this._view.disconnect(this._zoomLevelId);
        this._zoomLevelId = this._view.connect("notify::zoom-level", this._updateAccuracyMarker.bind(this));
    },

    getSelected: function() {
        return this._locationMarker && this._locationMarker.get_selected();
    },

    setSelected: function(value) {
        if (this._locationMarker)
            this._locationMarker.set_selected(value);
    },

    _updateAccuracyMarker: function() {
        if (!this._locationMarker.get_selected()) {
            this._accuracyMarker.hide();
            return;
        }

        let zoom = this._view.get_zoom_level();
        let source = this._view.get_map_source();
        let metersPerPixel = source.get_meters_per_pixel(zoom, this.latitude, this.longitude);
        let size = this.accuracy * 2 / metersPerPixel;
        let viewWidth = this._view.get_width();
        let viewHeight = this._view.get_height();
        if ((viewWidth > 0 && viewHeight > 0) &&
            (size > viewWidth && size > viewHeight))
            this._accuracyMarker.hide();
        else {
            this._accuracyMarker.set_size(size);
            this._accuracyMarker.show();
        }
    }
});
