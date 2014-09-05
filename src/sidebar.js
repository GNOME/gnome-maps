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
const _ = imports.gettext.gettext;

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
        this.parent({ visible: true,
                      transition_type: Gtk.RevealerTransitionType.SLIDE_LEFT,
                      transition_duration: 400, // ms
                      halign: Gtk.Align.END,
                      valign: Gtk.Align.FILL
                    });
        this.get_style_context().add_class('maps-sidebar');

        let ui = Utils.getUIObject('sidebar', [ 'sidebar',
                                                'via-grid-container',
                                                'instruction-list-scrolled',
                                                'instruction-stack',
                                                'instruction-spinner',
                                                'instruction-list',
                                                'mode-pedestrian-toggle',
                                                'mode-bike-toggle',
                                                'mode-car-toggle',
                                                'time-info',
                                                'distance-info',
                                                'from-entry-grid',
                                                'to-entry-grid',
                                                'via-add-button']);

        this._mapView = mapView;
        this._viaGridContainer = ui.viaGridContainer;
        this._instructionList = ui.instructionList;
        this._instructionStack = ui.instructionStack;
        this._instructionWindow = ui.instructionListScrolled;
        this._instructionSpinner = ui.instructionSpinner;
        this._timeInfo = ui.timeInfo;
        this._distanceInfo = ui.distanceInfo;

        this._initInstructionList();

        this._initTransportationToggles(ui.modePedestrianToggle,
                                        ui.modeBikeToggle,
                                        ui.modeCarToggle);

        this._initRouteEntry(ui.fromEntryGrid, 0);
        this._initRouteEntry(ui.toEntryGrid, 1);

        ui.viaAddButton.connect('clicked', (function() {
            this._createViaRow(ui.viaGridContainer);
        }).bind(this));

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

        query.connect('notify::transportation', function() {
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

    _createPlaceEntry: function() {
        return new PlaceEntry.PlaceEntry({ visible: true,
                                           can_focus: true,
                                           hexpand: true,
                                           receives_default: true,
                                           mapView: this._mapView });
    },

    _createViaRow: function(listbox) {
        let ui = Utils.getUIObject('route-via-row', [ 'via-grid',
                                                      'via-remove-button',
                                                      'via-entry-grid' ]);

        // Always insert before 'To'
        let insertIndex = Application.routeService.query.points.length - 1;
        listbox.insert(ui.viaGrid, insertIndex);
        this._initRouteEntry(ui.viaEntryGrid, insertIndex);

        ui.viaRemoveButton.connect('clicked', function() {
            let row = ui.viaGrid.get_parent();
            let pointIndex = row.get_index();

            listbox.remove(row);
            Application.routeService.query.removePoint(pointIndex + 1);
        });
    },

    _initRouteEntry: function(container, pointIndex) {
        let entry = this._createPlaceEntry();
        container.add(entry);

        let point = new RouteQuery.QueryPoint();
        entry.bind_property('place',
                            point, 'place',
                            GObject.BindingFlags.BIDIRECTIONAL);
        Application.routeService.query.addPoint(point, pointIndex);
    },

    _initInstructionList: function() {
        let route = Application.routeService.route;
        let query = Application.routeService.query;

        route.connect('reset', (function() {
            this._clearInstructions();
            this._instructionStack.visible_child = this._instructionWindow;
            this._viaGridContainer.get_children().forEach((function(row) {
                query.removePoint(row.get_index() + 1);
                row.destroy();
            }).bind(this));

            this._timeInfo.label = '';
            this._distanceInfo.label = '';
        }).bind(this));

        query.connect('notify', (function() {
            if (query.isValid())
                this._instructionStack.visible_child = this._instructionSpinner;
        }).bind(this));

        route.connect('update', (function() {
            this._clearInstructions();
            this._instructionStack.visible_child = this._instructionWindow;

            route.turnPoints.forEach((function(turnPoint) {
                let row = new InstructionRow({ visible: true,
                                               turnPoint: turnPoint });
                this._instructionList.add(row);
            }).bind(this));

            /* Translators: %s is a time expression with the format "%f h" or "%f min" */
            this._timeInfo.label = _("Estimated time: %s").format(Utils.prettyTime(route.time));
            this._distanceInfo.label = Utils.prettyDistance(route.distance);
        }).bind(this));

        this._instructionList.connect('row-selected',(function(listbox, row) {
            if (row)
                this._mapView.showTurnPoint(row.turnPoint);
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
                                               'instruction-label',
                                               'distance-label']);
        ui.instructionLabel.label  = this.turnPoint.instruction;

        switch(this.turnPoint.type) {
        case Route.TurnPointType.START:
            ui.directionImage.icon_name = 'maps-point-start-symbolic';
            break;
        case Route.TurnPointType.END:
            ui.directionImage.icon_name = 'maps-point-end-symbolic';
            break;
        case Route.TurnPointType.VIA:
            ui.directionImage.icon_name = 'maps-point-end-symbolic';
            break;
        default:
            ui.directionImage.resource = this.turnPoint.iconResource;
            break;
        }

        if (this.turnPoint.distance > 0)
            ui.distanceLabel.label = Utils.prettyDistance(this.turnPoint.distance);

        this.add(ui.instructionBox);
    }
});
