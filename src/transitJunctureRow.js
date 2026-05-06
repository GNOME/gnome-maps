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

import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import Pango from 'gi://Pango';

import * as Time from './time.js';
import {TransitRouteLabel} from './transitRouteLabel.js';
import * as Transit from './transit/utils.js';
import * as Utils from './utils.js';

const _ = gettext.gettext;
const C_ = gettext.dgettext;

/* distance to consider a stop location to be a separate station from the
 * center point of the search
 */
const MIN_DISTANCE_ADJECENT_STAION = 150;

export class TransitJunctureRow extends Gtk.ListBoxRow {
    constructor({ juncture, place, ...params }) {
        super(params);

        this._juncture = juncture;
        this._place = place;
        this._modeImage.icon_name = juncture.route.iconName;
        this._route.set_child(new TransitRouteLabel({ route: juncture.route }));
        this._setDesignationImage();
        this._setDesignationLabel();
        this._setTimeLabels();
        this._updateStopLabel();
        this._setAgencyLink();

        this._expanded = false;

        this._buttonPressGesture = new Gtk.GestureSingle();
        this.add_controller(this._buttonPressGesture);
        this._buttonPressGesture.connect('begin', () => this._onPress());
    }

    _updateExpandArrow() {
        this._expandArrow.icon_name = this._expanded ? 'go-up-symbolic' :
                                                       'go-down-symbolic'

        // show expand/retract animation
        if (this._expanded) {
            this._expandArrow.remove_css_class('retract');
            this._expandArrow.add_css_class('expand');
        } else {
            this._expandArrow.remove_css_class('expand');
            this._expandArrow.add_css_class('retract');
        }

        // Translators: This is a tooltip
        this._expandArrow.tooltip_text =
            this._expanded ? _("Hide information") : _("Show information");
    }

    _onPress() {
        this._expanded = !this._expanded;
        this._updateExpandArrow();
        this._agencyRevealer.reveal_child = this._expanded;
    }

    _updateStopLabel() {
        const distance =
            this._juncture.place.location.get_distance_from(this._place.location) * 1000;
        const adjecentStation = distance > MIN_DISTANCE_ADJECENT_STAION;

         if (this._juncture.track !== this._juncture.scheduledTrack) {
            const attrs = new Pango.AttrList();
            const attr = Pango.attr_style_new(Pango.Style.ITALIC);

            attrs.insert(attr);
            this._stopLabel.set_attributes(attrs);
        }

        if (adjecentStation && this._juncture.track) {
            const trackIndication =
                Transit.getTrackIndication(this._juncture.track,
                                           this._juncture.route.routeType);
            const label = C_("Label showing departure/arrival track and adjecent station/stop name with distance",
                             "%1s, %2s (%3s)").format(trackIndication,
                                                      this._juncture.place.name,
                                                      Utils.prettyDistance(distance));

            this._stopLabel.label = label;
            this._stopLabel.visible = true;
        } else if (adjecentStation) {
            const label = C_("Label showing adjecent station/stop name with distance",
                             "%1s (%2s)").format(this._juncture.place.name,
                                                 Utils.prettyDistance(distance));

            this._stopLabel.label = label;
            this._stopLabel.visible = true;
        } else if (this._juncture.track) {
            this._stopLabel.label =
                Transit.getTrackIndication(this._juncture.track,
                                           this._juncture.route.routeType);
            this._stopLabel.visible = true;
        }
    }

    _setDesignationImage() {
        const isRTL = this.get_direction() === Gtk.TextDirection.RTL;

        this._designationImage.icon_name =
            !isRTL && this._juncture.isArrival ? 'arrow1-left-symbolic' :
                                                 'arrow1-right-symbolic';
    }

    _setDesignationLabel() {
        const label = this._juncture.designation;

        this._designationLabel.label =
            this._juncture.route.tripShortName &&
            this._juncture.route.tripShortName !== this._juncture.route.displayName
                ? `${label} • ${this._juncture.route.tripShortName}` : label;
    }

    _setTimeLabels() {
        this._timeLabel.label = Time.formatDateTime(this._juncture.time);

        if (!this._juncture.time.equal(this._juncture.scheduledTime)) {
            this._scheduledTImeLabel.visible = true;
            this._scheduledTimeLabel.label =
                `<s>${Time.formatDateTime(this._juncture.scheduledTime)}</s>`;
        }
    }

    _setAgencyLink() {
        // Agency link
        const agencyName =
            GLib.markup_escape_text(this._juncture.route.agencyName, -1);
        if (agencyName) {
            this._agencyLabel.visible = true;
        }
        if (this._juncture.route.agencyUrl) {
            let url = GLib.markup_escape_text(this._juncture.route.agencyUrl, -1);
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
}
GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/transit-juncture-row.ui',
    InternalChildren: ['modeImage',
                       'route',
                       'designationImage',
                       'designationLabel',
                       'timeLabel',
                       'scheduledTimeLabel',
                       'stopLabel',
                       'expandArrow',
                       'agencyRevealer',
                       'agencyLabel']
}, TransitJunctureRow);
