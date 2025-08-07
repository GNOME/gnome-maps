/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2023 Marcus Lundblad
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

import gettext from 'gettext';

const _ = gettext.gettext;

/**
 * Base class for POI categories.
 */
class Category  {
    constructor({ label, icon }) {
        this._label = label;
        this._icon = icon;
    }

    /**
     * Label to display for category.
     */
    get label() {
        return this._label;
    }

    /**
     * Icon name to use to represent category.
     * If nullish, use a generic location icon.
     */
    get icon() {
        return this._icon;
    }
}

/**
 * Class representing main (top-level) categories for searching for POIs.
 */
export class MainCategory extends Category {
    constructor({ subcategories, ...params} ) {
        super(params);
        this._createSubcategories(subcategories);
    }

    _createSubcategories(subcategories) {
        this._subcategories = [];

        for (let category of subcategories) {
            this._subcategories.push(new SubCategory(category));
        }
    }

    get subcategories() {
        return this._subcategories;
    }
}

/**
 * Class representing sub-categories (search categories) for POIs.
 */
export class SubCategory extends Category {
    constructor({ keyValues, deduplicate, initialSearchRadius,
                  ...params }) {
        super(params);
        this._keyValues = keyValues;
        this._deduplicate = deduplicate;
        this._initialSearchRadius = initialSearchRadius;
    }

    /**
     * Array of arrays of strings with search terms (tag=value) for Overpass
     * search query. Each element of the top level array are used as terms
     * of an or-statement in Overpass, each consisting of an expression
     * fulfilling each of the statements in the subarray.
     */
    get keyValues() {
        return this._keyValues;
    }

    /**
     * Initial search radius to use when searching for POIs of the category.
     * If nullish, use default search radius.
     */
    get initialSearchRadius() {
        return this._initialSearchRadius;
    }

    /**
     * If true, remove nearby search results with identical name and type.
     */
    get deduplicate() {
        return !!this._deduplicate;
    }
}

/**
 * Array of predefined main categories, each having:
 * label: The label to show
 * icon:  (optional) naming an icon, otherwise falls back to using the "map pin" icon
 * subcategories: being an array of definitions for subcategories under the main category.
 *
 * Each subcategory entry has:
 *
 * label: The label to show for the subcategory
 * icon: (optional) naming an icon, otherwise falls back to using the "map pin" icon
 * keyValues: search parameters for the subcategory (see SubCategory::keyValues above)
 * deduplicate: (optional) boolean, if true, nearby duplicates (using same name, or no name)
 *              will be removed (useful for things like post boxes that can be
 *              clustered).
 * initialSearchRadius: (optional) initial search radius used for the Overpass
 *                      query, if not set use default 1000 m. If not enough
 *                      results where found, a second search with this radius * 10
 *                      is performed.
 */
const POI_CATEGORIES = [
    {
        label: _("Amenities"),
        subcategories: [
            {
                label:       _("ATMs"),
                icon:        'coin-symbolic',
                keyValues:   [['amenity=atm']],
                deduplicate: true
            },
            {
                label:       _("Post Boxes"),
                icon:        'post-box-symbolic',
                keyValues:   [['amenity=post_box']],
                deduplicate: true
            },
            {
                label:       _("Post Offices"),
                icon:        'post-box-symbolic',
                keyValues:   [['amenity=post_office']],
                initialSearchRadius: 3000
            },
            {
                label:       _("Police"),
                icon:        'police-badge2-symbolic',
                keyValues:   [['amenity=police']],
                initialSearchRadius: 10000
            },
            {
                label:       _("Libraries"),
                icon:        'open-book-symbolic',
                keyValues:   [['amenity=library']],
                initialSearchRadius: 3000
            },
            {
                label:       _("Pharmacies"),
                icon:        'pharmacy-symbolic',
                keyValues:   [['amenity=pharmacy']],
                initialSearchRadius: 3000
            },
            {
                label:       _("Recycling"),
                icon:        'recycling-bin-symbolic',
                keyValues:   [['amenity=recycling']]
            },
            {
                label:       _("Toilets"),
                icon:        'toilets-symbolic',
                keyValues:   [['amenity=toilets']],
                deduplicate: true
            },
            {
                label:       _("Wheelchair-accessible Toilets"),
                icon:        'wheelchair-symbolic',
                keyValues:   [['amenity=toilets', 'wheelchair=yes']],
                deduplicate: true
            },
            {
                label:       _("Baggage Lockers"),
                icon:        'briefcase-symbolic',
                keyValues:   [['amenity=baggage_locker']],
                deduplicate: true
            }
        ]
    },
    {
        label: _("Eating & Drinking"),
        icon:  'restaurant-symbolic',
        subcategories: [
            {
                label:     _("Restaurants"),
                icon:      'restaurant-symbolic',
                keyValues: [['amenity=restaurant']]
            },
            {
                label:       _("Vegan & Vegetarian Restaurants"),
                icon:        'restaurant-symbolic',
                keyValues:   [['amenity=restaurant', '"diet:vegan"~"yes|only"'],
                              ['amenity=restaurant', '"diet:vegetarian"~"yes|only"']],
                deduplicate: true
            },
            {
                label:     _("Fast Food"),
                icon:      'fast-food-symbolic',
                keyValues: [['amenity=fast_food']]
            },
            {
                label:     _("Food Courts"),
                icon:      'restaurant-symbolic',
                keyValues: [['amenity=food_court']]
            },
            {
                label:     _("Pubs"),
                icon:      'pub-symbolic',
                keyValues: [['amenity=pub'],
                            ['amenity=biergarten']]
            },
            {
                label:     _("Bars"),
                icon:      'bar-symbolic',
                keyValues: [['amenity=bar']]
            },
            {
                label:     _("Cafes"),
                icon:      'cafe-symbolic',
                keyValues: [['amenity=cafe']]
            },
            {
                label:     _("Ice Cream"),
                icon:      'icecream-cone-symbolic',
                keyValues: [['amenity=ice_cream']]
            },
            {
                label:     _("Food, Snacks, and Beverage Machines"),
                keyValues: [['amenity=vending_machine',
                             '"vending"~"food|sweets|drinks|coffee"']],
                deduplicate: true
            }
        ]
    },
    {
        label: _("Shopping"),
        icon:  'shop-symbolic',
        subcategories: [
             {
                label:               _("Supermarkets"),
                icon:                'shopping-cart-symbolic',
                keyValues:           [['shop=supermarket']],
                initialSearchRadius: 3000
             },
             {
                label:               _("Convenience Stores"),
                icon:                'shopping-cart-symbolic',
                keyValues:           [['shop=convenience']]
             },
             {
                label:               _("Shopping Malls"),
                icon:                'shopping-cart-symbolic',
                keyValues:           [['shop=mall']],
                initialSearchRadius: 3000
             },
             {
                label:               _("Clothes"),
                icon:                'clothing-store-symbolic',
                keyValues:           [['shop=clothes']],
                initialSearchRadius: 3000
             },
             {
                label:               _("Shoes"),
                keyValues:           [['shop=shoes']],
                initialSearchRadius: 3000
             },
             {
                label:               _("Electronics"),
                icon:                'smartphone-symbolic',
                keyValues:           [['shop=electronics']],
                initialSearchRadius: 3000
             },
             {
                label:               _("Alcohol"),
                icon:                'drinks-symbolic',
                keyValues:           [['shop=alcohol']],
                initialSearchRadius: 3000
             },
             {
                label:               _("Bakeries"),
                icon:                'bread-symbolic',
                keyValues:           [['shop=bakery']],
                initialSearchRadius: 3000
             },
             {
                label:               _("Flowers"),
                keyValues:           [['shop=florist']],
                initialSearchRadius: 3000
             },
             {
                label:               _("Gifts"),
                icon:                'package-x-generic-symbolic',
                keyValues:           [['shop=gift']],
                initialSearchRadius: 3000
             }
        ]
    },
    {
        label: _("Transportation"),
        icon:  'route-button-symbolic',
        subcategories: [
            {
                label:       _("Bus & Tram Stops"),
                icon:        'bus-symbolic',
                keyValues:   [['highway=bus_stop'],
                              ['railway=tram_stop'],
                              ['railway=station', 'station=light_rail']],
                deduplicate: true
            },
            {
                label:       _("Train & Subway Stations"),
                icon:        'train-symbolic',
                keyValues:   [['railway=station', 'station!=light_rail'],
                              ['railway=halt']],
                deduplicate: true,
                initialSearchRadius: 5000
            },
            {
                label:     _("Tickets"),
                icon:      'ticket-symbolic',
                keyValues: [['shop=ticket'],
                            ['amenity=vending_machine',
                             'vending=public_transport_tickets']],
                deduplicate: true
            },
            {
                label:     _("Parking"),
                icon:      'parking-sign-symbolic',
                keyValues: [['amenity=parking', 'access!=private']]
            },
            {
                label:     _("Bicycle Parking"),
                icon:      'bicycle-parking-symbolic',
                keyValues: [['amenity=bicycle_parking']]
            },
            {
                label:     _("Bicycle Rental"),
                icon:      'cycling-symbolic',
                keyValues: [['amenity=bicycle_rental']]
            },
            {
                label:     _("Car Rental"),
                icon:      'driving-symbolic',
                keyValues: [['amenity=car_rental']]
            },
            {
                label:     _("Fuel"),
                icon:      'fuel-symbolic',
                keyValues: [['amenity=fuel']]
            },
            {
                label:       _("EV Charging"),
                icon:        'ev-symbolic',
                keyValues:   [['amenity=charging_station']],
                deduplicate: true
            }
        ]
    },
    {
        label: _("Healthcare"),
        icon:  'hospital-sign-symbolic',
        subcategories: [
            {
                label:     _("Clinics"),
                icon:      'doctor-symbolic',
                keyValues: [['amenity=clinic']],
                initialSearchRadius: 3000
            },
            {
                label:     _("Hospitals"),
                icon:      'hospital-symbolic',
                keyValues: [['amenity=hospital']],
                initialSearchRadius: 10000
            },
            {
                label:     _("Dentists"),
                icon:      'dentist-symbolic',
                keyValues: [['amenity=dentist']],
                initialSearchRadius: 3000
            }
        ]
    },
    {
        label: _("Accommodation"),
        icon:  'bed-symbolic',
        subcategories: [
            {
                label: _("Hotels"),
                icon:  'bed-symbolic',
                keyValues: [['tourism=hotel']]
            },
            {
                label: _("Hostels"),
                icon:  'bed-symbolic',
                keyValues: [['tourism=hostel']]
            },
            {
                label: _("Bed & Breakfast"),
                icon:  'bed-symbolic',
                keyValues: [['tourism=guest_house']]
            },
            {
                label: _("Campings"),
                keyValues: [['tourism=camp_site']],
                initialSearchRadius: 10000
            }
        ]
    },
    {
        label: _("Recreation"),
        icon:  'sentiment-satisfied-symbolic',
        subcategories: [
            {
                label:     _("Parks"),
                icon:      'tree-circle-symbolic',
                keyValues: [['leisure=park']]
            },
            {
                label:     _("Playgrounds"),
                icon:      'playground3-symbolic',
                keyValues: [['leisure=playground']]
            },
            {
                label:     _("Beaches"),
                keyValues: [['natural=beach']],
                initialSearchRadius: 3000
            },
            {
                label:     _("Nature Reserves"),
                icon:      'sprout-symbolic',
                keyValues: [['leisure=nature_reserve']],
                initialSearchRadius: 10000
            },
            {
                label:     _("Theme Parks"),
                keyValues: [['tourism=theme_park']],
                intialSearchRadius: 10000
            },
            {
                label:     _("Theaters"),
                icon:      'theater-symbolic',
                keyValues: [['amenity=theatre']],
                initialSearchRadius: 3000
            },
            {
                label:     _("Movie Theaters"),
                icon:      'video-camera-symbolic',
                keyValues: [['amenity=cinema']],
                initialSearchRadius: 3000
            },
            {
                label:     _("Night Clubs"),
                icon:      'music-note-symbolic',
                keyValues: [['amenity=nightclub']]
            }
        ]
    },
    {
        label: _("Tourism"),
        icon:  'photo-camera-symbolic',
        subcategories: [
            {
                label:               _("Museums"),
                icon:                'museum-symbolic',
                keyValues:           [['tourism=museum']],
                initialSearchRadius: 3000
            },
            {
                label:  _("Attractions"),
                icon:   'photo-camera-symbolic',
                keyValues: [['tourism=attraction']]
            },
            {
                label:  _("Artworks"),
                icon:   'photo-camera-symbolic',
                keyValues: [['tourism=artwork']]
            },
            {
                label: _("Tourist Information"),
                icon:  'explore-symbolic',
                keyValues: [['tourism=information']]
            }
        ]
    },
    {
        label: _("Sports"),
        icon:  'baseball-symbolic',
        subcategories: [
            {
                label:     _("Gyms"),
                icon:      'weight2-symbolic',
                keyValues: [['leisure=fitness_centre']],
                initialSearchRadius: 3000
            },
            {
                label:     _("Outdoor Gyms"),
                icon:      'weight2-symbolic',
                keyValues: [['leisure=fitness_station']],
                initialSearchRadius: 3000
            },
            {
                label:     _("Golf Courses"),
                icon:      'golf-symbolic',
                keyValues: [['leisure=golf_course']],
                initialSearchRadius: 10000
            }
        ]
    }
];

export function getCategoryStructure() {
    let result = [];

    for (let mainCategory of POI_CATEGORIES) {
        result.push(new MainCategory(mainCategory));
    }

    return result;
}

