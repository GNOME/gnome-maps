/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2017 Marcus Lundblad
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

import gettext from 'gettext';

import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Pango from 'gi://Pango';

import {InstructionRow} from './instructionRow.js';
import * as Transit from './transit.js';
import {TransitRouteLabel} from './transitRouteLabel.js';
import {TransitStopRow} from './transitStopRow.js';
import * as Utils from './utils.js';

const _ = gettext.gettext;

export class TransitLegRow extends Gtk.ListBoxRow {

    constructor({leg, start, mapView, ...params}) {
        super(params);

        this._leg = leg;
        this._start = start;
        this._mapView = mapView;
        this._modeImage.icon_name = this._leg.iconName;
        this._fromLabel.label = Transit.getFromLabel(this._leg, this._start);

        if (this._leg.transit) {
            let routeLabel = new TransitRouteLabel({ leg: this._leg });

            this._routeGrid.attach(routeLabel, 0, 0, 1, 1);

            this._agencyLabel.visible = true;

            if (this._leg.agencyUrl) {
                let url = GLib.markup_escape_text(this._leg.agencyUrl, -1);
                /* we need to double-escape the tooltip text, as GTK+ treats it as
                 * markup
                 */
                let tooltip = GLib.markup_escape_text(url, -1);
                this._agencyLabel.label =
                    '<a href="%s" title="%s">%s</a>'.format(url, tooltip,
                                                            this._leg.agencyName);
            } else {
                this._agencyLabel.label = this._leg.agencyName;
            }
        } else {
            this._expandButton.tooltip_text = _("Show walking instructions");
            this._collapsButton.tooltip_text = _("Hide walking instructions");
        }

        if (!this._leg.transit || this._leg.headsign) {
            /* Restrict headsign label to 20 characters to avoid horizontally
             * overflowing the sidebar.
             */
            let headsignLabel = new Gtk.Label({ visible: true,
                                                can_focus: false,
                                                use_markup: true,
                                                hexpand: true,
                                                margin_start: 3,
                                                max_width_chars: 20,
                                                ellipsize: Pango.EllipsizeMode.END,
                                                halign: Gtk.Align.START });
            let label =
                GLib.markup_escape_text(Transit.getHeadsignLabel(this._leg), -1);

            headsignLabel.label = '<span size="small">%s</span>'.format(label);
            headsignLabel.get_style_context().add_class('dim-label');
            this._routeGrid.attach(headsignLabel, this._leg.transit ? 1 : 0, 0,
                                   1, 1);
        }

        this._timeLabel.label = this._leg.prettyPrintTime({ isStart: this._start });

        if (this._hasIntructions())
            this._populateInstructions();
        else
            this._footerStack.visible_child_name = 'separator';

        this._expandButton.connect('clicked', this._expand.bind(this));
        this._collapsButton.connect('clicked', this._collaps.bind(this));

        this._instructionList.connect('row-selected', (listbox, row) => {
            if (row) {
                if (row.turnPoint)
                    this._mapView.showTurnPoint(row.turnPoint);
                else
                    this._mapView.showTransitStop(row.stop, this._leg);
            }
        });

        this._buttonPressGesture = new Gtk.GestureSingle();
        this._grid.add_controller(this._buttonPressGesture);
        this._buttonPressGesture.connect('begin', () => this._onPress());

        this._isExpanded = false;
    }

    _onPress() {
        if (this._isExpanded) {
            this._collaps();
        } else {
            /*
             * WORKAROUND!!!!
             *
             * For now disable the animation to prevent getting
             * throttled by the tile server:
             * https://gitlab.gnome.org/GNOME/gnome-maps/-/issues/546
             */
            this._mapView.map.center_on(this._leg.fromCoordinate[0],
                                        this._leg.fromCoordinate[1]);
            this._mapView.map.viewport.zoom_level = 16;

            /*
            this._mapView.map.go_to_full(this._leg.fromCoordinate[0],
                                         this._leg.fromCoordinate[1],
                                         16);
            */
            if (this._hasIntructions())
                this._expand();
        }
    }

    _expand() {
        this._footerStack.visible_child_name = 'separator';
        this._detailsRevealer.reveal_child = true;
        /* collaps the time label down to just show the start time when
         * revealing intermediate stop times, as the arrival time is displayed
         * at the last stop
         */
        this._timeLabel.label = this._leg.prettyPrintDepartureTime();
        this._isExpanded = true;
    }

    _collaps() {
        this._footerStack.visible_child_name = 'expander';
        this._detailsRevealer.reveal_child = false;
        this._timeLabel.label = this._leg.prettyPrintTime({ isStart: this._start });
        this._isExpanded = false;
    }

    _hasIntructions() {
        return this._leg.transit || this._leg.walkingInstructions;
    }

    _populateInstructions() {
        if (this._leg.transit) {
            if (this._leg.intermediateStops) {
                let stops = this._leg.intermediateStops;
                for (let index = 0; index < stops.length; index++) {
                    let stop = stops[index];
                    let row = new TransitStopRow({ visible: true,
                                                   stop: stop,
                                                   final: index === stops.length - 1 });
                    this._instructionList.insert(row, -1);
                }
            }
        } else {
            /* don't output the starting and ending instructions from the walk
             * route, since these are explicitly added by the itinerary
             */
            for (let index = 1;
                 index < this._leg.walkingInstructions.length - 1;
                 index++) {
                let instruction = this._leg.walkingInstructions[index];
                let row = new InstructionRow({ visible: true,
                                               turnPoint: instruction });

                this._instructionList.insert(row, -1);
            }
        }
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/transit-leg-row.ui',
    InternalChildren: ['modeImage',
                       'fromLabel',
                       'routeGrid',
                       'timeLabel',
                       'footerStack',
                       'expandButton',
                       'detailsRevealer',
                       'agencyLabel',
                       'collapsButton',
                       'instructionList',
                       'grid']
}, TransitLegRow);
