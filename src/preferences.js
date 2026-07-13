/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2023 James Westman
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
 * with GNOME Maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: James Westman <james@jwestman.net>
 */

import GObject from "gi://GObject";
import Adw from "gi://Adw";

import {Application} from './application.js';
import "./preferencesDownloads.js";

export class PreferencesDialog extends Adw.PreferencesDialog {

    constructor(params) {
        super(params);

        Application.settings.connect('changed::measurement-system',
                                     () => this._measurementSystemChanged());
        this._measurementSystemChanged();
        this._measurementRow.connect('notify::selected',
                                     () => this._onMeasurementSystemSelected());
    }

    _measurementSystemChanged() {
        const measurementSystem = Application.settings.get('measurement-system');

        this._measurementRow.selected =
            measurementSystem === 'metric' ? 1 :
            measurementSystem === 'imperial' ? 2 : 0;
    }

    _onMeasurementSystemSelected() {
        const selected = this._measurementRow.selected;

        Application.settings.set('measurement-system',
                                 selected === 1 ? 'metric' :
                                 selected === 2 ? 'imperial' : 'system');
    }
}

GObject.registerClass(
    {
        Template: "resource:///org/gnome/Maps/ui/preferences.ui",
        InternalChildren: [ 'measurementRow' ],
    },
    PreferencesDialog
);
