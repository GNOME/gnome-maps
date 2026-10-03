/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2026 Marcus Lundblad
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
 * Author: Marcus Lundblad <ml@dfupdate.se>
 */

/**
 * Mapping Carto symbol names to OSM tags.
 *
 * See: https://wiki.openstreetmap.org/wiki/OpenStreetMap_Carto/Symbols
 */

const SYMBOL_MAP = {
    // gastronomy
    restaurant_14: {
        osmKey:   'amenity',
        osmValue: 'restaurant'
    },
    cafe_16: {
        osmKey:   'amenity',
        osmValue: 'cafe'
    },
    fast_food_16: {
        osmKey:   'amenity',
        osmValue: 'fast_food'
    },
    bar_16: {
        osmKey:   'amenity',
        osmValue: 'bar'
    },
    ice_cream_14: {
        osmKey:   'amenity',
        osmValue: 'ice_cream'
    },
    biergarten_16: {
        osmKey:   'amenity',
        osmValue: 'biergarten'
    },
    outdoor_seating_14: {
        osmKey:   'leisure',
        osmValue: 'outdoor_seating'
    },

    // culture, entertainment and arts
    artwork_14: {
        osmKey:   'tourism',
        osmValue: 'artwork'
    },
    community_centre_14: {
        osmKey:   'amenity',
        osmValue: 'community_centre'
    },
    library_16: {
        osmKey:   'amenity',
        osmValue: 'library'
    },
    museum_16: {
        osmKey:   'tourism',
        osmValue: 'museum'
    },
    theatre_16: {
        osmKey:   'amenity',
        osmValue: 'theatre'
    },
    cinema_16: {
        osmKey:   'amenity',
        osmValue: 'cinema'
    },
    nightclub_16: {
        osmKey:   'amenity',
        osmValue: 'nightclub'
    },
    arts_centre: {
        osmKey:   'amenity',
        osmValue: 'arts_centre'
    },
    gallery_14: {
        osmKey:   'tourism',
        osmValue: 'gallery'
    },
    internet_cafe_14: {
        osmKey:   'amenity',
        osmValue: 'internet_cafe'
    },
    casino_14: {
        osmKey:   'amenity',
        osmValue: 'casino'
    },
    public_bookcase_14: {
        osmKey:   'amenity',
        osmValue: 'public_bookcase'
    },
    amusement_arcade_14: {
        osmKey:   'leisure',
        osmValue: 'amusement_arcade'
    },

    // historical
    memorial_16: {
        osmKey:   'historic',
        osmValue: 'memorial'
    },
    archaeological_site_16: {
        osmKey:   'historic',
        osmValue: 'archaeological_site'
    },
    carto_shrine: {
        osmKey:   'historic',
        osmValue: 'wayside_shrine'
    },
    monument_16: {
        osmKey:   'historic',
        osmValue: 'monument'
    },
    castle_14: {
        osmKey:   'historic',
        osmValue: 'castle'
    },
    plaque: {
        osmKey:   'historic',
        osmValue: 'memorial'
    },
    statue_14: {
        osmKey:   'historic',
        osmValue: 'memorial'
    },
    stone_14: {
        osmKey:   'historic',
        osmValue: 'memorial'
    },
    palace_14: {
        osmKey:   'historic',
        osmValue: 'castle'
    },
    fortress_14: {
        osmKey:   'historic',
        osmValue: 'castle'
    },
    historic_fort: {
        osmKey:   'historic',
        osmValue: 'castle'
    },
    bust_14: {
        osmKey:   'historic',
        osmValue: 'memorial'
    },
    city_gate_14: {
        osmKey:   'historic',
        osmValue: 'city_gate'
    },
    manor_14: {
        osmKey:   'historic',
        osmValue: 'manor'
    },
    obelisk_14: {
        osmKey:   'man_made',
        osmValue: 'obelisk'
    },

    // leisure, recreation and sports
    playground_16: {
        osmKey:   'leisure',
        osmValue: 'playground'
    },
    fitness: {
        osmKey:   'leisure',
        osmValue: 'fitness_centre'
    },
    golf_icon: {
        osmKey:   'leisure',
        osmValue: 'golf_course'
    },
    swimming_16: {
        osmKey:   'leisure',
        osmValue: 'water_park'
    },
    massage_14: {
        osmKey:   'shop',
        osmValue: 'massage'
    },
    sauna_14: {
        osmKey:   'leisure',
        osmValue: 'sauna'
    },
    public_bath: {
        osmKey:   'leisure',
        osmValue: 'public_bath'
    },
    miniature_golf: {
        osmKey:   'leisure',
        osmValue: 'miniature_golf'
    },
    beach_resort_14: {
        osmKey:   'leisure',
        osmValue: 'beach_resort'
    },
    fishing_14: {
        osmKey:   'leisure',
        osmValue: 'fishing'
    },
    bowling_alley_14: {
        osmKey:   'leisure',
        osmValue: 'bowling_alley'
    },
    dog_park: {
        osmKey:   'leisure',
        osmValue: 'dog_park'
    },
    leisure_dance: {
        osmKey:   'leisure',
        osmValue: 'dance'
    },
};

export function getOsmKeyForCategory(category) {
    return SYMBOL_MAP[category]?.osmKey;
}

export function getOsmValueForCategory(category) {
    return SYMBOL_MAP[category]?.osmValue;
}
