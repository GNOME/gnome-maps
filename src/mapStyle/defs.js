/*
 * Copyright (C) 2023 James Westman <james@jwestman.net>
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, see <https://www.gnu.org/licenses/>.
 */

export const DEFS = {
    minLayer: -5,
    maxLayer: 5,
    airports: {
        symbolColor: {
            dark: "#ae78bf",
            light: "#9100bd",
        },
        runwayColor: {
            dark: "#2d2832",
            light: "#d7cddc",
        },
    },
    buildings: {
        dark: "#464646",
        light: "#b4b4b4",
    },
    colors: {
        background: {
            dark: "#191a19",
            light: "#deddda",
        },
        foreground: {
            dark: "#ffffff",
            light: "#000000",
        },
        water: {
            dark: "#0f2f5e",
            light: "#99c1f1",
        },
        boundary: {
            dark: "#c0bfbc",
            light: "#77767b",
        },
        onewayArrow: {
            dark: "#ffffff",
            light: "#000000",
        },
    },
    boundaryWidths: {
        /* See <https://wiki.openstreetmap.org/wiki/Tag:boundary%253Dadministrative>
           for more information on admin levels. */
        /* Countries */
        2: 1.5,
        /* Major, generally semi-autonomous regions of countries */
        3: 1,
        /* States, provinces, etc. */
        4: 0.8,
        /* Counties, cities, etc. based on country */
        5: 0.5,
        6: 0.4,
        7: 0.3,
        8: 0.2,
    },
    housenumbers: {
        dark: "#9a9996",
        light: "#77767b",
    },
    landcover: {
        farmland: {
            dark: "#262419",
            light: "#e8e7d0",
        },
        ice: {
            dark: "#232431",
            light: "#e2e1ff",
        },
        grass: {
            dark: "#334034",
            light: "#adccb3",
        },
        wetland: {
            dark: "#1e2627",
            light: "#ccd9d7",
        },
        wood: {
            dark: "#29342a",
            light: "#a3c2a9",
        },
        rock: {
            dark: "#232423",
            light: "#d4d3d0",
        },
        sand: {
            dark: "#2f281e",
            light: "#f2e3cb",
        },
    },
    places: [
        {
            classes: ["continent"],
            font: "Light",
            color: {
                dark: "#deddda",
                light: "#3d3846",
            },
            maxzoom: 2,
            sizeStops: [
                [0, 18],
                [1, 24],
            ],
        },
        {
            classes: ["country"],
            font: "Extrabold",
            color: {
                dark: "#deddda",
                light: "#3d3846",
            },
            maxzoom: 6,
            sizeStops: [
                [1, 14],
                [3, 16],
                [4, 20],
                [5, 24],
                [6, 28],
            ],
        },
        {
            classes: ["state", "province"],
            font: "Bold",
            color: {
                dark: "#c0bfbc",
                light: "#5e5c64",
            },
            minzoom: 4,
            maxzoom: 8,
            textTransform: "uppercase",
            sizeStops: [
                [4, 14],
                [6, 20],
            ],
        },
        {
            classes: ["city"],
            font: "Bold",
            color: {
                dark: "#ffffff",
                light: "#000000",
            },
            minzoom: 4,
            maxzoom: 12,
            sizeStops: [
                [4, 10],
                [6, 16],
                [12, 24],
            ],
        },
        {
            classes: ["town", "village"],
            font: "Bold",
            color: {
                dark: "#ffffff",
                light: "#000000",
            },
            maxzoom: 13,
            sizeStops: [
                [9, 12],
                [12, 18],
            ],
        },
        {
            classes: ["neighborhood", "hamlet", "suburb", "quarter"],
            font: "Bold",
            color: {
                dark: "#c0bfbc",
                light: "#5e5c64",
            },
            maxzoom: 15,
            textTransform: "uppercase",
            sizeStops: [
                [12, 12],
                [15, 18],
            ],
        },
    ],
    pois: {
        colors: {
            education: {
                dark: "#d7c300",
                light: "#807620",
            },
            food: {
                dark: "#d78c00",
                light: "#bf7b00",
            },
            generic: {
                dark: "#00bebe",
                light: "#007f7f",
            },
            healthAndSafety: {
                dark: "#ee9696",
                light: "#b25a5a",
            },
            hospitals: {
                dark: "#ed2f2f",
                light: "#b12323",
            },
            lodging: {
                dark: "#ff4de3",
                light: "#980081",
            },
            micro: {
                dark: "#6eeebe",
                light: "#32b282",
            },
            parks: {
                dark: "#00d700",
                light: "#007f00",
            },
            public: {
                dark: "#cca266",
                light: "#804b00",
            },
            traffic: {
                dark: "#ffffff",
                light: "#000000",
            },
            transport: {
                dark: "#8c8cdf",
                light: "#5050b2",
            },
        },
        classes: {
            alcohol_shop: {
                _: {
                    icon: "drinks-symbolic",
                    minzoom: 15,
                    category: "generic",
                    tag: "shop",
                },
            },
            art_gallery: {
                art: {
                    icon: "brush-symbolic",
                    minzoom: 15,
                    category: "generic",
                    tag: "shop",
                },
                arts_centre: {
                    icon: "theater-symbolic",
                    minzoom: 15,
                    category: "generic",
                    tag: "amenity",
                },
                artwork: {
                    icon: "photo-camera-symbolic",
                    minzoom: 15,
                    category: "micro",
                    tag: "tourism",
                },
                gallery: {
                    icon: "museum-symbolic",
                    minzoom: 15,
                    category: "public",
                    tag: "tourism",
                },
            },
            atm: {
                _: {
                    icon: "coin-symbolic",
                    minzoom: 16,
                    category: "micro",
                    tag: "amenity",
                },
            },
            attraction: {
                attraction: {
                    icon: "photo-camera-symbolic",
                    minzoom: 15,
                    category: "public",
                    tag: "tourism",
                },
                viewpoint: {
                    icon: "photo-camera-symbolic",
                    minzoom: 15,
                    category: "public",
                    tag: "tourism",
                },
            },
            bakery: {
                _: {
                    icon: "loaf-symbolic",
                    minzoom: 15,
                    category: "generic",
                    tag: "shop",
                },
            },
            bank: {
                _: {
                    icon: "bank-symbolic",
                    minzoom: 15,
                    category: "generic",
                    tag: "amenity",
                },
            },
            bar: {
                _: {
                    icon: "pub-symbolic",
                    minzoom: 15,
                    category: "food",
                    tag: "amenity",
                },
            },
            beer: {
                _: {
                    icon: "pub-symbolic",
                    minzoom: 15,
                    category: "food",
                    tag: "amenity",
                },
            },
            bicycle_parking: {
                _: {
                    icon: "bicycle-parking-symbolic",
                    minzoom: 16,
                    category: "transport",
                    size: 0.75,
                    tag: "amenity",
                },
            },
            bicycle_rental: {
                _: {
                    icon: "cycling-symbolic",
                    minzoom: 16,
                    category: "transport",
                    tag: "amenity",
                },
            },
            bollard: {
                _: {
                    skip: true,
                },
            },
            bus: {
                bus_stop: {
                    icon: "route-transit-bus-symbolic",
                    minzoom: 16,
                    category: "transport",
                    tag: "highway",
                },
                bus_station: {
                    icon: "route-transit-bus-symbolic",
                    minzoom: 15,
                    category: "transport",
                    tag: "amenity",
                },
            },
            butcher: {
                _: {
                    icon: "salami-symbolic",
                    minzoom: 15,
                    category: "generic",
                    tag: "shop",
                },
            },
            cafe: {
                _: {
                    icon: "cafe-symbolic",
                    minzoom: 15,
                    category: "food",
                    tag: "amenity",
                },
            },
            car: {
                car_repair: {
                    icon: "wrench-wide-symbolic",
                    tag: "shop",
                },
                _: {
                    icon: "driving-symbolic",
                    minzoom: 15,
                    category: "generic",
                },
            },
            car_rental: {
                _: {
                    icon: "route-car-symbolic",
                    minzoom: 15,
                    category: "transport",
                    tag: "amenity",
                },
            },
            cemetery: {
                grave_yard: {
                    icon: "non-religious-cemetary-symbolic",
                    minzoom: 15,
                    category: "parks",
                    tag: "amenity",
                },
                cemetery: {
                    icon: "non-religious-cemetary-symbolic",
                    minzoom: 15,
                    category: "parks",
                    tag: "landuse",
                },
            },
            cinema: {
                _: {
                    icon: "video-camera-symbolic",
                    minzoom: 15,
                    category: "generic",
                    tag: "amenity",
                },
            },
            clinic: {
                _: {
                    icon: "hospital-sign-symbolic",
                    minzoom: 15,
                    category: "healthAndSafety",
                    tag: "amenity",
                },
            },
            clothing_store: {
                _: {
                    icon: "clothing-store-symbolic",
                    minzoom: 15,
                    category: "generic",
                    tag: "shop",
                },
            },
            college: {
                university: {
                    icon: "school-symbolic",
                    minzoom: 13,
                    category: "education",
                    tag: "amenity",
                },
                college: {
                    icon: "school-symbolic",
                    minzoom: 15,
                    category: "education",
                    tag: "amenity",
                },
            },
            conference_centre: {
                _: {
                    icon: "meeting-symbolic",
                    minzoom: 13,
                    category: "public",
                    tag: "amenity",
                },
            },
            dentist: {
                _: {
                    icon: "dentist-symbolic",
                    minzoom: 15,
                    category: "healthAndSafety",
                    tag: "amenity",
                },
            },
            doctors: {
                _: {
                    icon: "hospital-sign-symbolic",
                    minzoom: 15,
                    category: "healthAndSafety",
                    tag: "amenity",
                },
            },
            dog_park: {
                _: {
                    icon: "dog-symbolic",
                    minzoom: 15,
                    category: "parks",
                    tag: "leisure",
                },
            },
            drinking_water: {
                _: {
                    icon: "drinking-fountain-symbolic",
                    minzoom: 16,
                    category: "micro",
                    tag: "amenity",
                },
            },
            fast_food: {
                fast_food: {
                    icon: "fast-food-symbolic",
                    minzoom: 15,
                    category: "food",
                    tag: "amenity",
                },
                food_court: {
                    icon: "restaurant-symbolic",
                    minzoom: 15,
                    category: "food",
                    tag: "amenity",
                },
            },
            ferry_terminal: {
                _: {
                    icon: "ferry-symbolic",
                    minzoom: 13,
                    category: "transport",
                    tag: "amenity",
                },
            },
            fire_station: {
                _: {
                    icon: "firefighter-symbolic",
                    minzoom: 15,
                    category: "healthAndSafety",
                    tag: "amenity",
                },
            },
            firepit: {
                _: {
                    icon: "barbecue-symbolic",
                    minzoom: 16,
                    category: "micro",
                    tag: "leisure",
                },
            },
            fitness_centre: {
                _: {
                    icon: "weight2-symbolic",
                    minzoom: 15,
                    category: "generic",
                    tag: "leisure",
                },
            },
            fitness_station: {
                _: {
                    icon: "weight2-symbolic",
                    minzoom: 16,
                    category: "micro",
                    tag: "leisure",
                },
            },
            fuel: {
                charging_station: {
                    icon: "electric-car-symbolic",
                },
                fuel: {
                    icon: "fuel-symbolic",
                    minzoom: 15,
                    category: "transport",
                },
            },
            grocery: {
                department_store: {
                    icon: "shop-symbolic",
                    minzoom: 15,
                    category: "generic",
                    tag: "shop",
                },
                supermarket: {
                    icon: "shopping-cart-symbolic",
                    minzoom: 14,
                    category: "generic",
                    tag: "shop",
                },
            },
            hospital: {
                hospital: {
                    icon: "hospital-sign-symbolic",
                    minzoom: 10,
                    category: "hospitals",
                    tag: "amenity",
                },
                _: {
                    icon: "doctor-symbolic",
                    minzoom: 15,
                    category: "healthAndSafety",
                },
            },
            library: {
                books: {
                    icon: "library-symbolic",
                    minzoom: 15,
                    category: "generic",
                    tag: "shop",
                },
                library: {
                    icon: "open-book-symbolic",
                    minzoom: 14,
                    category: "public",
                    tag: "amenity",
                },
            },
            lodging: {
                alpine_hut: {
                    minzoom: 15,
                },
                chalet: {
                    minzoom: 15,
                },
                dormitory: {
                    minzoom: 15,
                    tag: "building",
                },
                guest_house: {
                    minzoom: 15,
                },
                _: {
                    icon: "bed-symbolic",
                    minzoom: 14,
                    category: "lodging",
                    tag: "tourism",
                },
            },
            office: {
                diplomatic: {
                    icon: "flag-filled-symbolic",
                    minzoom: 15,
                    category: "public",
                },
                _: {
                    icon: "circle-small-symbolic",
                    minzoom: 15,
                    category: "generic",
                },
            },
            park: {
                bbq: {
                    icon: "barbecue-symbolic",
                    minzoom: 16,
                    category: "micro",
                },
                park: {
                    icon: "tree-symbolic",
                    minzoom: 10,
                    category: "parks",
                },
            },
            pitch: {
                american_football: {
                    icon: "football-american-symbolic",
                },
                golf: {
                    icon: "golf-symbolic",
                },
                hockey: {
                    icon: "hockey-symbolic",
                },
                tennis: {
                    icon: "tennis-symbolic",
                },
                soccer: {
                    icon: "football-symbolic",
                },
                _: {
                    icon: "baseball-symbolic",
                    minzoom: 16,
                    category: "parks",
                    tag: "leisure",
                },
            },
            post: {
                post_box: {
                    icon: "post-box-symbolic",
                    minzoom: 16,
                    category: "micro",
                    tag: "amenity",
                },
                post_office: {
                    icon: "post-box-symbolic",
                    minzoom: 15,
                    category: "generic",
                    tag: "amenity",
                },
            },
            railway: {
                station: {
                    icon: "train-symbolic",
                    minzoom: 16,
                    category: "transport",
                    tag: "railway",
                },
                tram_stop: {
                    icon: "tram-symbolic",
                    minzoom: 16,
                    category: "transport",
                    tag: "railway",
                },
            },
            school: {
                kindergarten: {
                    icon: "school-symbolic",
                    minzoom: 15,
                    category: "education",
                    tag: "amenity",
                },
                school: {
                    icon: "school-symbolic",
                    minzoom: 15,
                    category: "education",
                    tag: "amenity",
                },
            },
            shop: {
                alcohol: {
                    icon: "drinks-symbolic",
                },
                computer: {
                    icon: "phonelink2-symbolic",
                },
                convenience: {
                    icon: "shopping-cart-symbolic",
                },
                department_store: {
                    icon: "shop-symbolic",
                },
                electronics: {
                    icon: "phonelink2-symbolic",
                },
                general: {
                    icon: "shop-symbolic",
                },
                golf: {
                    icon: "golf-symbolic",
                },
                mall: {
                    icon: "shop-symbolic",
                    minzoom: 14,
                },
                ice_cream: {
                    icon: "icecream-cone-symbolic",
                    minzoom: 15,
                    category: "food",
                    tag: "amenity",
                },
                mobile_phone: {
                    icon: "smartphone-symbolic",
                },
                newsagent: {
                    icon: "newspaper-symbolic",
                },
                optician: {
                    icon: "eye-open-negative-filled-symbolic",
                },
                pet: {
                    icon: "cat-symbolic",
                },
                sports: {
                    icon: "baseball-symbolic",
                },
                supermarket: {
                    icon: "shopping-cart-symbolic",
                    minzoom: 14,
                },
                ticket: {
                    icon: "ticket-special-symbolic",
                },
                video_games: {
                    icon: "gamepad-symbolic",
                },
                wine: {
                    icon: "wine-glass",
                },
                _: {
                    icon: "shop-symbolic",
                    minzoom: 15,
                    category: "generic",
                    tag: "shop",
                },
            },
            stadium: {
                american_football: {
                    icon: "football-american-symbolic",
                },
                golf: {
                    icon: "golf-symbolic",
                },
                hockey: {
                    icon: "hockey-symbolic",
                },
                soccer: {
                    icon: "football-symbolic",
                },
                tennis: {
                    icon: "tennis-symbolic",
                },
                _: {
                    icon: "baseball-symbolic",
                    minzoom: 14,
                    category: "parks",
                    tag: "leisure",
                },
            },
            sports_centre: {
                american_football: {
                    icon: "football-american-symbolic",
                },
                golf: {
                    icon: "golf-symbolic",
                },
                hockey: {
                    icon: "hockey-symbolic",
                },
                tennis: {
                    icon: "tennis-symbolic",
                },
                soccer: {
                    icon: "football-symbolic",
                },
                _: {
                    icon: "baseball-symbolic",
                    minzoom: 14,
                    category: "generic",
                    tag: "leisure",
                },
            },
            garden: {
                _: {
                    icon: "circle-small-symbolic",
                    minzoom: 15,
                    category: "parks",
                    tag: "leisure",
                },
            },
            gate: {
                _: {
                    icon: "gate-symbolic",
                    minzoom: 16,
                    category: "traffic",
                    size: 0.75,
                    tag: "barrier",
                },
            },
            golf: {
                golf: {
                    icon: "golf-symbolic",
                    minzoom: 15,
                    category: "generic",
                    tag: "shop",
                },
                golf_course: {
                    icon: "golf-symbolic",
                    minzoom: 14,
                    category: "parks",
                    tag: "leisure",
                },
                miniature_golf: {
                    icon: "golf-symbolic",
                    minzoom: 16,
                    category: "parks",
                    tag: "leisure",
                },
            },
            hairdresser: {
                _: {
                    icon: "barber-symbolic",
                    minzoom: 15,
                    category: "generic",
                    tag: "shop",
                },
            },
            information: {
                office: {
                    minzoom: 14,
                },
                visitor_centre: {
                    minzoom: 14,
                },
                _: {
                    icon: "explore-symbolic",
                    minzoom: 15,
                    category: "micro",
                    tag: "information",
                },
            },
            lift_gate: {
                _: {
                    icon: "gate-symbolic",
                    minzoom: 16,
                    category: "traffic",
                    size: 0.75,
                    tag: "barrier",
                },
            },
            luggage_locker: {
                _: {
                    icon: "briefcase-symbolic",
                    minzoom: 16,
                    category: "micro",
                    tag: "amenity",
                },
            },
            monument: {
                _: {
                    icon: "museum-symbolic",
                    minzoom: 15,
                    category: "public",
                    tag: "historic",
                },
            },
            museum: {
                _: {
                    icon: "museum-symbolic",
                    minzoom: 15,
                    category: "public",
                    tag: "tourism",
                },
            },
            nature_reserve: {
                _: {
                    icon: "tree-symbolic",
                    minzoom: 10,
                    category: "parks",
                    tag: "leisure",
                },
            },
            parking: {
                _: {
                    icon: "parking-sign-symbolic",
                    minzoom: 16,
                    category: "transport",
                    size: 0.75,
                    tag: "amenity",
                },
            },
            pharmacy: {
                _: {
                    icon: "pharmacy-symbolic",
                    minzoom: 15,
                    category: "healthAndSafety",
                    tag: "amenity",
                },
            },
            picnic_site: {
                _: {
                    icon: "bench-symbolic",
                    minzoom: 16,
                    category: "micro",
                    tag: "tourism",
                },
            },
            place_of_worship: {
                _: {
                    icon: "circle-small-symbolic",
                    minzoom: 16,
                    category: "public",
                    tag: "amenity",
                },
            },
            police: {
                _: {
                    icon: "police-badge2-symbolic",
                    minzoom: 15,
                    category: "healthAndSafety",
                    tag: "amenity",
                },
            },
            recycling: {
                _: {
                    icon: "recycling-bin-symbolic",
                    minzoom: 16,
                    category: "micro",
                    tag: "amenity",
                },
            },
            restaurant: {
                _: {
                    icon: "restaurant-symbolic",
                    minzoom: 15,
                    category: "food",
                    tag: "amenity",
                },
            },
            theatre: {
                _: {
                    icon: "theater-symbolic",
                    minzoom: 15,
                    category: "generic",
                    tag: "amenity",
                },
            },
            toilets: {
                _: {
                    icon: "toilets-symbolic",
                    minzoom: 16,
                    category: "micro",
                    tag: "amenity",
                },
            },
            veterinary: {
                _: {
                    icon: "cat-symbolic",
                    minzoom: 15,
                    category: "healthAndSafety",
                    tag: "amenity",
                },
            },
        },
    },
    roads: [
        {
            classes: ["path"],
            subclass: ["pedestrian"],
            color: {
                dark: "#25242a",
                light: "#bebdc8",
            },
            size: 0.75,
        },
        {
            classes: ["service"],
            color: {
                dark: "#2a2924",
                light: "#c8c7b4",
            },
            size: 0.5,
            casingMinZoom: {
                dark: 14,
                light: undefined,
            },
            casingScale: 0.4,
        },
        {
            classes: ["tertiary", "minor"],
            color: {
                dark: "#413f39",
                light: "#d7d2bc",
            },
            casingMinZoom: {
                dark: 14,
                light: undefined,
            },
        },
        {
            classes: ["secondary"],
            color: {
                dark: "#453324",
                light: "#ebd68a",
            },
            size: 1.5,
        },
        {
            classes: ["trunk", "primary"],
            color: {
                dark: "#493727",
                light: "#e9cf75",
            },
            size: 1.75,
        },
        {
            classes: ["motorway"],
            color: {
                dark: "#58422e",
                light: "#e1c172",
            },
            size: 2,
        },
    ],
    paths: {
        color: {
            dark: "#5e5c64",
            light: "#9a9996",
        },
        size: 0.2,
    },
    rail: {
        color: {
            dark: "#91747b",
            light: "#c89299",
        },
    },
    aerial: {
        color: {
            dark: "#91747b",
            light: "#c89299",
        },
    },
};
