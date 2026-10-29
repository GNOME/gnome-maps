/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2026 Marcus Lundblad
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
 * Author: Marcus Lundblad <ml@dfupdate.se>
 */

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as Time from './time.js';

export class TransitItineraryHeader extends Gtk.Box {
    constructor({ itinerary, ...params }) {
        super(params);

        this._departure.label = Time.formatDateTime(itinerary.departure);
        this._arrival.label = Time.formatDateTime(itinerary.arrival);

        const departureTzOffset =
            Time.getTimezoneOffset(itinerary.departure,
                                   GLib.TimeZone.new_local());
        const arrivalTzOffset =
            Time.getTimezoneOffset(itinerary.arrival,
                                   GLib.TimeZone.new_local());

        if (departureTzOffset !== 0) {
            this._departureTz.visible = true;
            this._departureTz.label =
                Time.getTimezoneOffsetString(departureTzOffset);
        }

        if (arrivalTzOffset !== 0) {
            this._arrivalTz.visible = true;
            this._arrivalTz.label =
                Time.getTimezoneOffsetString(arrivalTzOffset);
        }

        this._duration.label = itinerary.prettyPrintDuration();

        this._direction.icon_name =
            this.get_direction() === Gtk.TextDirection.RTL ?
            'arrow1-left-symbolic' : 'arrow1-right-symbolic';
    }
};

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/transit-itinerary-header.ui',
    InternalChildren: ['departure',
                       'departureTz',
                       'arrival',
                       'arrivalTz',
                       'duration',
                       'direction']
}, TransitItineraryHeader);
