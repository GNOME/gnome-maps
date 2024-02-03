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
import '../src/application.js';

import * as PlaceIcons from '../src/placeIcons.js';
import { Place } from '../src/place.js';

// test some known place type → icon mappings
function testKnownTypes() {
    let p1 = new Place({ osmKey: 'amenity', osmValue: 'restaurant' });
    let p2 = new Place({ osmKey: 'place', osmValue: 'city' });
    let p3 = new Place({ osmKey: 'amenity', osmValue: 'pub' });
    let p4 = new Place({ osmKey: 'shop', osmValue: 'supermarket' });
    let p5 = new Place({ osmKey: 'shop', osmValue: 'hairdresser' });

    JsUnit.assertEquals('restaurant-symbolic', PlaceIcons.getIconForPlace(p1));
    JsUnit.assertEquals('city-symbolic', PlaceIcons.getIconForPlace(p2));
    JsUnit.assertEquals('pub-symbolic', PlaceIcons.getIconForPlace(p3));
    JsUnit.assertEquals('shopping-cart-symbolic',
                        PlaceIcons.getIconForPlace(p4));
    JsUnit.assertEquals('barber-symbolic', PlaceIcons.getIconForPlace(p5));
}

// test that some unknown type gets the default map marker icon
function testDefaultIcon() {
    let p1 = new Place({ osmKey: 'tourism', osmValue: 'unknown' });
    let p2 = new Place({ osmKey: 'other', osmValue: 'unknown' });
    let p3 = new Place({});

    JsUnit.assertEquals('map-marker-symbolic', PlaceIcons.getIconForPlace(p1));
    JsUnit.assertEquals('map-marker-symbolic', PlaceIcons.getIconForPlace(p2));
    JsUnit.assertEquals('map-marker-symbolic', PlaceIcons.getIconForPlace(p3));
}

testKnownTypes();
testDefaultIcon();
