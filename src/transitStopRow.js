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
import Gtk from 'gi://Gtk';
import Pango from 'gi://Pango';
import { TransitRowTrackSegment } from './transitRowTrackSegment.js';

const _ = gettext.gettext;

export class TransitStopRow extends Gtk.ListBoxRow {

    constructor({stop, final, colors, isHead, isTail, ...params}) {
        super(params);

        this.stop = stop;
        this._nameLabel.label = this.stop.name;
        this._timeLabel.label = this.stop.prettyPrint({ isFinal: final });
        
        // Bold name of head and tail stops
        if (isHead || isTail) {
            let attrs = new Pango.AttrList();
            let attr = Pango.attr_weight_new(Pango.Weight.BOLD);
            attrs.insert(attr);       
            this._nameLabel.set_attributes(attrs);
        }

        const line = new TransitRowTrackSegment({
            colors: colors,
            isHead: isHead,
            isTail: isTail,
            isWalk: false,
            isStation: true,
        })
        this._trackSegmentContainer.set_child(line);
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/transit-stop-row.ui',
    InternalChildren: [ 'trackSegmentContainer',
                        'nameLabel',
                        'timeLabel' ]
}, TransitStopRow);
