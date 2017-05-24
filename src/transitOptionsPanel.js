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

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Application = imports.application;
const Time = imports.time;
const TransitOptions = imports.transitOptions;
const TransitPlan = imports.transitPlan;

// in org.gnome.desktop.interface
const CLOCK_FORMAT_KEY = 'clock-format';

let _desktopSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
let clockFormat = _desktopSettings.get_string(CLOCK_FORMAT_KEY);

const TransitOptionsPanel = new Lang.Class({
    Name: 'TransitOptionsPanel',
    Extends: Gtk.Grid,
    Template: 'resource:///org/gnome/Maps/ui/transit-options-panel.ui',
    InternalChildren: ['transitTimeOptionsComboBox',
                       'transitTimeEntry',
                       'transitDateButton',
                       'transitDateCalendar',
                       'transitParametersMenuButton',
                       'busCheckButton',
                       'tramCheckButton',
                       'trainCheckButton',
                       'subwayCheckButton',
                       'ferryCheckButton'],

    _init: function(params) {
        this._query = Application.routeQuery;
        this.parent(params);
        this._initTransitOptions();
    },

    reset: function() {
        /* reset to indicate departure now and forget any previous manually
         * set time and date
         */
        this._transitTimeOptionsComboBox.active_id = 'leaveNow';
        this._timeSelected = false;
        this._dateSelected = false;
        this._lastOptions = new TransitOptions.TransitOptions();
    },

    _initTransitOptions: function() {
        this._transitTimeOptionsComboBox.connect('changed',
            this._onTransitTimeOptionsComboboxChanged.bind(this));
        this._transitTimeEntry.connect('activate',
            this._onTransitTimeEntryActivated.bind(this));
        /* trigger an update of the query time as soon as focus leave the time
         * entry, to allow the user to enter a time before selecting start
         * and destination without having to press enter */
        this._transitTimeEntry.connect('focus-out-event',
            this._onTransitTimeEntryActivated.bind(this));
        this._transitDateButton.popover.get_child().connect('day-selected-double-click',
            this._onTransitDateCalenderDaySelected.bind(this));
        this._transitDateButton.connect('toggled',
            this._onTransitDateButtonToogled.bind(this));
        this._transitParametersMenuButton.connect('toggled',
            this._onTransitParametersToggled.bind(this))
    },

    _onTransitTimeOptionsComboboxChanged: function() {
        if (this._transitTimeOptionsComboBox.active_id === 'leaveNow') {
            this._transitTimeEntry.visible = false;
            this._transitDateButton.visible = false;
            this._query.arriveBy = false;
            this._query.time = null;
            this._query.date = null;
            this._timeSelected = null;
            this._dateSelected = null;
        } else {
            this._transitTimeEntry.visible = true;
            this._transitDateButton.visible = true;

            if (!this._timeSelected)
                this._updateTransitTimeEntry(GLib.DateTime.new_now_local());

            if (!this._dateSelected)
                this._updateTransitDateButton(GLib.DateTime.new_now_local());

            if (this._transitTimeOptionsComboBox.active_id === 'arriveBy') {
                this._query.arriveBy = true;
            } else {
                this._query.arriveBy = false;
            }
        }
    },

    _updateTransitTimeEntry: function(time) {
        if (clockFormat === '24h')
            this._transitTimeEntry.text = time.format('%R');
        else
            this._transitTimeEntry.text = time.format('%r');
    },

    _onTransitTimeEntryActivated: function() {
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
    },

    _updateTransitDateButton: function(date) {
        this._transitDateButton.label =
            /*
             * Translators: this is a format string giving the equivalent to
             * "may 29" according to the current locale's convensions.
             */
            date.format(C_("month-day-date", "%b %e"));
    },

    _onTransitDateCalenderDaySelected: function() {
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
    },

    _onTransitDateButtonToogled: function() {
        if (!this._transitDateButton.active)
            this._onTransitDateCalenderDaySelected();
    },

    _createTransitOptions: function() {
        let options = new TransitOptions.TransitOptions();
        let busSelected = this._busCheckButton.active;
        let tramSelected = this._tramCheckButton.active;
        let trainSelected = this._trainCheckButton.active;
      let subwaySelected = this._subwayCheckButton.active;
        let ferrySelected = this._ferryCheckButton.active;

        if (busSelected && tramSelected && trainSelected && subwaySelected &&
            ferrySelected) {
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
        }

        return options;
    },

    _onTransitParametersToggled: function() {
        if (!this._transitParametersMenuButton.active) {
            let options = this._createTransitOptions();

            if (!TransitOptions.equals(options, this._lastOptions)) {
                this._query.transitOptions = options;
                this._lastOptions = options;
            }
        }
    }
 });
