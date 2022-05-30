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

import Cairo from 'cairo';
import Clutter from 'gi://Clutter';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as Color from './color.js';
import {Location} from './location.js';
import {MapMarker} from './mapMarker.js';
import {Place} from './place.js';
import * as TransitPlan from './transitPlan.js';
import * as Utils from './utils.js';

const ICON_SIZE = 12;
const ACTOR_SIZE = 20;

/* threashhold for route color luminance when we consider it more or less
 * as white, and draw an outline around the label
 */
const OUTLINE_LUMINANCE_THREASHHOLD = 0.9;

export class TransitBoardMarker extends MapMarker {

    constructor(params) {
        let firstPoint = params.leg.polyline[0];
        let location = new Location({ latitude: firstPoint.latitude,
                                      longitude: firstPoint.longitude });
        let leg = params.leg;

        delete params.leg;
        params.place = new Place({ location: location });
        super(params);

        this.add_actor(this._createActor(leg));
    }

    /* Creates a Clutter actor for the given transit leg, showing the
     * corresponding transit type icon and rendered inside a circle using the
     * foreground color of the icon taken from the transit legs text color
     * attribute and background color taken from the transit legs color
     * attribute.
     * Also draw an outline in the same color as the icon in case the
     * background color above a threshold to improve readability against the
     * map background.
     */
    _createActor(leg) {
        try {
            let bgColor = leg.color ?? TransitPlan.DEFAULT_ROUTE_COLOR;
            let fgColor =
                Color.getContrastingForegroundColor(bgColor, leg.textColor ?
                                                             leg.textColor :
                                                             TransitPlan.DEFAULT_ROUTE_TEXT_COLOR);
            let hasOutline =
                Color.relativeLuminance(bgColor) > OUTLINE_LUMINANCE_THREASHHOLD;
            let bgRed = Color.parseColor(bgColor, 0);
            let bgGreen = Color.parseColor(bgColor, 1);
            let bgBlue = Color.parseColor(bgColor, 2);
            let fgRed = Color.parseColor(fgColor, 0);
            let fgGreen = Color.parseColor(fgColor, 1);
            let fgBlue = Color.parseColor(fgColor, 2);
            let fgRGBA = new Gdk.RGBA({ red: fgRed,
                                        green: fgGreen,
                                        blue: fgBlue,
                                        alpha: 1.0
                                      });
            let theme = Gtk.IconTheme.get_default();
            let info = theme.lookup_icon(leg.iconName, ICON_SIZE,
                                         Gtk.IconLookupFlags.FORCE_SIZE);
            let pixbuf = info.load_symbolic(fgRGBA, null, null, null)[0];
            let canvas = new Clutter.Canvas({ width: ACTOR_SIZE,
                                              height: ACTOR_SIZE });


            canvas.connect('draw', (canvas, cr) => {
                cr.setOperator(Cairo.Operator.CLEAR);
                cr.paint();
                cr.setOperator(Cairo.Operator.OVER);

                cr.setSourceRGB(bgRed, bgGreen, bgBlue);
                cr.arc(ACTOR_SIZE / 2, ACTOR_SIZE / 2, ACTOR_SIZE / 2,
                       0, Math.PI * 2);
                cr.fillPreserve();

                Gdk.cairo_set_source_pixbuf(cr, pixbuf,
                                            (ACTOR_SIZE - pixbuf.get_width()) / 2,
                                            (ACTOR_SIZE - pixbuf.get_height()) / 2);
                cr.paint();

                if (hasOutline) {
                    cr.setSourceRGB(fgRed, fgGreen, fgBlue);
                    cr.setLineWidth(1);
                    cr.stroke();
                }

                this._surface = cr.getTarget();
            });

            let actor = new Clutter.Actor();

            actor.set_content(canvas);
            actor.set_size(ACTOR_SIZE, ACTOR_SIZE);
            canvas.invalidate();

            return actor;
        } catch (e) {
            Utils.debug('Failed to load image: %s'.format(e.message));
            return null;
        }
    }

    get anchor() {
        return { x: Math.floor(this.width / 2) - 1,
                 y: Math.floor(this.height / 2) - 1 };
    }
}

GObject.registerClass(TransitBoardMarker);
