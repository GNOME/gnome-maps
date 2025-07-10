/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
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
 * Author: Jonas Danielsson <jonas@threetimestwo.org>
 */

import gettext from 'gettext';

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as Gfx from './gfx.js';
import {PlaceFormatter} from './placeFormatter.js';
import * as Utils from './utils.js';
import { Application } from './application.js';
import {lookupType} from './osmTypes.js';

const C_ = gettext.dgettext;

/*
 * Lower threashold when only showing a "less than distance" for POIs
 * relative the view center
 */
const SHORT_DISTANCE_THREASHOLD_METRIC = 100;
const SHORT_DISTANCE_THREASHOLD_IMPERIAL = 91.44; // 300 ft (300 * 12 * 0.0254 m)

/*
 * Translators: This a format string for showing a distance to a place
 * is lower than a "quite short" distance.
 * The "less than" symbol can be substituded with an appropriate one, if
 * needed (e.g. using the correct direction, or alternative symbol).
 * The %s should be kept, and is substituted with a label representing the
 * short distance. The \u2009 (thin space) could also be adjusted if needed */
const SHORT_DISTANCE_FORMAT = C_("short distance format string", "< %s");

export class PlaceListRow extends Gtk.ListBoxRow {

    constructor({place, searchString, sizeGroup, showSecondaryIcon, ...params}) {
        super(params);

        this.update(place, searchString || '');
        if (sizeGroup)
            sizeGroup.add_widget(this._distanceLabel);

        this._showSecondaryIcon = showSecondaryIcon ?? true;
    }

    /**
     * @param {Place} place
     * @param {string} searchString
     */
    update(place, searchString) {
        this.place = place;
        const formatter = new PlaceFormatter(this.place);
        const title = formatter.title ?? place.streetAddress ??
                      lookupType(this.place.osmKey, this.place.osmValue) ??
                      _("Unnamed place");
        const markup = GLib.markup_escape_text(title, -1);

        this._name.label = this._boldMatch(markup, searchString);
        this._details.label = GLib.markup_escape_text(formatter.getDetailsString(),-1);
        this._details.visible = this._details.label.length > 0;

        const shieldPaintables =
            Gfx.drawShieldsForPlace(place, 1, this.get_scale_factor());

        if (shieldPaintables.length > 0)
            this._icon.paintable = shieldPaintables[0];
        else if (place.icon)
            this._icon.gicon = place.icon;

        const placeItem = Application.placeStore.getPlaceItem(place);
        if (placeItem && this._showSecondaryIcon) {
            this._typeIcon.show();
            this._typeIcon.icon_name = placeItem.isFavorite
                ? 'starred-symbolic'
                : 'document-open-recent-symbolic';
        } else {
            this._typeIcon.hide();
        }

        /* hide distance by default so that a previous content from a POI
         * search doesn't keep the distance when updating with a new search
         * result
         */
        this._distanceLabel.visible = false;
    }

    setDistanceFrom(location) {
        let distance = this.place.location.get_distance_from(location) * 1000;
        let label;

        if (Utils.shouldShowImperialUnits() &&
            distance < SHORT_DISTANCE_THREASHOLD_IMPERIAL) {
            const prettyDistance =
                Utils.prettyDistance(SHORT_DISTANCE_THREASHOLD_IMPERIAL);

            label = SHORT_DISTANCE_FORMAT.format(prettyDistance);
        } else if (!Utils.shouldShowImperialUnits() &&
                   distance < SHORT_DISTANCE_THREASHOLD_METRIC) {
            const prettyDistance =
                Utils.prettyDistance(SHORT_DISTANCE_THREASHOLD_METRIC);

            label = SHORT_DISTANCE_FORMAT.format(prettyDistance);
        } else {
            label = Utils.prettyDistance(distance);
        }

        this._distanceLabel.label = label;
        this._distanceLabel.visible = true;
    }

    _boldMatch(title, string) {
        let canonicalString = Utils.normalizeString(string).toLowerCase();
        let canonicalTitle = Utils.normalizeString(title).toLowerCase();

        let index = canonicalTitle.indexOf(canonicalString);

        if (index !== -1) {
            let substring = title.substring(index, index + string.length);
            title = title.replace(substring, substring.bold());
        }
        return title;
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/place-list-row.ui',
    InternalChildren: [ 'icon',
                        'name',
                        'details',
                        'distanceLabel',
                        'typeIcon' ],
}, PlaceListRow);
