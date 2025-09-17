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
            dark: "#deddda",
            light: "#3d3846",
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
    landuse: {
        pitch: {
            dark: "#334034",
            light: "#adccb3",
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
                dark: "#deddda",
                light: "#3d3846",
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
                dark: "#deddda",
                light: "#3d3846",
            },
            maxzoom: 13,
            sizeStops: [
                [9, 12],
                [12, 18],
            ],
        },
        {
            classes: ["neighborhood", "suburb", "quarter"],
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
        {
            classes: ["hamlet"],
            font: "Bold",
            color: {
                dark: "#c0bfbc",
                light: "#5e5c64",
            },
            maxzoom: 15,
            sizeStops: [
                [12, 12],
                [15, 18],
            ],
        },
        {
            classes: ["isolated_dwelling"],
            font: "Regular",
            color: {
                dark: "#c0bfbc",
                light: "#5e5c64",
            },
            minzoom: 15,
            sizeStops: [
                [15, 15],
            ],
        },
        {
            id: "place-island-large",
            classes: ["island"],
            font: "Italic",
            color: {
                dark: "#c8bfbc",
                light: "#5e5c64",
            },
            minzoom: 8,
            maxzoom: 12,
            maxRank: 3,
            sizeStops: [
                [6, 18],
            ],
        },
        {
            classes: ["island"],
            font: "Italic",
            color: {
                dark: "#c8bfbc",
                light: "#5e5c64",
            },
            minzoom: 13,
            maxzoom: 18,
            sizeStops: [
                [13, 18],
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
        sportIcons: {
            american_football: "football-american-symbolic",
            baseball: "baseball-symbolic",
            golf: "golf-symbolic",
            hockey: "hockey-symbolic",
            tennis: "tennis-symbolic",
            soccer: "football-symbolic",
            _: "baseball-symbolic",
        },
        tags: {
            aeroway: {
                aerodrome: ["flying-symbolic"],
            },
            aerialway: {
                station: ["gondola-symbolic", "transportation", 16],
            },
            amenity: {
                arts_centre: ["theater-symbolic", "generic"],
                atm: ["coin-symbolic", "micro", 16],
                bank: ["bank-symbolic", "generic"],
                bar: ["bar-symbolic", "food"],
                bbq: ["barbecue-symbolic", "micro", 16],
                bicycle_parking: [
                    "bicycle-parking-symbolic",
                    "transport",
                    16,
                    0.75,
                ],
                bicycle_rental: ["cycling-symbolic", "transport", 16],
                biergarten: ["pub-symbolic", "food"],
                bus_station: ["bus-symbolic", "transport"],
                cafe: ["cafe-symbolic", "food"],
                car_rental: ["driving-symbolic", "transport"],
                charging_station: ["ev-symbolic", "transport"],
                cinema: ["video-camera-symbolic", "generic"],
                clinic: ["hospital-sign-symbolic", "healthAndSafety"],
                clock: ["clock-alt-symbolic", "micro", 16],
                college: ["school-symbolic", "education"],
                conference_centre: ["meeting-symbolic", "public", 13],
                courthouse: ["license-symbolic", "public"],
                dentist: ["dentist-symbolic", "healthAndSafety"],
                doctors: ["hospital-sign-symbolic", "healthAndSafety"],
                drinking_water: ["drinking-fountain-symbolic", "micro", 16],
                fast_food: ["fast-food-symbolic", "food"],
                ferry_terminal: ["ferry-symbolic", "transport", 13],
                firepit: ["barbecue-symbolic", "micro", 16],
                fire_station: ["firefighter-symbolic", "healthAndSafety", 15],
                food_court: ["restaurant-symbolic", "food"],
                fuel: ["fuel-symbolic", "transport"],
                grave_yard: ["non-religious-cemetary-symbolic", "parks"],
                hospital: ["hospital-symbolic", "hospitals", 10],
                ice_cream: ["icecream-cone-symbolic", "food"],
                kindergarten: ["school-symbolic", "education"],
                library: ["open-book-symbolic", "public", 14],
                luggage_locker: ["briefcase-symbolic", "micro", 16],
                nightclub: ["music-note-symbolic", "generic"],
                parking: ["parking-sign-symbolic", "transport", 16, 0.75],
                pharmacy: ["pharmacy-symbolic", "healthAndSafety"],
                place_of_worship: ["circle-small-symbolic", "public", 16],
                police: ["police-badge2-symbolic", "healthAndSafety"],
                post_box: ["post-box-symbolic", "micro", 16],
                post_office: ["post-box-symbolic", "generic"],
                pub: ["pub-symbolic", "food"],
                recycling: ["recycling-bin-symbolic", "micro", 16],
                restaurant: ["restaurant-symbolic", "food"],
                school: ["school-symbolic", "education"],
                taxi: ["taxi-symbolic", "transportation", 16],
                telephone: ["phone-oldschool-symbolic", "micro", 16],
                theatre: ["theater-symbolic", "generic"],
                toilets: ["toilets-symbolic", "micro", 16],
                university: ["school-symbolic", "education", 13],
                veterinary: ["cat-symbolic", "healthAndSafety"],
                waste_basket: ["user-trash-symbolic", "micro", 16],
            },
            barrier: {
                bollard: false,
                cycle_barrier: ["gate-symbolic", "traffix", 17, 0.75],
                gate: ["gate-symbolic", "traffic", 17, 0.75],
                lift_gate: ["gate-symbolic", "traffic", 17, 0.75],
                toll_booth: ["money-symbolic", "traffic", 17, 0.75],
            },
            building: {
                railway_station: ["train-symbolic", "transport", 16],
                _: ["building-symbolic", "generic", 16],
            },
            highway: {
                bus_guideway: ["bus-symbolic", "transport", 16],
                bus_stop: ["bus-symbolic", "transport", 16],
                busway: ["bus-symbolic", "transport", 16],
                cycleway: ["cycling-symbolic", "transport", 16],
                footway: ["walking-symbolic", "transport", 16],
                pedestrian: ["walking-symbolic", "transport", 16],
                platform: ["bus-symbolic", "transport", 16],
                steps: ["steps-symbolic", "transport", 16],
                path: ["walking-symbolic", "transport", 16],
                _: ["driving-symbolic", "transport", 16],
            },
            historic: {
                monument: ["museum-symbolic", "public"],
            },
            information: {
                office: ["explore-symbolic", "micro", 14],
                visitor_centre: ["explore-symbolic", "micro", 14],
                _: ["explore-symbolic", "micro"],
            },
            landuse: {
                cemetery: ["non-religious-cemetary-symbolic", "parks"],
            },
            leisure: {
                dog_park: ["dog-symbolic", "parks"],
                fitness_centre: ["weight2-symbolic", "generic"],
                fitness_station: ["weight2-symbolic", "micro", 16],
                garden: ["leaf-symbolic", "parks", 16],
                golf_course: ["golf-symbolic", "parks", 14],
                mini_golf: ["golf-symbolic", "parks"],
                miniature_golf: ["golf-symbolic", "parks"],
                nature_reserve: ["sprout-symbolic", "parks", 10],
                park: ["tree-circle-symbolic", "parks", 10],
                pitch: ["@sport", "parks", 16],
                playground: ["playground3-symbolic", "parks", 16],
                sports_centre: ["@sport", "parks", 13],
                stadium: ["@sport", "parks", 14],
                swimming_pool: false,
            },
            natural: {
                hill: ["mountain-symbolic", "parks"],
                peak: ["mountain-symbolic", "parks"],
                volcano: ["mountain-symbolic", "parks"],
            },
            office: {
                diplomatic: ["flag-filled-symbolic", "public"],
                _: ["building-symbolic", "generic"],
            },
            place: {
                borough: ["city-symbolic"],
                city: ["city-symbolic"],
                city_block: ["building-symbolic"],
                continent: ["earth-symbolic"],
                country: ["flag-filled-symbolic"],
                hamlet: ["town-symbolic"],
                isolated_dwelling: ["building-symbolic"],
                neighbourhood: ["town-symbolic"],
                quarter: ["town-symbolic"],
                province: ["flag-outline-thick-symbolic"],
                region: ["flag-outline-thick-symbolic"],
                square: ["walking-symbolic"],
                state: ["flag-outline-thick-symbolic"],
                suburb: ["town-symbolic"],
                town: ["town-symbolic"],
                village: ["town-symbolic"],
            },
            railway: {
                halt: ["@station", "transport", 12],
                station: ["@station", "transport", 10],
                stop: ["@station", "transport", 12],
                subway_entrance: ["exit-symbolic", "transport", 16],
                train_station_entrance: ["exit-symbolic", "transport", 16],
                tram_stop: ["@station", "transport", 12],
            },
            shop: {
                alcohol: ["drinks-symbolic", "generic"],
                art: ["brush-symbolic", "generic"],
                bakery: ["bread-symbolic", "generic"],
                bicycle : ["cycling-symbolic", "generic"],
                books: ["library-symbolic", "generic"],
                car: ["driving-symbolic", "generic"],
                car_repair: ["wrench-wide-symbolic", "shop"],
                clothes: ["clothing-store-symbolic", "generic"],
                clothing: ["clothing-store-symbolic", "generic"],
                computer: ["phonelink2-symbolic", "generic"],
                convenience: ["shopping-cart-symbolic", "generic"],
                department_store: ["shop-symbolic", "generic"],
                electronics: ["phonelink2-symbolic", "generic"],
                general: ["shop-symbolic", "generic"],
                gift: ["package-x-generic-symbolic", "generic"],
                golf: ["golf-symbolic", "generic"],
                grocery: ["shopping-cart-symbolic", "generic"],
                hairdresser: ["barber-symbolic", "generic"],
                hardware: ["build-alt-symbolic", "generic"],
                ice_cream: ["icecream-cone-symbolic", "food"],
                jewelry: ["anniversary-symbolic", "generic"],
                locksmith: ["key2-symbolic", "generic"],
                mall: ["shop-symbolic", "generic", 14],
                mobile_phone: ["smartphone-symbolic", "generic"],
                music: ["headphones-symbolic", "generic"],
                newsagent: ["newspaper-symbolic", "generic"],
                optician: ["eye-open-negative-filled-symbolic", "generic"],
                pet: ["cat-symbolic", "generic"],
                photo: ["photo-camera-symbolic", "generic"],
                sports: ["@sport", "generic"],
                supermarket: ["shopping-cart-symbolic", "generic", 14],
                ticket: ["ticket-symbolic", "generic"],
                video_games: ["gamepad-symbolic", "generic"],
                wine: ["drinks-symbolic", "generic"],
                _: ["shop-symbolic", "generic"],
            },
            tourism: {
                alpine_hut: ["bed-symbolic", "lodging"],
                apartment: ["bed-symbolic", "lodging"],
                attraction: ["photo-camera-symbolic", "public"],
                artwork: ["photo-camera-symbolic", "micro"],
                butcher: ["salami-symbolic", "generic"],
                chalet: ["bed-symbolic", "lodging"],
                gallery: ["museum-symbolic", "public"],
                guest_house: ["bed-symbolic", "lodging"],
                hostel: ["bed-symbolic", "lodging"],
                hotel: ["bed-symbolic", "lodging", 14],
                information: ["explore-symbolic", "micro"],
                motel: ["bed-symbolic", "lodging"],
                museum: ["museum-symbolic", "public"],
                picnic_site: ["bench-symbolic", "micro", 16],
                viewpoint: ["photo-camera-symbolic", "public"],
                zoo: ["penguin-symbolic", "public"],
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
            classes: ["path"],
            subclass: ["platform"],
            color: {
                dark: "#483a3d",
                light: "#bebdc8",
            },
        },
        {
            classes: ["service", "track"],
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
        {
            classes: ["busway"],
            color: {
                dark: "#2b151b",
                light: "#e1aab1",
            },
            size: 1,
        },
        {
            classes: ["bus_guideway"],
            color: {
                dark: "#2b151b",
                light: "#e1aab1",
            },
            size: 1.25,
        },
    ],
    paths: {
        color: {
            dark: "#5e5c64",
            light: "#9a9996",
        },
        size: 0.2,
    },
    platforms: {
        color: {
            dark: "#483a3d",
            light: "#bebdc8",
        },
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
