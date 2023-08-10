/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2015 Marcus Lundblad
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
 * Author: Marcus Lundblad <ml@update.uu.se>
 */

import GLib from 'gi://GLib';

import {Application} from './application.js';

/*
 * Gets a Wikipedia article in OSM tag format (i.e. lang:Article title)
 * given a URL or null if input doesn't match a Wikipedia URL
 */
export function getWikipediaOSMArticleFormatFromUrl(url) {
    let regex = /https?:\/\/(..)\.wikipedia\.org\/wiki\/(.+)/;
    let match = url.match(regex);

    if (match && match.length == 3) {
        let lang = match[1];
        let article = match[2];

        return lang + ':' +
               GLib.uri_unescape_string(article, null).replace(/_/g, ' ');
    } else {
        return null;
    }
}

/*
 * Gets a Wikidata tag from from a URL of the forms
 * https://www.wikidata.org/wiki/Qnnnn, or
 * https://www.wikidata.org/wiki/Special:EntityPage/Qnnnn
 * or null if input doesn't match these formats
 */
export function getWikidataFromUrl(url) {
    let regex =
        /https?:\/\/www.\wikidata\.org\/wiki\/(?:Special:EntityPage\/)?(Q\d+)/;
    let match = url.match(regex);

    if (match?.length === 3 || match?.length === 2)
        return match.last();
    else
        return null;
}
