/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2021 Marcus Lundblad
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

/**
 * Mapping OSM key/values to place icons.
 * Keys in top map correspond to osmKey from Place.
 * Keys in nested maps correspond to osmValue from Place,
 * _ matches catch-all case for that osmKey.
 */
const TYPE_ICON_MAP = {
    aeroway: {
        aerodrome: 'route-transit-airplane-symbolic'
    },
    amenity: {
        bar:              'bar-symbolic',
        biergarten:       'pub-symbolic',
        bus_station:      'route-transit-bus-symbolic',
        cafe:             'cafe-symbolic',
        charging_station: 'electric-car-symbolic',
        cinema:           'video-camera-symbolic',
        clinic:           'hospital-sign-symbolic',
        college:          'school-symbolic',
        doctors:          'hospital-sign-symbolic',
        fast_food:        'restaurant-symbolic',
        ferry_terminal:   'route-transit-ferry-symbolic',
        food_court:       'restaurant-symbolic',
        fuel:             'fuel-symbolic',
        hospital:         'hospital-symbolic',
        kindergarten:     'school-symbolic',
        night_club:       'bar-symbolic',
        parking:          'parking-sign-symbolic',
        post_office:      'post-box-symbolic',
        pub:              'pub-symbolic',
        restaurant:       'restaurant-symbolic',
        school:           'school-symbolic',
        university:       'school-symbolic'
    },
    building: {
        railway_station:  'route-transit-train',
        _:                'building-symbolic'
    },
    highway: {
        bus_stop:         'route-transit-bus-symbolic',
        cycleway:         'route-bike-symbolic',
        footway:          'route-pedestrian-symbolic',
        pedestrian:       'route-pedestrian-symbolic',
        platform:         'route-transit-bus-symbolic',
        steps:            'route-pedestrian-symbolic',
        path:             'route-pedestrian-symbolic',
        _:                'route-car-symbolic'
    },
    leisure: {
        nature_reserve:   'tree-symbolic',
        park:             'tree-symbolic'
    },
    natural: {
        hill:             'mountain-symbolic',
        peak:             'mountain-symbolic',
        volcano:          'mountain-symbolic'
    },
    office: {
        _:                'building-symbolic'
    },
    place: {
        borough:          'city-symbolic',
        city:             'city-symbolic',
        city_block:       'building-symbolic',
        hamlet:           'town-symbolic',
        isolated_dwelling:'building-symbolic',
        neighbourhood:    'town-symbolic',
        quarter:          'town-symbolic',
        square:           'route-pedestrian-symbolic',
        suburb:           'town-symbolic',
        town:             'town-symbolic',
        village:          'town-symbolic'
    },
    railway: {
        halt:             'route-transit-train-symbolic',
        station:          'route-transit-train-symbolic',
        stop:             'route-transit-train-symbolic',
        tram_stop:        'route-transit-tram-symbolic'
    },
    shop: {
        _:                'shopping-cart-symbolic'
    },
    tourism: {
        alpine_hut:       'bed-symbolic',
        apartment:        'bed-symbolic',
        attraction:       'photo-camera-symbolic',
        artwork:          'photo-camera-symbolic',
        chalet:           'bed-symbolic',
        gallery:          'museum-symbolic',
        guest_house:      'bed-symbolic',
        hostel:           'bed-symbolic',
        hotel:            'bed-symbolic',
        information:      'explore-symbolic',
        motel:            'bed-symbolic',
        museum:           'museum-symbolic',
        picnic_site:      'bench-symbolic',
        zoo:              'penguin-symbolic'
    }
};

/**
 * Get place icon name suitable for a Place.
 */
function getIconForPlace(place) {
    return TYPE_ICON_MAP?.[place.osmKey]?.[place.osmValue] ??
           TYPE_ICON_MAP?.[place.osmKey]?.['_'] ?? 'map-marker-symbolic';
}

