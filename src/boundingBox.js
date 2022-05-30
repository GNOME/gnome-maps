/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2021, Marcus Lundblad
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

import * as Constants from './constants.js';

export class BoundingBox {
    constructor(params) {
        /* default to a bounding box the "opposite" of covering the whole
         * visible world, this way extending with a coordinate will ensure
         * it is enlarged to fit that point
         */
        this._left = params?.left ?? Constants.MAX_LONGITUDE;
        this._bottom = params?.bottom ?? Constants.MAX_LATITUDE;
        this._right = params?.right ?? Constants.MIN_LONGITUDE;
        this._top = params?.top ?? Constants.MIN_LATITUDE;
    }

    get top() {
        return this._top;
    }

    set top(top) {
        this._top = top;
    }

    get left() {
        return this._left;
    }

    set left(left) {
        this._left = left;
    }

    get bottom() {
        return this._bottom;
    }

    set bottom(bottom) {
        this._bottom = bottom;
    }

    get right() {
        return this._right;
    }

    set right(right) {
        this._right = right;
    }

    copy() {
        let copy = new BoundingBox();

        copy.top = this.top;
        copy.left = this.left;
        copy.bottom = this.bottom;
        copy.right = this.right;

        return copy;
    }

    getCenter() {
        return [(this.right + this.left) / 2, (this.top + this.bottom) / 2];
    }

    /**
     * Extends bounding box so that all points covered by other bounding box
     * is also covered by this.
     */
    compose(other) {
        if (other.left < this.left)
            this.left = other.left;

        if (other.right > this.right)
            this.right = other.right;

        if (other.top > this.top)
            this.top = other.top;

        if (other.bottom < this.bottom)
            this.bottom = other.bottom;
    }

    /**
     * Extends bounding box to guarantee covering the point
     * (latitude, longitude).
     */
    extend(latitude, longitude) {
        if (longitude < this.left)
            this.left = longitude;

        if (latitude < this.bottom)
            this.bottom = latitude;

        if (longitude > this.right)
            this.right = longitude;

        if (latitude > this.top)
            this.top = latitude;
    }

    isValid() {
        return this.left < this.right && this.bottom < this.top &&
               this.left >= Constants.MIN_LONGITUDE &&
               this.left <= Constants.MAX_LONGITUDE &&
               this.right >= Constants.MIN_LONGITUDE &&
               this.right <= Constants.MAX_LONGITUDE &&
               this.bottom >= Constants.MIN_LATITUDE &&
               this.bottom <= Constants.MAX_LATITUDE &&
               this.top >= Constants.MIN_LATITUDE &&
               this.top <= Constants.MAX_LATITUDE;
    }

    /**
     * Returns true if bounding box covers the point at (latitude, longitude).
     */
    covers(latitude, longitude) {
        return (latitude >= this.bottom && latitude <= this.top) &&
               (longitude >= this.left && longitude <= this.right);
    }
}
