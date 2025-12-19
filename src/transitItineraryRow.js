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

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {TransitRouteLabel} from './transitRouteLabel.js';

export class TransitItineraryRow extends Gtk.ListBoxRow {

    constructor({itinerary, ...params}) {
        super(params);

        this._itinerary = itinerary;
        this._timeLabel.label = this._itinerary.prettyPrintTimeInterval();
        this._durationLabel.label = this._itinerary.prettyPrintDuration();

        this._populateSummary();
    }

    get itinerary() {
        return this._itinerary;
    }

    _populateSummary() {
        const legs = this._itinerary.legs;
        for (let i = 0; i < legs.length; i++) {
            let legItem = this._createLeg(legs[i], i === legs.length - 1);
            this._summaryBox.append(legItem);
        }
    }

    _createLeg(leg, isLast) {
        let grid = new Gtk.Box({ visible: true, spacing: 6 });

        // All legs get an icon
        let icon = new Gtk.Image({ icon_name: leg.iconName, visible: true });
        icon.get_style_context().add_class('sidebar-icon');
        grid.append(icon);

        // Only transit legs get a label */
        if (leg.transit) {
            let routeLabel = new TransitRouteLabel({ leg: leg, visible: true});
            grid.append(routeLabel);
        }
        
        // If not the last leg, add a separator chevron
        if (!isLast) {
            let transitionIcon = new Gtk.Image({ 
                iconName: 'go-next-symbolic', 
                pixelSize: 8,
            });
            transitionIcon.get_style_context().add_class('dim-label');
            grid.append(transitionIcon);
        }

        return grid;
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/transit-itinerary-row.ui',
    InternalChildren: ['timeLabel',
                       'durationLabel',
                       'summaryBox']
}, TransitItineraryRow);
