/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2017, Marcus Lundblad
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

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {Application} from './application.js';
import * as HVT from './hvt.js';
import * as Time from './time.js';
import {TransitOptions} from './transitOptions.js';
import * as TransitPlan from './transitPlan.js';

const _timeFormat12 = new Intl.DateTimeFormat([], { hour:     '2-digit',
                                                  minute:   '2-digit',
                                                  hour12:   true });
const _timeFormat24 = new Intl.DateTimeFormat([], { hour:     '2-digit',
                                                  minute:   '2-digit',
                                                  hour12:   false });

export class TransitOptionsPanel extends Gtk.Grid {

    constructor(params) {
        super(params);
        this._query = Application.routeQuery;
        this._initTransitOptions();
    }

    reset() {
        /* reset to indicate departure now and forget any previous manually
         * set time and date
         */
        this._transitTimeOptionsDropDown.selected = 0;
        this._timeSelected = false;
        this._dateSelected = false;
        this._lastOptions = new TransitOptions();
    }

    _initTransitOptions() {
        this._transitTimeOptionsDropDown.connect('notify::selected',
            this._onTransitTimeOptionsDropDownSelected.bind(this));
        this._transitTimeEntry.connect('activate',
            this._onTransitTimeEntryActivated.bind(this));
        this._eventControllerFocus = new Gtk.EventControllerFocus();
        this._transitTimeEntry.add_controller(this._eventControllerFocus);
        /* trigger an update of the query time as soon as focus leave the time
         * entry, to allow the user to enter a time before selecting start
         * and destination without having to press enter */
        this._eventControllerFocus.connect('leave', () => {
            if (!this._query.isValid())
                this._onTransitTimeEntryActivated();
        });
        this._transitDateButton.popover.get_child().connect('day-selected',
            this._onTransitDateCalenderDaySelected.bind(this));
        this._transitDateButton.popover.connect('closed',
            this._onTransitDateClosed.bind(this));
        this._transitParametersMenuButton.popover.connect('closed',
            this._onTransitParametersClosed.bind(this))
    }

    _onTransitTimeOptionsDropDownSelected() {
        if (this._transitTimeOptionsDropDown.selected === 0) {
            this._transitTimeEntry.visible = false;
            this._transitDateButton.visible = false;
            this._query.arriveBy = false;
            this._query.date = null;
            this._query.time = null;
            this._timeSelected = null;
            this._dateSelected = null;
        } else {
            this._transitTimeEntry.visible = true;
            this._transitDateButton.visible = true;

            if (!this._timeSelected)
                this._transitTimeEntry.text =
                    (Time.is12Hour() ? _timeFormat12 : _timeFormat24).
                    format(new Date());

            if (!this._dateSelected)
                this._updateTransitDateButton(GLib.DateTime.new_now_local());

            if (this._transitTimeOptionsDropDown.selected === 2) {
                this._query.arriveBy = true;
            } else {
                this._query.arriveBy = false;
            }
        }
    }

    _onTransitTimeEntryActivated() {
        let timeString = this._transitTimeEntry.text;

        if (timeString && timeString.length > 0) {
            timeString = Time.parseTimeString(timeString);

            /* only trigger an update if a different time was entered */
            if (timeString && timeString !== this._timeSelected) {
                this._query.time = timeString;
                /* remember that the user has selected a time */
                this._timeSelected = timeString;
            }
        }
    }

    /**
     * Update the date select button with given date, and select the
     * corresponding day in the calendar shown when clicking the button.
     */
    _updateTransitDateButton(date) {
        let calendar = this._transitDateButton.popover.get_child();

        calendar.select_day(date);
        this._transitDateButton.label =
            /*
             * Translators: this is a format string giving the equivalent to
             * "may 29" according to the current locale's convensions.
             */
            date.format(C_("month-day-date", "%b %e"));
    }

    _onTransitDateCalenderDaySelected() {
        let calendar = this._transitDateButton.popover.get_child();
        let year = calendar.year;
        let month = calendar.month + 1;
        let day = calendar.day;
        let date = '%04d-%02d-%02d'.format(year, month, day);

        /* only trigger an update if a different date was selected */
        if (date !== this._dateSelected) {
            this._query.date = date;
            this._transitDateButton.active = false;
            this._updateTransitDateButton(GLib.DateTime.new_local(year, month, day,
                                                                  0, 0, 0));
            /* remember that the user has already selected a date */
            this._dateSelected = date;
        }
    }

    _onTransitDateClosed() {
        this._onTransitDateCalenderDaySelected();
    }

    _createTransitOptions() {
        let options = new TransitOptions();
        let busSelected = this._busCheckButton.active;
        let tramSelected = this._tramCheckButton.active;
        let trainSelected = this._trainCheckButton.active;
        let subwaySelected = this._subwayCheckButton.active;
        let ferrySelected = this._ferryCheckButton.active;
        let airplaneSelected = this._airplaneCheckButton.active;

        if (busSelected && tramSelected && trainSelected && subwaySelected &&
            ferrySelected && airplaneSelected) {
            options.showAllTransitTypes = true;
        } else {
            if (busSelected)
                options.addTransitType(TransitPlan.RouteType.BUS);
            if (tramSelected)
                options.addTransitType(TransitPlan.RouteType.TRAM);
            if (trainSelected)
                options.addTransitType(TransitPlan.RouteType.TRAIN);
            if (subwaySelected)
                options.addTransitType(TransitPlan.RouteType.SUBWAY);
            if (ferrySelected)
                options.addTransitType(TransitPlan.RouteType.FERRY);
            if (airplaneSelected)
                options.addTransitType(HVT.AIR_SERVICE);
        }

        return options;
    }

    _onTransitParametersClosed() {
        let options = this._createTransitOptions();

        if (!TransitOptions.equals(options, this._lastOptions)) {
            this._query.transitOptions = options;
            this._lastOptions = options;
        }
    }
 }

 GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/transit-options-panel.ui',
    InternalChildren: ['transitTimeOptionsDropDown',
                       'transitTimeEntry',
                       'transitDateButton',
                       'transitDateCalendar',
                       'transitParametersMenuButton',
                       'busCheckButton',
                       'tramCheckButton',
                       'trainCheckButton',
                       'subwayCheckButton',
                       'ferryCheckButton',
                       'airplaneCheckButton']
}, TransitOptionsPanel);
