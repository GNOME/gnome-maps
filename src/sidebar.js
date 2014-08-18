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
 *         Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>
 */

const Geocode = imports.gi.GeocodeGlib;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Application = imports.application;
const PlaceStore = imports.placeStore;
const PlaceEntry = imports.placeEntry;
const Route = imports.route;
const RouteQuery = imports.routeQuery;
const SearchPopup = imports.searchPopup;
const Utils = imports.utils;

const Sidebar = new Lang.Class({
    Name: 'Sidebar',
    Extends: Gtk.Revealer,

    _init: function(mapView) {
        this.parent({ visible:             true,
                      transition_type:     Gtk.RevealerTransitionType.SLIDE_LEFT,
                      transition_duration: 400, // ms
                      halign:              Gtk.Align.END,
                      valign:              Gtk.Align.FILL
                    });
        this.get_style_context().add_class('maps-sidebar');

        let ui = Utils.getUIObject('sidebar', [ 'sidebar',
                                                'sidebar-form',
                                                'instruction-list-scrolled',
                                                'instruction-list',
                                                'mode-pedestrian-toggle',
                                                'mode-bike-toggle',
                                                'mode-car-toggle']);
        this._instructionList = ui.instructionList;
        this._initInstructionList();

        this._initTransportationToggles(ui.modePedestrianToggle,
                                        ui.modeBikeToggle,
                                        ui.modeCarToggle);

        ui.sidebarForm.attach(this._createEntry("from", mapView),
                              1, 0, 1, 1);
        ui.sidebarForm.attach(this._createEntry("to", mapView),
                              1, 1, 1, 1);
        this.add(ui.sidebar);
    },

    _initTransportationToggles: function(pedestrian, bike, car) {
        let query = Application.routeService.query;
        let transport = RouteQuery.Transportation;

        let onToggle = function(mode, button) {
            if (button.active && query.transportation !== mode)
                query.transportation = mode;
        };
        pedestrian.connect('toggled', onToggle.bind(this, transport.PEDESTRIAN));
        car.connect('toggled', onToggle.bind(this, transport.CAR));
        bike.connect('toggled', onToggle.bind(this, transport.BIKE));

        query.connect('updated', function() {
            switch(query.transportation) {
            case transport.PEDESTRIAN:
                pedestrian.active = true;
                break;
            case transport.CAR:
                car.active = true;
                break;
            case transport.BIKE:
                bike.active = true;
                break;
            }
        });
    },

    _createEntry: function(propName, mapView) {
        let entry = new PlaceEntry.PlaceEntry({ visible: true,
                                                mapView: mapView });
        entry.bind_property("place",
                            Application.routeService.query, propName,
                            GObject.BindingFlags.BIDIRECTIONAL);
        return entry;
    },

    _initInstructionList: function() {
        let route = Application.routeService.route;

        route.connect('reset', this._clearInstructions.bind(this));
        route.connect('update', (function() {
            this._clearInstructions();

            route.turnPoints.forEach((function(turnPoint) {
                let row = new InstructionRow({ visible:true,
                                               turnPoint: turnPoint });
                this._instructionList.add(row);
            }).bind(this));
        }).bind(this));
    },

    _clearInstructions: function() {
        let listBox = this._instructionList;
        listBox.forall(listBox.remove.bind(listBox));
    }
});

const InstructionRow = new Lang.Class({
    Name: "InstructionRow",
    Extends: Gtk.ListBoxRow,

    _init: function(params) {
        this.turnPoint = params.turnPoint;
        delete params.turnPoint;

        this.parent(params);

        this.visible = true;
        let ui = Utils.getUIObject('sidebar', ['instruction-box',
                                               'direction-image',
                                               'instruction-label']);
        ui.instructionLabel.label  = this.turnPoint.instruction;
        ui.directionImage.resource = this.turnPoint.iconResource;

        this.add(ui.instructionBox);
    }
});
