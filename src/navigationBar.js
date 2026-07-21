/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2026 Jan-Michael Brummer
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
 * Author: Jan-Michael Brummer <jan-michael.brummer@tabos.org>
 */

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as Utils from './utils.js';

export class NavigationBar extends Gtk.Box {

    constructor({navigator, ...params}) {
        super(params);

        this._navigator = navigator;

        this._navigator.connect('progress',
                                this._onProgress.bind(this));
        this._navigator.connect('rerouting',
                                this._onRerouting.bind(this));
        this._navigator.connect('started', this._onStarted.bind(this));

        this._onStarted();
    }

    _onStarted() {
        const turnPoint = this._navigator.nextTurnPoint;

        this._directionImage.icon_name = turnPoint?.iconName ||
                                         'maps-direction-continue-symbolic';
        this._distanceLabel.label = '';
        this._instructionLabel.label = turnPoint?.instruction ?? '';
        this._statusLabel.label = _("Waiting for position…");
    }

    _onProgress(navigator, nextIndex, distanceToNext,
                remainingDistance, remainingTime) {
        const turnPoint = navigator.nextTurnPoint;

        if (!turnPoint)
            return;

        this._directionImage.icon_name = turnPoint.iconName ||
                                         'maps-direction-continue-symbolic';
        this._distanceLabel.label =
            Utils.prettyDistance(Math.max(0, distanceToNext));
        this._instructionLabel.label = turnPoint.instruction ?? '';
        this._statusLabel.label =
            _("%s - %s").format(Utils.prettyDistance(remainingDistance),
                                Utils.prettyTime(remainingTime));
    }

    _onRerouting() {
        this._distanceLabel.label = '';
        this._instructionLabel.label = _("Recalculating route…");
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/navigation-bar.ui',
    InternalChildren: [ 'directionImage',
                        'distanceLabel',
                        'instructionLabel',
                        'statusLabel',
                        'stopButton' ]
}, NavigationBar);
