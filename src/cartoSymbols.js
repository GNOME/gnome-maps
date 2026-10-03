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

import GeocodeGlib from 'gi://GeocodeGlib';

const PLACE_OF_WORSHIP = {
    osmKey:    'amenity',
    osmValue:  'place_of_worship',
    placeType: GeocodeGlib.PlaceType.PLACE_OF_WORSHIP
};

const MAN_MADE_TOWER = {
    osmKey:   'man_made',
    osmValue: 'tower'
};

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
    pub_16: {
        osmKey:   'amenity',
        osmValue: 'pub'
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

    // religious place
    christian_16:     PLACE_OF_WORSHIP,
    jewish_16:        PLACE_OF_WORSHIP,
    muslim_16:        PLACE_OF_WORSHIP,
    taoist_16:        PLACE_OF_WORSHIP,
    hinduist_16:      PLACE_OF_WORSHIP,
    buddhist_16:      PLACE_OF_WORSHIP,
    shintoist_16:     PLACE_OF_WORSHIP,
    sikhist_16:       PLACE_OF_WORSHIP,
    place_of_worship: PLACE_OF_WORSHIP,

    // shops and services
    marketplace_14: {
        osmKey:   'amenity',
        osmValue: 'marketplace'
    },
    convenience_14: {
        osmKey:   'shop',
        osmValue: 'convenience'
    },
    supermarket_14: {
        osmKey:   'shop',
        osmValue: 'supermarket'
    },
    clothes_16: {
        osmKey:   'shop',
        osmValue: 'clothes'
    },
    hairdresser_16: {
        osmKey:   'shop',
        osmValue: 'hairdresser'
    },
    bakery_16: {
        osmKey:   'shop',
        osmValue: 'bakery'
    },
    car_repair_14: {
        osmKey:   'shop',
        osmValue: 'car_repair'
    },
    doityourself_16: {
        osmKey:   'shop',
        osmValue: 'doityourself'
    },
    purple_car: {
        osmKey:   'shop',
        osmValue: 'car'
    },
    newsagent_14: {
        osmKey:   'shop',
        osmValue: 'newsagent'
    },
    beauty_14: {
        osmKey:   'shop',
        osmValue: 'beauty'
    },
    car_wash_14: {
        osmKey:   'amenity',
        osmValue: 'car_wash'
    },
    butcher: {
        osmKey:   'shop',
        osmValue: 'butcher'
    },
    alcohol_16: {
        osmKey:   'shop',
        osmValue: 'alcohol'
    },
    furinture_16: {
        osmKey:   'shop',
        osmValue: 'furniture'
    },
    florist_16: {
        osmKey:   'shop',
        osmValue: 'florist'
    },
    mobile_phone_16: {
        osmKey:   'shop',
        osmValue: 'mobile_phone'
    },
    electronics_16: {
        osmKey:   'shop',
        osmValue: 'electronics'
    },
    shoes_16: {
        osmKey:   'shop',
        osmValue: 'shoes'
    },
    car_parts_14: {
        osmKey:   'shop',
        osmValue: 'car_parts'
    },
    greengrocer_14: {
        osmKey:   'shop',
        osmValue: 'greengrocer'
    },
    laundry_14: {
        osmKey:   'shop',
        osmValue: 'laundry'
    },
    opician_16: {
        osmKey:   'shop',
        osmValue: 'optician'
    },
    jewellery_16: {
        osmKey:   'shop',
        osmValue: 'jewelry'
    },
    books_16: {
        osmKey:   'shop',
        osmValue: 'books'
    },
    gift_16: {
        osmKey:   'shop',
        osmValue: 'gift'
    },
    department_store_16: {
        osmKey:   'shop',
        osmValue: 'department_store'
    },
    bicycle_16: {
        osmKey:   'shop',
        osmValue: 'bicycle'
    },
    confectionery_14: {
        osmKey:   'shop',
        osmValue: 'confectionery'
    },
    variety_store_14: {
        osmKey:   'shop',
        osmValue: 'variety_store'
    },
    travel_agency_14: {
        osmKey:   'shop',
        osmValue: 'travel_agency'
    },
    sport_14: {
        osmKey:   'shop',
        osmValue: 'sports'
    },
    chemist_14: {
        osmKey:   'shop',
        osmValue: 'chemist'
    },
    computer_14: {
        osmKey:   'shop',
        osmValue: 'computer'
    },
    stationary_14: {
        osmKey:   'shop',
        osmValue: 'stationary'
    },
    pet_16: {
        osmKey:   'shop',
        osmValue: 'pet'
    },
    beverages_14: {
        osmKey:   'shop',
        osmValue: 'beverages'
    },
    perfumery_14: {
        osmKey:   'shop',
        osmValue: 'cosmetics'
    },
    tyres: {
        osmKey:   'shop',
        osmValue: 'tyres'
    },
    shop_motorcycle: {
        osmKey:   'shop',
        osmValue: 'motorcycle'
    },
    garden_centre_14: {
        osmKey:   'shop',
        osmValue: 'garden_centre'
    },
    copyshop_14: {
        osmKey:   'shop',
        osmValue: 'copyshop'
    },
    toys_14: {
        osmKey:   'shop',
        osmValue: 'toys'
    },
    deli_14: {
        osmKey:   'shop',
        osmValue: 'deli'
    },
    tobacco_14: {
        osmKey:   'shop',
        osmValue: 'tobacco'
    },
    seafood_14: {
        osmKey:   'shop',
        osmValue: 'seafood'
    },
    interior_decoration_16: {
        osmKey:   'shop',
        osmValue: 'interior_decoration'
    },
    ticket_14: {
        osmKey:   'shop',
        osmValue: 'ticket'
    },
    photo_14: {
        osmKey:   'shop',
        osmValue: 'photo'
    },
    trade_14: {
        osmKey:   'shop',
        osmValue: 'trade'
    },
    outdoor_14: {
        osmKey:   'shop',
        osmValue: 'outdoor'
    },
    houseware_14: {
        osmKey:   'shop',
        osmValue: 'houseware'
    },
    art_14: {
        osmKey:   'shop',
        osmValue: 'art'
    },
    paint_14: {
        osmKey:   'shop',
        osmValue: 'paint'
    },
    fabric_14: {
        osmKey:   'shop',
        osmValue: 'fabric'
    },
    bookmaker_14: {
        osmKey:   'shop',
        osmValue: 'bookmaker'
    },
    second_hand_14: {
        osmKey:   'shop',
        osmValue: 'second_hand'
    },
    charity_14: {
        osmKey:   'shop',
        osmValue: 'charity'
    },
    bed_14: {
        osmKey:   'shop',
        osmValue: 'bed'
    },
    medical_supply: {
        osmKey:   'shop',
        osmValue: 'medical_supply'
    },
    hifi_14: {
        osmKey:   'shop',
        osmValue: 'hifi'
    },
    shop_music: {
        osmKey:   'shop',
        osmValue: 'music'
    },
    coffee_14: {
        osmKey:   'shop',
        osmValue: 'coffee'
    },
    shop_motorcycle_repair: {
        osmKey:   'shop',
        osmValue: 'motorcycle_repair'
    },
    hearing_aids: {
        osmKey:   'shop',
        osmValue: 'hearing_aids'
    },
    musical_instrument_14: {
        osmKey:   'shop',
        osmValue: 'musical_instrument'
    },
    tea_14: {
        osmKey:   'shop',
        osmValue: 'tea'
    },
    video_14: {
        osmKey:   'shop',
        osmValue: 'video'
    },
    bag_14: {
        osmKey:   'shop',
        osmValue: 'bag'
    },
    carpet_14: {
        osmKey:   'shop',
        osmValue: 'carpet'
    },
    video_games_14: {
        osmKey:   'shop',
        osmValue: 'video_games'
    },
    vehicle_inspection_14: {
        osmKey:   'amenity',
        osmValue: 'vehicle_inspection'
    },
    dairy: {
        osmKey:   'shop',
        osmValue: 'dairy'
    },
    shop_other_16: {
        osmKey:   'shop',
        osmValue: 'other'
    },
    office_16: {
        osmKey:   'office',
        osmValue: 'yes'
    },
    social_amenity_darken_80_16: {
        osmKey:   'amenity',
        osmValue: 'nursing_home'
    },

    // landmarks, man-made infrastructure, masts and towers
    storage_tank_14: {
        osmKey:   'man_made',
        osmValue: 'storage_tank'
    },
    tower_freestanding: MAN_MADE_TOWER,
    tower_cantileveler_communication: MAN_MADE_TOWER,
    generator_wind_14: {
        osmKey:   'power',
        osmValue: 'generator'
    },
    hunting_stand_16: {
        osmKey:   'amenity',
        osmValue: 'hunting_stand'
    },
    christian_9: {
        osmKey:   'historic',
        osmValue: 'wayside_cross'
    },
    water_tower_16: {
        osmKey:   'man_made',
        osmValue: 'water_tower'
    },
    mast_general: {
        osmKey:   'man_made',
        osmValue: 'mast'
    },
    bunker_osmcarto: {
        osmKey:   'military',
        osmValue: 'bunker'
    },
    chimney_14: {
        osmKey:   'man_made',
        osmValue: 'chimney'
    },
    tower_observation: MAN_MADE_TOWER,
    bell_tower: MAN_MADE_TOWER,
    tower_lightning: MAN_MADE_TOWER,
    lighthouse_16: {
        osmKey:   'man_made',
        osmValue: 'lighthouse'
    },
    column_14: {
        osmKey:   'advertising',
        osmValue: 'column'
    },
    crane_14: {
        osmKey:   'man_made',
        osmValue: 'crane'
    },
    windmill_16: {
        osmKey:   'man_made',
        osmValue: 'windmill'
    },
    tower_lattice_communication: MAN_MADE_TOWER,
    mast_lightning: {
        osmKey:   'man_made',
        osmValue: 'mast'
    },
    mast_communication: {
        osmKey:   'man_made',
        osmValue: 'mast'
    },
    communication_tower_14: {
        osmKey:   'man_made',
        osmValue: 'communication_tower'
    },
    tower_defencive: MAN_MADE_TOWER,
    tower_cooling: MAN_MADE_TOWER,
    tower_lattice: MAN_MADE_TOWER,
    tower_lattice_lightning: MAN_MADE_TOWER,
    tower_dish: MAN_MADE_TOWER,
    tower_dome: MAN_MADE_TOWER,
    telescope_dish_14: {
        osmKey:   'man_made',
        osmValue: 'telescope'
    },
    telescope_dome_14: {
        osmKey:   'man_made',
        osmValue: 'telescope'
    },

    // electricity
    power_tower: {
        osmKey:   'power',
        osmValue: 'tower'
    },
    power_pole: {
        osmKey:   'power',
        osmValue: 'pole'
    },

    // places
    country: {
        osmKey:    'place',
        osmValue:  'country',
        placeType: GeocodeGlib.PlaceType.COUNTRY
    },
    state: {
        osmKey:    'place',
        osmValue:  'state',
        placeType: GeocodeGlib.PlaceType.STATE
    },
    place_6: {
        osmKey:    'place',
        osmValue:  'city',
        placeType: GeocodeGlib.PlaceType.TOWN
    },
    place_capital_8: {
        osmKey:   'place',
        osmValue: 'city'
    },
    town: {
        osmKey:    'place',
        osmValue:  'town',
        placeType:  GeocodeGlib.PlaceType.TOWN
    },
    quarter: {
        osmKey:    'place',
        osmValue:  'quarter',
        placeType: GeocodeGlib.PlaceType.TOWN
    },
    suburb: {
        osmKey:    'place',
        osmValue:  'suburb',
        placeType: GeocodeGlib.PlaceType.SUBURB
    },
    village: {
        osmKey:    'place',
        osmValue:  'village',
        placeType: GeocodeGlib.PlaceType.TOWN
    },
    hamlet: {
        osmKey:     'place',
        osmValue:   'hamlet'
    },
    isolated_dwelling: {
        osmKey:    'place',
        osmValue:  'isolated_dwelling',
        placeType: GeocodeGlib.PlaceType.TOWN
    },
    island: {
        osmKey:    'place',
        osmValue:  'island',
        placeType: GeocodeGlib.PlaceType.ISLAND
    },
    islet: {
        osmKey:    'place',
        osmValue:  'islet',
        placeType: GeocodeGlib.PlaceType.ISLAND
    }
};

export function getPlaceParamsForCategory(category) {
    const mapping = SYMBOL_MAP[category];

    return { osmKey:    mapping?.osmKey,
             osmValue:  mapping?.osmValue,
             placeType: mapping?.placeType ?? GeocodeGlib.PlaceType. MISCELLANEOUS };
}
