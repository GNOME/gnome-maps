/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2013 Mattias Bengtsson.
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
 * Author: Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>
 */

const Lang = imports.lang;
const Champlain = imports.gi.Champlain;

const Utils = imports.utils;

const TurnPointType = {
    SHARP_LEFT:    0,
    LEFT:          1,
    SLIGHT_LEFT:   2,
    CONTINUE:      3,
    SLIGHT_RIGHT:  4,
    RIGHT:         5,
    SHARP_RIGHT:   6,
    END:           7,
    VIA:           8,

    // This one is not in GraphHopper, so choose
    // a reasonably unlikely number for this
    START:         10000
};

const Route = new Lang.Class({
    Name: 'Route',

    _init: function() {
        this.reset();
    },

    update: function({ path, turnPoints, distance, time, bbox }) {
        this.path = path;
        this.turnPoints = turnPoints;
        this.distance = distance;
        this.time = time;
        this.bbox = bbox || this._createBBox(path);

        this.emit('update');
    },

    reset: function() {
        this.path = [];
        this.turnPoints = [];
        this.distance = 0;
        this.time = 0;
        this.bbox = null;
        this.emit('reset');
    },

    _createBBox: function(coordinates) {
        let bbox = new Champlain.BoundingBox();
        coordinates.forEach(function({ latitude, longitude }) {
            bbox.extend(latitude, longitude);
        }, this);
        return bbox;
    }
});
Utils.addSignalMethods(Route.prototype);

const TurnPoint = new Lang.Class({
    Name: 'TurnPoint',

    _init: function({ coordinate, type, distance, instruction }) {
        this.coordinate = coordinate;
        this._type = type;
        this.distance = distance;
        this.instruction = instruction;
        this.iconResource = this._getIconResource();
    },

    isDestination: function() {
        return this._type === TurnPointType.START
            || this._type === TurnPointType.VIA
            || this._type === TurnPointType.STOP;
    },

    _getIconResource: function() {
        switch(this._type) {
        case TurnPointType.SHARP_LEFT:   return '/org/gnome/maps/direction-sharpleft';
        case TurnPointType.LEFT:         return '/org/gnome/maps/direction-left';
        case TurnPointType.SLIGHT_LEFT:  return '/org/gnome/maps/direction-slightleft';
        case TurnPointType.CONTINUE:     return '/org/gnome/maps/direction-continue';
        case TurnPointType.SLIGHT_RIGHT: return '/org/gnome/maps/direction-slightright';
        case TurnPointType.RIGHT:        return '/org/gnome/maps/direction-right';
        case TurnPointType.SHARP_RIGHT:  return '/org/gnome/maps/direction-sharpright';
        case TurnPointType.END:          return '/org/gnome/maps/direction-end';
        case TurnPointType.START:        return '/org/gnome/maps/direction-start';
        default:                         return '';
        }
    }
});
