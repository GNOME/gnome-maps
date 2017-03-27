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

const GLib = imports.gi.GLib;
const Soup = imports.gi.Soup;

const Application = imports.application;

let languageCode = null;

/*
 * Gets a Wikipedia article in OSM tag format (i.e. lang:Article title)
 * given a URL or null if input doesn't match a Wikipedia URL
 */
function getWikipediaOSMArticleFormatFromUrl(url) {
    let regex = /https?:\/\/(..)\.wikipedia\.org\/wiki\/(.+)/;
    let match = url.match(regex);

    if (match && match.length == 3) {
        let lang = match[1];
        let article = match[2];

        return lang + ':' + Soup.uri_decode(article).replace(/_/g, ' ');
    } else {
        return null;
    }
}

/**
 * Updates a Place object according to an OSMObject.
 * Will also update place in the place store.
 */
function updatePlaceFromOSMObject(place, object) {
    let name = object.get_tag('name');

    if (name) {
        /* only update the place's name from the OSM object if the OSM object
         * actually has a name set.
         * https://bugzilla.gnome.org/show_bug.cgi?id=762569
         */
        place.name = name;
    }
    place.population = object.get_tag('population');
    place.website = object.get_tag('website');
    place.phone = object.get_tag('phone');
    place.wiki = object.get_tag('wikipedia');
    place.openingHours = object.get_tag('opening_hours');
    place.wheelchair = object.get_tag('wheelchair');

    Application.placeStore.updatePlace(place);
}

/**
 * Get the bare ISO 639 language code of the preferred locale.
 */
function getLanguageCode() {
    if (languageCode)
        return languageCode;

    let locale = GLib.get_language_names()[0];

    // strip charset
    if (locale.indexOf('.') !== -1)
        locale = locale.substring(0, locale.indexOf('.'));

    // strip country
    if (locale.indexOf('_') !== -1)
        locale = locale.substring(0, locale.indexOf('_'));

    languageCode = locale;
    return languageCode;
}
