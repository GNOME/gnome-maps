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

const GObject = imports.gi.GObject;

const MapBubble = imports.mapBubble;
const Utils = imports.utils;

var UserLocationBubble = GObject.registerClass(
class UserLocationBubble extends MapBubble.MapBubble {

    _init(params) {
        let ui = Utils.getUIObject('user-location-bubble', [ 'grid-content',
                                                             'label-accuracy',
                                                             'label-coordinates' ]);
        params.buttons = MapBubble.Button.ROUTE |
                         MapBubble.Button.SEND_TO |
                         MapBubble.Button.CHECK_IN;
        params.routeFrom = true;
        params.checkInMatchPlace = false;

        super._init(params);

        this.image.icon_name = 'find-location-symbolic';
        this.image.pixel_size = 48;

        let accuracyDescription = Utils.getAccuracyDescription(this.place.location.accuracy);
        ui.labelAccuracy.label = ui.labelAccuracy.label.format(accuracyDescription);
        ui.labelCoordinates.label = this.place.location.latitude.toFixed(5)
                                  + ', '
                                  + this.place.location.longitude.toFixed(5);

        this.content.add(ui.gridContent);
    }
});
