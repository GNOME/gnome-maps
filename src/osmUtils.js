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

const Soup = imports.gi.Soup;

const Application = imports.application;

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
         *
         * also update the displayed localized name, if it was equal
         * to the translated name to avoid the old name showing up as the
         * native name in when editing places where they equal
         */
        if (place.name === place.nativeName)
            place.name = name;
        place.nativeName = name;
    }
    place.population = object.get_tag('population');
    place.website = object.get_tag('website');
    place.phone = object.get_tag('phone');
    place.wiki = object.get_tag('wikipedia');
    place.openingHours = object.get_tag('opening_hours');
    place.wheelchair = object.get_tag('wheelchair');
    place.toilets = object.get_tag('toilets');
    place.internetAccess = object.get_tag('internet_access');
    place.religion = object.get_tag('religion');

    let altitude = object.get_tag('ele');

    if (altitude)
        place.location.altitude = altitude;

    Application.placeStore.updatePlace(place);
}
