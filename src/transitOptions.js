/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2017 Marcus Lundblad.
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

export class TransitOptions {

    constructor() {
        this._showAllTransitTypes = true;
        this._transitTypes = [];
    }

    get showAllTransitTypes() {
        return this._showAllTransitTypes;
    }

    /* When set to true, show any mode of transportation, else only show modes
     * added with addTransitType()
     */
    set showAllTransitTypes(showAllTransitTypes) {
        this._showAllTransitTypes = showAllTransitTypes;
        this._transitTypes = [];
    }

    /* Add an explicit transport mode to show
     */
    addTransitType(transitType) {
        this._showAllTransitTypes = false;
        this._transitTypes.push(transitType);
    }

    get transitTypes() {
        return this._transitTypes;
    }

    /* return true if the passed in options objects are equal, either both
     * accept any transit type, or both contains the same set of types, otherwise
     * return false
     */
    static equals(first, second) {
        if (first.showAllTransitTypes && second.showAllTransitTypes) {
            return true;
        } else if (first.transitTypes.length !== second.transitTypes.length) {
            return false;
        } else {
            for (let type of first.transitTypes) {
                if (second.transitTypes.indexOf(type) === -1)
                    return false;
            }

            return true;
        }
    }
}
