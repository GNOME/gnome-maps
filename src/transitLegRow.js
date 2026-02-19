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

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Gsk from 'gi://Gsk';
import Pango from 'gi://Pango';

import {InstructionRow} from './instructionRow.js';
import { Stop } from './transitPlan.js';
import {TransitStopRow} from './transitStopRow.js';
import { TransitLegHeader } from './transitLegHeader.js';
import { TransitRowTrackSegment } from './transitRowTrackSegment.js';

export class TransitLegRow extends Gtk.ListBoxRow {

    constructor({leg, mapView, direct, ...params}) {
        super(params);

        this._leg = leg;
        this._mapView = mapView;
        this._direct = direct;

        // Header
        this._header = new TransitLegHeader({
            leg: this._leg, 
            canExpand: !this._direct && this._hasIntructions(),
            expanded: this._direct,
            onPress: this._onPressHeader.bind(this)
        });
        this._headerContainer.set_child(this._header);

        if (this._leg.transit) {
            // From
            const fromStop = new Stop({
                name: this._leg.from.name,
                departure: this._leg.departure,
                location: this._leg.from.location,
                id: this._leg.from.id,
                modes: this._leg.from.modes
            });
            const fromStopRow = new TransitStopRow({
                stop: fromStop, 
                isHead: true,
                colors: {
                    line: this._leg.color,
                    stop: this._leg.textColor
                },
                final: false
            });
            this._beforeInstructionList.append(fromStopRow);

            // To
            const toStop = new Stop({
                name: this._leg.to.name,
                arrival: this._leg.arrival,
                location: this._leg.to.location,
                id: this._leg.to.id,
                modes: this._leg.to.modes
            });
            const toStopRow = new TransitStopRow({
                stop: toStop, 
                isTail: true,
                colors: {
                    line: this._leg.color,
                    stop: this._leg.textColor
                },
                final: true,
                marginBottom: 12
            });
            this._afterInstructionList.append(toStopRow);

            // Agency link
            const agencyName = GLib.markup_escape_text(this._leg.agencyName, -1);
            if (agencyName) {
                this._agencyLabel.visible = true;
            }
            if (this._leg.agencyUrl) {
                let url = GLib.markup_escape_text(this._leg.agencyUrl, -1);
                /* we need to double-escape the tooltip text, as GTK+ treats it as
                 * markup
                 */
                let tooltip = GLib.markup_escape_text(url, -1);
                this._agencyLabel.label =
                    '<a href="%s" title="%s">%s</a>'.format(url, tooltip,
                                                            agencyName);
            } else {
                this._agencyLabel.label = agencyName;
            }
            
        }
        else {
            const line = new TransitRowTrackSegment({
                isWalk: true,
            });
            this._trackSegmentContainer.set_child(line);
        }

        // always expand direct (e.g. walking) trips
        if (direct) {
            this._setExpanded(true);
        } else {
            this._setExpanded(false);
        }

        if (this._hasIntructions())
            this._populateInstructions();

        // Add selection handling to the list row
        const lists = [
            this._beforeInstructionList,
            this._instructionList,
            this._afterInstructionList
        ];
        lists.forEach(list => {
            list.connect('row-selected', (listbox, row) => {                
                if (row) {
                    // When a list row is selected, unselect from other lists
                    const otherLists = lists.filter(l => l !== list);
                    for (let list of otherLists) {
                        list.unselect_all();
                    }
                    // Show the selected row on the map
                    if (row.turnPoint)
                        this._mapView.showTurnPoint(row.turnPoint);
                    else
                        this._mapView.showTransitStop(row.stop, this._leg);
                }
            });
        });
    }

    _onPressHeader() {
        if (this._expanded && !this._direct) {
            this._setExpanded(false);
        } else {
            this._mapView.map.go_to_full(this._leg.from.location.latitude,
                                         this._leg.from.location.longitude,
                                         16);
            if (this._hasIntructions())
                this._setExpanded(true);
        }
    }

    _setExpanded(expanded) {
        this._instructionRevealer.reveal_child = expanded;
        this._agencyRevealer.reveal_child = expanded;
        this._header.expanded = expanded;
        if (expanded)
            this.set_state_flags(Gtk.StateFlags.CHECKED, false);
        else
            this.unset_state_flags(Gtk.StateFlags.CHECKED);

        this._expanded = expanded;
        this.update_state([Gtk.AccessibleState.EXPANDED], [expanded ? 1 : 0]);
    }

    vfunc_activate() {
        this._onPressHeader();
        super.vfunc_activate();
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
                    let row = new TransitStopRow({ 
                        stop: stop,
                        colors: {
                            line: this._leg.color,
                            stop: this._leg.textColor
                        },
                        final: index === stops.length - 1 
                    });
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
                let row = new InstructionRow({ turnPoint: instruction });
                row.set_margin_start(32);

                this._instructionList.insert(row, -1);
            }
        }
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/transit-leg-row.ui',
    InternalChildren: ['headerContainer',
                       'trackSegmentContainer',
                       'beforeInstructionRevealer',
                       'instructionRevealer',
                       'afterInstructionRevealer',
                       'beforeInstructionList',
                       'instructionList',
                       'afterInstructionList',
                       'agencyRevealer',
                       'agencyLabel',
                       'afterInstructionRevealer',
                       'grid']
}, TransitLegRow);
