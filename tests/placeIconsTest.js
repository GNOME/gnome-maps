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
const JsUnit = imports.jsUnit;

const PlaceIcons = imports.placeIcons;

/* use a minimal mock of Place, since Place throught dependencies requires
 * the GResources to be setup, so it can't easily be used from tests
 */
class MockedPlace {
    constructor(params) {
        this._osmKey = params.osmKey;
        this._osmValue = params.osmValue;
    }

    get osmKey() {
        return this._osmKey;
    }

    get osmValue() {
        return this._osmValue;
    }
}

function main() {
    testKnownTypes();
    testDefaultIcon();
}

// test some known place type → icon mappings
function testKnownTypes() {
    let p1 = new MockedPlace({ osmKey: 'amenity', osmValue: 'restaurant' });
    let p2 = new MockedPlace({ osmKey: 'place', osmValue: 'city' });
    let p3 = new MockedPlace({ osmKey: 'amenity', osmValue: 'pub' });
    let p4 = new MockedPlace({ osmKey: 'shop', osmValue: 'supermarket' });
    let p5 = new MockedPlace({ osmKey: 'shop', osmValue: 'hairdresser' });

    JsUnit.assertEquals('restaurant-symbolic', PlaceIcons.getIconForPlace(p1));
    JsUnit.assertEquals('city-symbolic', PlaceIcons.getIconForPlace(p2));
    JsUnit.assertEquals('pub-symbolic', PlaceIcons.getIconForPlace(p3));
    JsUnit.assertEquals('shopping-cart-symbolic',
                        PlaceIcons.getIconForPlace(p4));
    JsUnit.assertEquals('map-marker-symbolic', PlaceIcons.getIconForPlace(p5));
}

// test that some unknown type gets the default map marker icon
function testDefaultIcon() {
    let p1 = new MockedPlace({ osmKey: 'tourism', osmValue: 'unknown' });
    let p2 = new MockedPlace({ osmKey: 'other', osmValue: 'unknown' });
    let p3 = new MockedPlace({});

    JsUnit.assertEquals('map-marker-symbolic', PlaceIcons.getIconForPlace(p1));
    JsUnit.assertEquals('map-marker-symbolic', PlaceIcons.getIconForPlace(p2));
    JsUnit.assertEquals('map-marker-symbolic', PlaceIcons.getIconForPlace(p3));
}
