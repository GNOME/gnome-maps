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

import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as Transit from './transit.js';

export class TransitArrivalRow extends Gtk.ListBoxRow {

    constructor(params) {
        let itinerary = params.itinerary;
        delete params.itinerary;

        let mapView = params.mapView;
        delete params.mapView;

        super(params);
        let lastLeg = itinerary.legs[itinerary.legs.length - 1];

        this._mapView = mapView;
        this._arrivalLabel.label = Transit.getArrivalLabel(lastLeg);
        this._timeLabel.label = lastLeg.prettyPrintArrivalTime();

        this._eventBox.connect('event', (widget, event) => {
            this._onEvent(event, lastLeg.toCoordinate);
            return true;
        });
    }

    _onEvent(event, coord) {
        let [isButton, button] = event.get_button();
        let type = event.get_event_type();

        if (isButton && button === 1 && type === Gdk.EventType.BUTTON_PRESS) {
            this._mapView.view.zoom_level = 16;
            this._mapView.view.center_on(coord[0], coord[1]);
        }
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/transit-arrival-row.ui',
    InternalChildren: ['arrivalLabel',
                       'timeLabel',
                       'eventBox',
                       'separator']
}, TransitArrivalRow);
