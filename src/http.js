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
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>.
 *
 * Author: Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>
 */

import GLib from 'gi://GLib';

function encode(data) {
    if(data === null)
        return null;

    return GLib.uri_escape_string(data.toString(), null, false);
}

export class Query {

    constructor(obj) {
        this._query = {};
        for(let key in obj) {
            this.add(key, obj[key]);
        }
    }

    // a value === null represents an empty value
    add(key, value) {
        // Initialize query field if it isn't already
        let queryValue = this._query[key];
        if(!Array.isArray(queryValue))
            this._query[key] = [];

        if(Array.isArray(value))
            this._query[key] = this._query[key].concat(value);
        else
            this._query[key].push(value);
    }

    /**
     * Get the query parameters in string form.
     * If useArrayNotation is given, and true, use array notation adding []
     * after key if there's multiple values for that key.
     */
    toString(useArrayNotation = false) {
        let vars = [];
        for(let key in this._query) {
            let values = this._query[key];
            let multipleValues = values.length > 1;
            let encKey = encode(key) + (multipleValues && useArrayNotation ?
                                        '[]' : '');

            values.forEach(function(value) {
                let encValue = encode(value);
                if(encValue !== null)
                    vars.push([encKey, encValue].join('='));
                else
                    vars.push(encKey);
            });
        }
        return vars.join('&');
    }
}
