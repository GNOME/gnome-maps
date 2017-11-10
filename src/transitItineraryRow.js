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

const Lang = imports.lang;

const Gtk = imports.gi.Gtk;

const TransitRouteLabel = imports.transitRouteLabel;

var TransitItineraryRow = new Lang.Class({
    Name: 'TransitItineraryRow',
    Extends: Gtk.ListBoxRow,
    Template: 'resource:///org/gnome/Maps/ui/transit-itinerary-row.ui',
    InternalChildren: ['timeLabel',
                       'durationLabel',
                       'summaryGrid'],

    _init: function(params) {
        this._itinerary = params.itinerary;
        delete params.itinerary;

        this.parent(params);

        this._timeLabel.label = this._itinerary.prettyPrintTimeInterval();
        this._durationLabel.label = this._itinerary.prettyPrintDuration();

        this._populateSummary();
    },

    get itinerary() {
        return this._itinerary;
    },

    _populateSummary: function() {
        let length = this._itinerary.legs.length;
        /* use compacted route labels when more than 2 legs, to avoid
         * overflowing the sidebar width
         */
        let useCompact = length > 2;
        /* don't show the route labels if too much space is consumed,
         * the constant 28 here was empiracally tested out...
         */
        let estimatedSpace = this._calculateEstimatedSpace();
        let useContractedLabels = estimatedSpace > 28;

        this._itinerary.legs.forEach((leg, i) => {
            this._summaryGrid.add(this._createLeg(leg, useCompact,
                                                  useContractedLabels));
            if (i !== length - 1)
                this._summaryGrid.add(new Gtk.Label({ visible: true,
                                                      label: '-' }));
        });
    },

    /* calculate an estimated relative space-consuption for rendering,
     * this is done based on route label character lengths and a fixed
     * "placeholder" amount for mode icons and separators, since doing an
     * exact pixel-correct calculation would be hard depeding on fonts and
     * themes
     */
    _calculateEstimatedSpace: function() {
        let length = this._itinerary.legs.length;
        /* assume mode icons and the separators consume about twice the space of
         * characters
         */
        let space = 4 * length - 2;

        this._itinerary.legs.forEach(function(leg) {
            if (leg.transit)
                space += leg.compactRoute.length;
        });

        return space;
    },

    _createLeg: function(leg, useCompact, useContractedLabels) {
        let icon = new Gtk.Image({ icon_name: leg.iconName, visible: true });

        icon.get_style_context().add_class('sidebar-icon');

        if (!leg.transit || useContractedLabels) {
            /* if this is a non-transit leg (walking), or in case we should
             * display only a mode icon (to save space), insert a sole icon */
            return icon;
        } else {
            /* for transit legs put besides a short route label */
            let grid = new Gtk.Grid({ visible: true, column_spacing: 2 });

            grid.attach(icon, 0, 0, 1, 1);
            grid.attach(new TransitRouteLabel.TransitRouteLabel({ leg: leg,
                                                                  compact: useCompact,
                                                                  visible: true }),
                        1, 0, 1, 1);

            return grid;
        }
    }
});
