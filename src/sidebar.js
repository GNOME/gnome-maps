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
const RouteEntry = imports.routeEntry;
const RouteQuery = imports.routeQuery;
const Utils = imports.utils;

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
        ui.instructionLabel.label = this.turnPoint.instruction;
        ui.directionImage.icon_name = this.turnPoint.iconName;

        if (this.turnPoint.distance > 0)
            ui.distanceLabel.label = Utils.prettyDistance(this.turnPoint.distance);

        this.add(ui.instructionBox);
    }
});

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
                                                'entry-list',
                                                'instruction-list-scrolled',
                                                'instruction-stack',
                                                'instruction-spinner',
                                                'instruction-list',
                                                'mode-pedestrian-toggle',
                                                'mode-bike-toggle',
                                                'mode-car-toggle',
                                                'time-info',
                                                'distance-info' ]);

        this._mapView = mapView;
        this._entryList = ui.entryList;
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
        this._initQuerySignals();

        let query = Application.routeService.query;

        query.addPoint(0);
        query.addPoint(1);

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

        let setToggles = function() {
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
        };

        setToggles();
        query.connect('notify::transportation', setToggles);
    },

    _initQuerySignals: function() {
        let query = Application.routeService.query;

        query.connect('point-added', (function(obj, point, index) {
            this._createRouteEntry(index, point);
        }).bind(this));

        query.connect('point-removed', (function(obj, point, index) {
            let row = this._entryList.get_row_at_index(index);
            row.destroy();
        }).bind(this));
    },

    _createRouteEntry: function(index, point) {
        let type;
        if (index === 0)
            type = RouteEntry.Type.FROM;
        else if (index === this._entryList.get_children().length)
            type = RouteEntry.Type.TO;
        else
            type = RouteEntry.Type.VIA;

        let routeEntry = new RouteEntry.RouteEntry({ type: type,
                                                     point: point,
                                                     mapView: this._mapView });
        this._entryList.insert(routeEntry, index);

        if (type === RouteEntry.Type.FROM) {
            routeEntry.button.connect('clicked', (function() {
                let lastIndex = this._entryList.get_children().length;
                Application.routeService.query.addPoint(lastIndex - 1);
            }).bind(this));

            this.bind_property('child-revealed',
                               routeEntry.entry, 'has_focus',
                               GObject.BindingFlags.DEFAULT);
        } else if (type === RouteEntry.Type.VIA) {
            routeEntry.button.connect('clicked', function() {
                let row = routeEntry.get_parent();
                Application.routeService.query.removePoint(row.get_index());
            });
        }
    },

    _initInstructionList: function() {
        let route = Application.routeService.route;
        let query = Application.routeService.query;

        route.connect('reset', (function() {
            this._clearInstructions();
            this._instructionStack.visible_child = this._instructionWindow;

            let length = this._entryList.get_children().length;
            for (let index = 1; index < (length - 1); index++) {
                query.removePoint(index);
            }
        }).bind(this));

        query.connect('notify', (function() {
            if (query.isValid())
                this._instructionStack.visible_child = this._instructionSpinner;
            else
                this._clearInstructions();
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

        this._timeInfo.label = '';
        this._distanceInfo.label = '';
    }
});
