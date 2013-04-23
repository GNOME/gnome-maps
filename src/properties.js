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
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Champlain = imports.gi.Champlain;
const GtkClutter = imports.gi.GtkClutter;
const Geocode = imports.gi.GeocodeGlib;
const Gd = imports.gi.Gd;
const MapView = imports.mapView;

const Lang = imports.lang;
const Mainloop = imports.mainloop;

const Utils = imports.utils;
const _ = imports.gettext.gettext;

const Properties = new Lang.Class({
    Name: 'Properties',

    _init: function(mapView) {
        this._mapView = mapView;
        this.actor = new Clutter.Actor({ layout_manager: new Clutter.BoxLayout({ spacing: 12 }),
                                         y_expand: true,
                                         x_align: Clutter.ActorAlign.END });

        // create the button
        let revealButton = new Gd.HeaderSimpleButton({ symbolic_icon_name: 'go-previous-symbolic',
                                                       valign: Gtk.Align.CENTER });
        revealButton.get_style_context().add_class('osd');
        revealButton.show();

        // then the sidebar itself, packed into the revealer
        let propsGrid = new Gtk.Grid({ vexpand: true,
                                       hexpand: true,
                                       margin_top: 32,
                                       margin_left: 32,
                                       margin_right: 32,
                                       row_spacing: 15,
                                       orientation: Gtk.Orientation.VERTICAL,
                                       valign: Gtk.Align.FILL });

        let label = new Gtk.Label({ label: _("<b>Map Type</b>"),
                                    use_markup: true });
        propsGrid.add(label);

        let radioGrid = new Gtk.Grid({ row_spacing: 5,
                                       orientation: Gtk.Orientation.VERTICAL });
        propsGrid.add(radioGrid);
        var radio = this.addMapTypeRadio(null, radioGrid, _("Street"), MapView.MapType.STREET);
        this.addMapTypeRadio(radio, radioGrid, _("Satellite"), MapView.MapType.AERIAL);
        this.addMapTypeRadio(radio, radioGrid, _("Cycling"), MapView.MapType.CYCLING);
        this.addMapTypeRadio(radio, radioGrid, _("Transit"), MapView.MapType.TRANSIT);

        let propsContainer = new Gtk.Frame({ child: propsGrid,
                                             shadow_type: Gtk.ShadowType.IN,
                                             width_request: 200 });
        propsContainer.get_style_context().add_class('maps-sidebar');

        let revealer = new Gd.Revealer({ child: propsContainer,
                                         reveal_child: false,
                                         orientation: Gtk.Orientation.VERTICAL });
        revealer.show_all();

        revealButton.connect('clicked', Lang.bind(this, function() {
            if (revealer.reveal_child) {
                revealer.reveal_child = false;
                revealButton.symbolic_icon_name = 'go-previous-symbolic';
            } else {
                revealer.reveal_child = true;
                revealButton.symbolic_icon_name = 'go-next-symbolic';
            }
        }));

        // now create actors
        let buttonActor = new GtkClutter.Actor({ contents: revealButton,
                                                 x_align: Clutter.ActorAlign.END });
        Utils.clearGtkClutterActorBg(buttonActor);
        this.actor.add_child(buttonActor);

        let revealerActor = new GtkClutter.Actor({ contents: revealer,
                                                   x_align: Clutter.ActorAlign.END,
                                                   x_expand: true,
                                                   y_expand: true });
        this.actor.add_child(revealerActor);
    },

    addMapTypeRadio: function(groupLeader, container, label, mapType) {
        let radio = Gtk.RadioButton.new_with_label_from_widget(groupLeader, label);
        radio.connect("toggled", Lang.bind(this, function(radio) {
            if (!radio.get_active())
                return;

            this._mapView.setMapType(mapType);
        }));

        container.add(radio);

        return radio;
    }
});
