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

const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const _ = imports.gettext.gettext;

const Application = imports.application;
const PlaceEntry = imports.placeEntry;
const RouteQuery = imports.routeQuery;
const Utils = imports.utils;

const InstructionRow = new Lang.Class({
    Name: "InstructionRow",
    Extends: Gtk.ListBoxRow,
    Template: 'resource:///org/gnome/maps/sidebar-instruction-row.ui',
    InternalChildren: [ 'directionImage',
                        'instructionLabel',
                        'distanceLabel' ],

    _init: function(params) {
        this.turnPoint = params.turnPoint;
        delete params.turnPoint;

        this.parent(params);

        this._instructionLabel.label = this.turnPoint.instruction;
        this._directionImage.icon_name = this.turnPoint.iconName;

        if (this.turnPoint.distance > 0)
            this._distanceLabel.label = Utils.prettyDistance(this.turnPoint.distance);
    }
});

const Sidebar = new Lang.Class({
    Name: 'Sidebar',
    Extends: Gtk.Revealer,
    Template: 'resource:///org/gnome/maps/sidebar.ui',
    InternalChildren: [ 'viaGridContainer',
                        'instructionListScrolled',
                        'instructionStack',
                        'instructionSpinner',
                        'instructionList',
                        'modePedestrianToggle',
                        'modeBikeToggle',
                        'modeCarToggle',
                        'timeInfo',
                        'distanceInfo',
                        'fromEntryGrid',
                        'toEntryGrid',
                        'viaAddButton' ],

    _init: function(mapView) {
        this.parent();

        this._mapView = mapView;

        this._initInstructionList();
        this._initTransportationToggles();

        let query = Application.routeService.query;

        query.addPoint(0);
        let fromEntry = this._initRouteEntry(this._fromEntryGrid, 0);

        query.addPoint(1);
        this._initRouteEntry(this._toEntryGrid, 1);

        this._initQuerySignals(this._viaGridContainer);

        this.bind_property('child-revealed',
                           fromEntry, 'has_focus',
                           GObject.BindingFlags.DEFAULT);

        this._viaAddButton.connect('clicked', (function() {
            query.addPoint(-1);
        }).bind(this));
    },

    _initTransportationToggles: function() {
        let query = Application.routeService.query;
        let transport = RouteQuery.Transportation;

        let onToggle = function(mode, button) {
            if (button.active && query.transportation !== mode)
                query.transportation = mode;
        };
        this._modePedestrianToggle.connect('toggled',
                                           onToggle.bind(this, transport.PEDESTRIAN));
        this._modeCarToggle.connect('toggled',
                                    onToggle.bind(this, transport.CAR));
        this._modeBikeToggle.connect('toggled',
                                     onToggle.bind(this, transport.BIKE));

        this._syncTransportationToggles();
        query.connect('notify::transportation',
                      this._syncTransportationToggles.bind(this));
    },

    _syncTransportationToggles: function() {
        switch(Application.routeService.query.transportation) {
        case RouteQuery.Transportation.PEDESTRIAN:
            this._modePedestrianToggle.active = true;
            break;
        case RouteQuery.Transportation.CAR:
            this._modeCarToggle.active = true;
            break;
        case RouteQuery.Transportation.BIKE:
            this._modeBikeToggle.active = true;
            break;
        }
    },

    _initQuerySignals: function(listbox) {
        let query = Application.routeService.query;

        // Do nothing for the From and To points.
        query.connect('point-added', (function(obj, point, index) {
            if (index !== 0 && index !== query.points.length - 1)
                this._createViaRow(listbox, index);
        }).bind(this));

        query.connect('point-removed', (function(obj, point, index) {
            let row = listbox.get_row_at_index(index - 1);
            row.destroy();
        }).bind(this));
    },

    _createPlaceEntry: function() {
        return new PlaceEntry.PlaceEntry({ visible: true,
                                           can_focus: true,
                                           hexpand: true,
                                           receives_default: true,
                                           mapView: this._mapView,
                                           parseOnFocusOut: true });
    },

    _createViaRow: function(listbox, index) {
        let ui = Utils.getUIObject('route-via-row', [ 'via-grid',
                                                      'via-remove-button',
                                                      'via-entry-grid' ]);
        let insertIndex = index - 1;
        let entry = this._createPlaceEntry();

        this._initRouteEntry(ui.viaEntryGrid, index);
        listbox.insert(ui.viaGrid, insertIndex);

        ui.viaRemoveButton.connect('clicked', function() {
            let row = ui.viaGrid.get_parent();
            let pointIndex = row.get_index();
            Application.routeService.query.removePoint(pointIndex + 1);
        });
    },

    _initRouteEntry: function(container, pointIndex) {
        let entry = this._createPlaceEntry();
        container.add(entry);

        let point = Application.routeService.query.points[pointIndex];
        entry.bind_property('place',
                            point, 'place',
                            GObject.BindingFlags.BIDIRECTIONAL);

        return entry;
    },

    _initInstructionList: function() {
        let route = Application.routeService.route;
        let query = Application.routeService.query;

        route.connect('reset', (function() {
            this._clearInstructions();
            this._instructionStack.visible_child = this._instructionListScrolled;
            this._viaGridContainer.get_children().forEach((function(row) {
                query.removePoint(row.get_index() + 1);
            }).bind(this));
        }).bind(this));

        query.connect('notify', (function() {
            if (query.isValid())
                this._instructionStack.visible_child = this._instructionSpinner;
            else
                this._clearInstructions();
        }).bind(this));

        route.connect('update', (function() {
            this._clearInstructions();
            this._instructionStack.visible_child = this._instructionListScrolled;

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

        this._timeInfo.label = '';
        this._distanceInfo.label = '';
    }
});
