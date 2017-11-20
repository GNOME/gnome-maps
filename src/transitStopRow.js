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

const _ = imports.gettext.gettext;

const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

var TransitStopRow = GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/transit-stop-row.ui',
    InternalChildren: [ 'nameLabel',
                        'timeLabel' ]
}, class TransitStopRow extends Gtk.ListBoxRow {

    _init(params) {
        this.stop = params.stop;
        delete params.stop;

        this._final = params.final;
        delete params.final;

        super._init(params);

        this._nameLabel.label = this.stop.name;
        this._timeLabel.label = this.stop.prettyPrint({ isFinal: this._final });
    }
});
