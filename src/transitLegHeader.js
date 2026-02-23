/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2025 Jalen Ng
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
 * Author: Jalen Ng <jalen.dev@pm.me>
 */

import gettext from 'gettext';

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as Transit from './transit.js';
import {TransitRouteLabel} from './transitRouteLabel.js';

const _ = gettext.gettext;

export class TransitLegHeader extends Gtk.Grid {

    constructor({leg, canExpand, expanded, onPress, ...params}) {
        super(params);

        this._leg = leg;
        this._canExpand = canExpand;
        this.expanded = expanded;
        this._onPress = onPress;

        // Mode icon
        this._updateHeadsignImage();

        // Route label
        if (this._leg.transit) {
            const routeLabel = new TransitRouteLabel({ leg: this._leg });
            this._route.set_child(routeLabel);
        }

        // Headsign label
        if (!this._leg.transit || this._leg.headsign) {
            const label =
                GLib.markup_escape_text(Transit.getHeadsignLabel(this._leg), -1);

            /* show headsign and trip short name when it is available, and
             * differs from the route name (shown in the badge),
             * otherwise just show the headsign
             */
            this._headsignLabel.label =
                this._leg.tripShortName &&
                this._leg.tripShortName !== this._leg.route
                ? `<span size="small">${label} • ${this._leg.tripShortName}</span>`
                : `<span size="small">${label}</span>`;
        }
        
        this._updateExpandArrow();

        this._buttonPressGesture = new Gtk.GestureSingle();
        this.add_controller(this._buttonPressGesture);
        this._buttonPressGesture.connect('begin', () => this._onPress());

        this.connect('notify::expanded', this._updateExpandArrow.bind(this));
    }

    _updateHeadsignImage() {
        if (this._leg.transit) {
            this._modeImage.icon_name = this._leg.iconName;
            const isRTL = this.get_direction() === Gtk.TextDirection.RTL;
            this._headsignImage.icon_name = isRTL
                ? 'arrow1-left-symbolic'
                : 'arrow1-right-symbolic';
        }
        else {
            this._headsignImage.icon_name = this._leg.iconName;
        }
    }

    _updateExpandArrow() {
        this._expandArrow.visible = this._canExpand;

        this._expandArrow.icon_name = this.expanded 
            ? 'go-up-symbolic'
            : 'go-down-symbolic'

        // Translators: This is a tooltip
        this._expandArrow.tooltip_text =
            this.expanded ? (this._leg.transit ?
                                _("Hide intermediate stops and information") :
                                _("Hide walking instructions")) :
                               (this._leg.transit ?
                                _("Show intermediate stops and information") :
                                _("Show walking instructions"));
    }

    vfunc_direction_changed() {
        this._updateHeadsignImage();
    }

}

GObject.registerClass({
    Properties: {
        'expanded': GObject.ParamSpec.boolean('expanded',
                                              'Expanded',
                                              'Whether the transit leg contents are expanded',
                                              GObject.ParamFlags.READABLE |
                                              GObject.ParamFlags.WRITABLE,
                                              false
        )
    },
    Template: 'resource:///org/gnome/Maps/ui/transit-leg-header.ui',
    InternalChildren: ['modeImage',
                        'route',
                        'headsignImage',
                        'headsignLabel',
                        'expandArrow',
                        ]
}, TransitLegHeader);
