/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2023 James Westman
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
 * Author: James Westman <james@jwestman.net>
 */

import "gi://Gtk?version=4.0";
/* Must be imported first to avoid circular dependencies */
import "../src/prototypes.js";
import "../src/application.js";

import { PlaceStore, PlaceStoreItem } from "../src/placeStore.js";
import { Place } from "../src/place.js";
import { StoredRoute } from "../src/storedRoute.js";

const JsUnit = imports.jsUnit;

const ARBITRARY_LOCATION = { latitude: 38.5, longitude: -120.2 };

pkg.initGettext();
pkg.initFormat();

class TestStorage {
    constructor(json) {
        this.json = json;
        this.saved = false;
    }

    load() {
        return this.json;
    }

    save(json) {
        this.json = JSON.parse(JSON.stringify(json));
        this.saved = true;
    }
}

testPlaceStore();
testPre46Migration();
testForwardCompatibility();
testRecentRetention();
testNoSaveDuringLoad();

function testPlaceStore() {
    const storage = new TestStorage(null);
    const store = new PlaceStore({ storage });

    JsUnit.assertEquals(0, store.n_items);

    const originalPlace = new Place({
        name: "Test",
        location: ARBITRARY_LOCATION,
        osmType: 1,
        osmId: 1,
    });

    const originalPlaceStoreItem = store.addPlace(originalPlace);
    JsUnit.assertEquals(1, store.n_items);
    JsUnit.assertEquals(originalPlace, store.get_item(0).place);

    const placeCopy = new Place({
        name: "Test",
        location: ARBITRARY_LOCATION,
        osmType: 1,
        osmId: 1,
    });
    JsUnit.assertEquals(originalPlaceStoreItem, store.getPlaceItem(placeCopy));
    JsUnit.assertEquals(originalPlace, store.get(placeCopy));

    /* Add an identical place and make sure the old one is updated */
    const addedPlace = new Place({
        name: "Test 2",
        location: ARBITRARY_LOCATION,
        osmType: 1,
        osmId: 1,
    });
    const addedPlaceStoreItem = store.addPlace(addedPlace);
    JsUnit.assertEquals(1, store.n_items);
    JsUnit.assertEquals(originalPlaceStoreItem, addedPlaceStoreItem);
    JsUnit.assertEquals(addedPlace, addedPlaceStoreItem.place);

    /* Add a different place and make sure it's added */
    const addedPlace2 = new Place({
        name: "Test",
        location: ARBITRARY_LOCATION,
        osmType: 1,
        osmId: 2,
    });
    const addedPlaceStoreItem2 = store.addPlace(addedPlace2);
    JsUnit.assertEquals(2, store.n_items);
    JsUnit.assertEquals(addedPlaceStoreItem2, store.get_item(1));
}

function testForwardCompatibility() {
    const storage = new TestStorage({
        unknownFutureMetadata: "test1",
        places: [
            {
                place: {
                    type: PlaceStoreItem.PlaceType.PLACE,
                    name: "Test",
                    location: ARBITRARY_LOCATION,
                    unknownFutureMetadata: "test2",
                },
                unknownFutureMetadata: "test3",
            },
            {
                place: {
                    type: PlaceStoreItem.PlaceType.ROUTE,
                    name: "Test",
                    route: {
                        path: "",
                        turnPoints: [],
                        unknownFutureMetadata: "test4",
                    },
                    places: [
                        {
                            type: PlaceStoreItem.PlaceType.PLACE,
                            name: "Test",
                            location: ARBITRARY_LOCATION,
                            unknownFutureMetadata: "test5",
                        },
                    ],
                    unknownFutureMetadata: "test6",
                },
                unknownFutureMetadata: "test7",
            },
            {
                place: {
                    type: PlaceStoreItem.PlaceType.ROUTE,
                    name: "test9",
                    route: {
                        path: "",
                        turnPoints: [],
                    },
                    places: [
                        {
                            type: -100,
                            name: "Test",
                            location: ARBITRARY_LOCATION,
                        },
                    ],
                },
            },
            {
                place: {
                    type: -100,
                },
                unknownFutureMetadata: "test8",
            },
        ],
    });

    const store = new PlaceStore({ storage });
    store.load();
    store.save();
    JsUnit.assertTrue(storage.saved);

    JsUnit.assertEquals("test1", storage.json.unknownFutureMetadata);
    JsUnit.assertEquals(
        "test2",
        storage.json.places[0].place.unknownFutureMetadata
    );
    JsUnit.assertEquals("test3", storage.json.places[0].unknownFutureMetadata);
    JsUnit.assertEquals(
        "test4",
        storage.json.places[1].place.route.unknownFutureMetadata
    );
    JsUnit.assertEquals(
        PlaceStoreItem.PlaceType.PLACE,
        storage.json.places[1].place.places[0].type
    );
    JsUnit.assertEquals(
        "test5",
        storage.json.places[1].place.places[0].unknownFutureMetadata
    );
    JsUnit.assertEquals(
        "test6",
        storage.json.places[1].place.unknownFutureMetadata
    );
    JsUnit.assertEquals("test7", storage.json.places[1].unknownFutureMetadata);

    JsUnit.assertEquals(-100, storage.json.places[2].place.places[0].type);

    JsUnit.assertEquals(-100, storage.json.places[3].place.type);
    JsUnit.assertEquals("test8", storage.json.places[3].unknownFutureMetadata);
}

function testPre46Migration() {
    const storage = new TestStorage([
        {
            type: 0,
            place: {
                name: "Test",
                location: ARBITRARY_LOCATION,
                id: "1",
                osm_type: 2,
                postal_code: "12345",
                country_code: "US",
                street_address: "123 Main St",
                place_type: 3,
                bounding_box: {
                    top: 1,
                    bottom: 2,
                    left: 3,
                    right: 4,
                },
            },
        },
        {
            type: 1,
            place: {
                name: "Test",
                location: ARBITRARY_LOCATION,
            },
        },
        {
            type: 2,
            place: {
                name: "Test",
                location: ARBITRARY_LOCATION,
            },
        },
        {
            type: 3,
            language: "en",
            added: 123456789,
            place: {
                route: {
                    path: [
                        { latitude: 38.5, longitude: -120.2 },
                        { latitude: 40.7, longitude: -120.95 },
                        { latitude: 43.252, longitude: -126.453 },
                    ],
                    turnPoints: [],
                },
                places: [
                    {
                        location: ARBITRARY_LOCATION,
                        id: "3",
                        osm_type: 4,
                    },
                ],
            },
        },
    ]);

    const store = new PlaceStore({ storage });
    store.load();

    store.save();
    JsUnit.assertTrue(storage.saved);

    JsUnit.assertFalse(storage.json.places[0].isFavorite);
    JsUnit.assertEquals(
        PlaceStoreItem.PlaceType.PLACE,
        storage.json.places[0].place.type
    );
    JsUnit.assertEquals("1", storage.json.places[0].place.osmId);
    JsUnit.assertEquals(2, storage.json.places[0].place.osmType);
    JsUnit.assertEquals("12345", storage.json.places[0].place.postalCode);
    JsUnit.assertEquals("US", storage.json.places[0].place.countryCode);
    JsUnit.assertEquals("123 Main St", storage.json.places[0].place.streetAddress);
    JsUnit.assertEquals(1, storage.json.places[0].place.boundingBox.top);
    JsUnit.assertEquals(3, storage.json.places[0].place.placeType);
    JsUnit.assertEquals(undefined, storage.json.places[0].id);
    JsUnit.assertEquals(undefined, storage.json.places[0].osm_type);
    JsUnit.assertEquals(undefined, storage.json.places[0].postal_code);
    JsUnit.assertEquals(undefined, storage.json.places[0].country_code);
    JsUnit.assertEquals(undefined, storage.json.places[0].street_address);
    JsUnit.assertEquals(undefined, storage.json.places[0].bounding_box);
    JsUnit.assertEquals(undefined, storage.json.places[0].place_type);

    JsUnit.assertTrue(storage.json.places[1].isFavorite);
    JsUnit.assertEquals(
        PlaceStoreItem.PlaceType.PLACE,
        storage.json.places[1].place.type
    );

    JsUnit.assertEquals(
        PlaceStoreItem.PlaceType.ROUTE,
        storage.json.places[2].place.type
    );
    JsUnit.assertEquals(undefined, storage.json.places[2].language);
    JsUnit.assertEquals(undefined, storage.json.places[2].added);
    JsUnit.assertEquals(123456789, storage.json.places[2].updated);
    JsUnit.assertEquals(3, storage.json.places[2].viewOrd);
    JsUnit.assertEquals(
        "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
        storage.json.places[2].place.route.path
    );
    JsUnit.assertEquals(
        PlaceStoreItem.PlaceType.PLACE,
        storage.json.places[2].place.places[0].type
    );
    JsUnit.assertEquals("3", storage.json.places[2].place.places[0].osmId);
    JsUnit.assertEquals(4, storage.json.places[2].place.places[0].osmType);

    JsUnit.assertEquals(3, storage.json.places.length);
}

function testRecentRetention() {
    const storage = new TestStorage(null);
    const store = new PlaceStore({
        storage,
        recentPlacesLimit: 10,
        recentRoutesLimit: 15,
    });
    store.load();

    const favoritePlace = new Place({
        name: "Test",
        location: ARBITRARY_LOCATION,
        osmType: 1,
        osmId: 1000,
    });
    const item = store.addPlace(favoritePlace);
    item.isFavorite = true;

    for (let i = 0; i < 20; i++) {
        const place = new Place({
            name: "Test",
            location: ARBITRARY_LOCATION,
            osmType: 1,
            osmId: i,
        });
        store.addPlace(place);
    }

    JsUnit.assertEquals(11, store.n_items);
    JsUnit.assertEquals(item, store.get_item(0));

    for (let i = 0; i < 30; i++) {
        const route = new StoredRoute({
            route: {
                path: [],
                turnPoints: [],
            },
            places: [
                new Place({
                    name: "Test",
                    location: ARBITRARY_LOCATION,
                    osmType: 1,
                    osmId: i,
                }),
            ],
        });
        store.addPlace(route);
    }

    JsUnit.assertEquals(26, store.n_items);
}

function testNoSaveDuringLoad() {
    const storage = {
        load() {
            return {
                places: [
                    {
                        type: PlaceStoreItem.PlaceType.ROUTE,
                        isFavorite: true,
                        place: {
                            name: "Test",
                            route: {
                                path: "",
                                turnPoints: [],
                            },
                            places: [
                                {
                                    name: "Test",
                                    location: ARBITRARY_LOCATION,
                                    osmType: 1,
                                    osmId: 1,
                                },
                            ],
                        },
                    },
                ],
            };
        },
        save() {
            throw new Error("save() called during load()");
        },
    };
    const store = new PlaceStore({ storage });
    store.load();
}
