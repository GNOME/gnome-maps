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

    // waste management
    toilets_16: {
        osmKey:   'amenity',
        osmValue: 'toilets'
    },
    recycling_16: {
        osmKey:   'amenity',
        osmValue: 'recycling'
    },
    waste_basket_12: {
        osmKey:   'amenity',
        osmValue: 'waste_basket'
    },
    waste_disposal_14: {
        osmKey:   'amenity',
        osmValue: 'waste_disposal'
    },
    excrement_bags_14: {
        osmKey:   'amenity',
        osmValue: 'vending_machine'
    },

    // outdoor
    bench_16: {
        osmKey:   'amenity',
        osmValue: 'bench'
    },
    shelter_14: {
        osmKey:   'amenity',
        osmValue: 'shelter'
    },
    drinking_water_16: {
        osmKey:   'amenity',
        osmValue: 'drinking_water'
    },
    picnic_site: {
        osmKey:   'tourism',
        osmValue: 'picnic_site'
    },
    fountain_14: {
        osmKey:   'amenity',
        osmValue: 'fontain'
    },
    camping_16: {
        osmKey:   'tourism',
        osmValue: 'camp_site'
    },
    table_16: {
        osmKey:   'leisure',
        osmValue: 'picnic_table'
    },
    caravan_16: {
        osmKey:   'tourism',
        osmValue: 'caravan_site'
    },
    bbq_14: {
        osmKey:   'amenity',
        osmValue: 'bbq'
    },
    shower_14: {
        osmKey:   'amenity',
        osmValue: 'shower'
    },
    firepit: {
        osmKey:   'leisure',
        osmValue: 'firepit'
    },
    bird_hide_14: {
        osmKey:   'leisure',
        osmValue: 'bird_hide'
    },

    // tourism and accomodation
    guidepost_14: {
        osmKey:   'tourism',
        osmValue: 'information'
    },
    board_14: {
        osmKey:   'tourism',
        osmValue: 'information'
    },
    map_14: {
        osmKey:   'tourism',
        osmValue: 'information'
    },
    guidepost_14: {
        osmKey:   'tourism',
        osmValue: 'information'
    },
    office_14: {
        osmKey:   'tourism',
        osmValue: 'information'
    },
    terminal_14: {
        osmKey:   'tourism',
        osmValue: 'information'
    },
    audioguide_14: {
        osmKey:   'tourism',
        osmValue: 'information'
    },
    viewpoint_16: {
        osmKey:   'tourism',
        osmValue: 'viewpoint'
    },
    hotel_16: {
        osmKey:   'tourism',
        osmValue: 'hotel'
    },
    tourism_guesthouse: {
        osmKey:   'tourism',
        osmValue: 'guest_house'
    },
    hostel_16: {
        osmKey:   'tourism',
        osmValue: 'hostel'
    },
    chalet: {
        osmKey:   'tourism',
        osmValue: 'chalet'
    },
    motel_16: {
        osmKey:   'tourism',
        osmValue: 'motel'
    },
    apartment: {
        osmKey:   'tourism',
        osmValue: 'apartment'
    },
    alpinehut: {
        osmKey:   'tourism',
        osmValue: 'alpine_hut'
    },
    wilderness_hut: {
        osmKey:   'tourism',
        osmValue: 'wilderness_hut'
    },

    // finance
    bank_16: {
        osmKey:   'amenity',
        osmValue: 'bank'
    },
    atm_14: {
        osmKey:   'amenity',
        osmValue: 'atm'
    },
    bureau_de_change_14: {
        osmKey:   'amenity',
        osmValue: 'bureau_de_change'
    },

    // healthcare
    pharmacy_14: {
        osmKey:   'amenity',
        osmValue: 'pharmacy'
    },
    hospital_14: {
        osmKey:   'amenity',
        osmValue: 'hospital'
    },
    doctors_14: {
        osmKey:   'amenity',
        osmValue: 'doctors'
    },
    dentist_14: {
        osmKey:   'amenity',
        osmValue: 'dentist'
    },
    pharmacy_14: {
        osmKey:   'amenity',
        osmValue: 'pharmacy'
    },
    veterinary_14: {
        osmKey:   'amenity',
        osmValue: 'veterinary'
    },

    // communication
    post_box_12: {
        osmKey:   'amenity',
        osmValue: 'post_box'
    },
    post_office_14: {
        osmKey:   'amenity',
        osmValue: 'post_office'
    },
    parcel_locker: {
        osmKey:   'amenity',
        osmValue: 'parcel_locker'
    },
    telephone_16: {
        osmKey:   'amenity',
        osmValue: 'telephone'
    },
    emergency_phone_16: {
        osmKey:   'emergency',
        osmValue: 'phone'
    },

    // transportation
    parking_16: {
        osmKey:   'amenity',
        osmValue: 'parking'
    },
    parking_subtle: {
        osmKey:   'amenity',
        osmValue: 'parking'
    },
    bus_stop_12: {
        osmKey:   'highway',
        osmValue: 'bus_stop'
    },
    parking_16: {
        osmKey:   'amenity',
        osmValue: 'parking'
    },
    fuel_16: {
        osmKey:   'amenity',
        osmValue: 'fuel'
    },
    parking_bicycle_16: {
        osmKey:   'amenity',
        osmValue: 'bikcyle_parking'
    },
    amenity_bus_station: {
        osmKey:   'amenity',
        osmValue: 'bus_station'
    },
    helipad_16: {
        osmKey:   'aeroway',
        osmValue: 'helipad'
    },
    aerodrome: {
        osmKey:   'aeroway',
        osmValue: 'aerodrome'
    },
    rental_bicycle_16: {
        osmKey:   'amenity',
        osmValue: 'bicycle_rental'
    },
    transport_slipway: {
        osmKey:   'leisure',
        osmValue: 'slipway'
    },
    taxi_16: {
        osmKey:   'amenity',
        osmValue: 'taxi'
    },
    subway_entrance_12: {
        osmKey:   'railway',
        osmValue: 'subway_entrance'
    },
    charging_station_16: {
        osmKey:   'amenity',
        osmValue: 'charging_station'
    },
    elevator_12: {
        osmKey:   'highway',
        osmValue: 'elevator'
    },
    rental_car_16: {
        osmKey:   'amenity',
        osmValue: 'car_rental'
    },
    ferry_icon: {
        osmKey:   'amenity',
        osmValue: 'ferry_terminal'
    },
    parking_motorcycle_16: {
        osmKey:   'amenity',
        osmValue: 'motorcycle_parking'
    },
    bicycle_repair_station_14: {
        osmKey:   'amenity',
        osmValue: 'bicycle_repair_station'
    },
    boat_rental_14: {
        osmKey:   'amenity',
        osmValue: 'boat_rental'
    },

    // nature
    tree_16: {
        osmKey:   'natural',
        osmValue: 'tree'
    },
    peak_8: {
        osmKey:   'natural',
        osmValue: 'peak'
    },
    spring_14: {
        osmKey:   'natural',
        osmValue: 'spring'
    },
    cave_14: {
        osmKey:   'natural',
        osmValue: 'cave_entrance'
    },
    waterfall_14: {
        osmKey:   'waterway',
        osmValue: 'waterfall'
    },
    saddle_8: {
        osmKey:   'natural',
        osmValue: 'saddle'
    },
    volcano_8: {
        osmKey:   'natural',
        osmValue: 'volcano'
    },

    // administrative facilities
    police_16: {
        osmKey:   'amenity',
        osmValue: 'police'
    },
    town_hall_16: {
        osmKey:   'amenity',
        osmValue: 'townhall'
    },
    fire_station_16: {
        osmKey:   'amenity',
        osmValue: 'fire_station'
    },
    social_facility_14: {
        osmKey:   'amenity',
        osmValue: 'social_facility'
    },
    courthouse_16: {
        osmKey:   'amenity',
        osmValue: 'courthouse'
    },
    diplomatic: {
        osmKey:   'office',
        osmValue: 'diplomatic'
    },
    office_diplomatic_consulate: {
        osmKey:   'office',
        osmValue: 'diplomatic'
    },
    prison_16: {
        osmKey:   'amenity',
        osmValue: 'prison'
    },
};

export function getOsmKeyForCategory(category) {
    return SYMBOL_MAP[category]?.osmKey;
}

export function getOsmValueForCategory(category) {
    return SYMBOL_MAP[category]?.osmValue;
}
