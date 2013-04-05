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
 * Author: Cosimo Cecchi <cosimoc@gnome.org>
 *         Zeeshan Ali (Khattak) <zeeshanak@gnome.org>
 */

const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Champlain = imports.gi.Champlain;
const Clutter = imports.gi.Clutter;
const Geocode = imports.gi.GeocodeGlib;
const Gd = imports.gi.Gd;
const GtkClutter = imports.gi.GtkClutter;
const Properties = imports.properties;
const MapView = imports.mapView;

const Lang = imports.lang;
const Mainloop = imports.mainloop;

const Application = imports.application;
const Utils = imports.utils;
const _ = imports.gettext.gettext;

const MapViewEmbed = new Lang.Class({
    Name: 'MapViewEmbed',
    Extends: GtkClutter.Embed,

    _init: function() {
        this.parent();

        this._cursorHandOpen = Gdk.Cursor.new(Gdk.CursorType.HAND1);
        this._cursorHandClosed = Gdk.Cursor.new(Gdk.CursorType.FLEUR);

        this.mapView = new MapView.MapView();
        this._layout = new Clutter.BinLayout();
        this._actor = new Clutter.Actor({ layout_manager: this._layout,
                                          x_expand: true,
                                          y_expand: true });

        this.mapView.actor.x_expand = true;
        this.mapView.actor.y_expand = true;
        this._actor.add_child(this.mapView.actor);

        this._properties = new Properties.Properties(this.mapView);
        this._actor.add_child(this._properties.actor);

        let stage = this.get_stage();
        stage.add_actor(this._actor);

        this.connect('button-press-event', Lang.bind(this, this._onButtonPress));
        this.connect('button-release-event', Lang.bind(this, this._onButtonRelease));
    },

    vfunc_realize: function(params) {
        this.parent(params);
        this._updateViewStyle();
    },

    vfunc_style_updated: function(params) {
        this.parent(params);
        this._updateViewStyle();
    },

    vfunc_size_allocate: function(params) {
        this.parent(params);

        let allocation = this.get_allocation();

        this.mapView.actor.set_size(allocation.width,
                                    allocation.height);
    },

    _onButtonPress: function(event) {
        this.get_window().set_cursor(this._cursorHandClosed);
        return false;
    },

    _onButtonRelease: function() {
        this.get_window().set_cursor(this._cursorHandOpen);
        return false;
    },

    _updateViewStyle: function() {
        function clutterColorFromRGBA(rgba) {
            return new Clutter.Color({ red: rgba.red * 255,
                                       green: rgba.green * 255,
                                       blue: rgba.blue * 255,
                                       alpha: rgba.alpha * 255 });
        }

        let context = this.get_style_context();
        let rgba = context.get_color(Gtk.StateFlags.SELECTED);
        let color = clutterColorFromRGBA(rgba);
        Champlain.Marker.set_selection_text_color(color);

        rgba = context.get_background_color(Gtk.StateFlags.SELECTED);
        color = clutterColorFromRGBA(rgba);
        Champlain.Marker.set_selection_color(color);

        this.get_window().set_cursor(this._cursorHandOpen);
    }
});
