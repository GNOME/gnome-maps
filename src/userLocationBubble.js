/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2014 Damián Nohales
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
 * Author: Damián Nohales <damiannohales@gmail.com>
 */

const _ = imports.gettext.gettext;

const GObject = imports.gi.GObject;

const MapBubble = imports.mapBubble;
const Utils = imports.utils;

var UserLocationBubble = GObject.registerClass(
class UserLocationBubble extends MapBubble.MapBubble {

    _init(params) {
        this._ui = Utils.getUIObject('user-location-bubble', [ 'content',
                                                               'label-accuracy',
                                                               'label-coordinates' ]);
        params.buttons = MapBubble.Button.SEND_TO |
                         MapBubble.Button.CHECK_IN;

        super._init(params);

        this.updateLocation();
        this.content.add(this._ui.content);
    }

    updateLocation() {
        /* Called by the UserLocationMarker when its location changes */

        let accuracyDescription = Utils.getAccuracyDescription(this.place.location.accuracy);
        /* Translators: %s can be "Unknown", "Exact" or "%f km" (or ft/mi/m) */
        this._ui.labelAccuracy.label = _("Accuracy: %s").format(accuracyDescription);
        this._ui.labelCoordinates.label = this.place.location.latitude.toFixed(5)
                                          + ', '
                                          + this.place.location.longitude.toFixed(5);
    }
});
