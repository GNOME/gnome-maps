/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2020 Marcus Lundblad
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

import {BoundingBox} from '../src/boundingBox.js';
import * as Constants from '../src/constants.js';

function main() {
    constructTest();
    copyTest();
    setTest();
    getCenterTest();
    composeTest();
    extendTest();
    isValidTest();
    coversTest();
}

function constructTest() {
    let bbox = new BoundingBox({ top: 60.0, left: 15.0,
                                 bottom: 59.0, right: 16.0 });

    JsUnit.assertEquals(60.0, bbox.top);
    JsUnit.assertEquals(15.0, bbox.left);
    JsUnit.assertEquals(59.0, bbox.bottom);
    JsUnit.assertEquals(16.0, bbox.right);

    // test default values
    bbox = new BoundingBox();

    JsUnit.assertEquals(Constants.MIN_LATITUDE, bbox.top);
    JsUnit.assertEquals(Constants.MAX_LONGITUDE, bbox.left);
    JsUnit.assertEquals(Constants.MAX_LATITUDE, bbox.bottom);
    JsUnit.assertEquals(Constants.MIN_LONGITUDE, bbox.right);
}

function copyTest() {
    let bbox = new BoundingBox({ top: 60.0, left: 15.0,
                                 bottom: 59.0, right: 16.0 });
    let copy = bbox.copy();

    // update original box
    bbox.top = 65.0;
    bbox.left = 16.0;
    bbox.bottom = 55.0;
    bbox.right = 17.0;

    // copy should be uneffected
    JsUnit.assertEquals(60.0, copy.top);
    JsUnit.assertEquals(15.0, copy.left);
    JsUnit.assertEquals(59.0, copy.bottom);
    JsUnit.assertEquals(16.0, copy.right);
}

function setTest() {
    let bbox = new BoundingBox();

    bbox.top = 0;
    bbox.left = 0;
    bbox.bottom = -10;
    bbox.right = 10;

    JsUnit.assertEquals(0.0, bbox.top);
    JsUnit.assertEquals(0.0, bbox.left);
    JsUnit.assertEquals(-10.0, bbox.bottom);
    JsUnit.assertEquals(10.0, bbox.right);
}

function getCenterTest() {
    let bbox = new BoundingBox({ top: 60.0, left: 15.0,
                                 bottom: 59.0, right: 16.0 });
    let center = bbox.getCenter();

    JsUnit.assertTrue(center instanceof Array);
    JsUnit.assertEquals(2, center.length);
    JsUnit.assertEquals(15.5, center[0]);
    JsUnit.assertEquals(59.5, center[1]);
}

function composeTest() {
    let bbox = new BoundingBox({ top: 60.0, left: 15.0,
                                 bottom: 59.0, right: 16.0 });
    let other = new BoundingBox({ top: 60.0, left: 14.0,
                                  bottom: 59.0, right: 15.0 });

    bbox.compose(other);

    JsUnit.assertEquals(60.0, bbox.top);
    JsUnit.assertEquals(14.0, bbox.left);
    JsUnit.assertEquals(59.0, bbox.bottom);
    JsUnit.assertEquals(16.0, bbox.right);
}

function extendTest() {
    let bbox = new BoundingBox({ top: 60.0, left: 15.0,
                                 bottom: 59.0, right: 16.0 });

    bbox.extend(58.0, 14.0);

    JsUnit.assertEquals(60.0, bbox.top);
    JsUnit.assertEquals(14.0, bbox.left);
    JsUnit.assertEquals(58.0, bbox.bottom);
    JsUnit.assertEquals(16.0, bbox.right);
}

function isValidTest() {
    let valid = new BoundingBox({ top: 60.0, left: 15.0,
                                  bottom: 59.0, right: 16.0 });

    JsUnit.assertTrue(valid.isValid());

    let unset = new BoundingBox();

    JsUnit.assertFalse(unset.isValid());

    let overflowNorth = new BoundingBox({ top: 100.0, left: 15.0,
                                          bottom: 0.0, right: 16.0 });

    JsUnit.assertFalse(overflowNorth.isValid());

    let flipped = new BoundingBox({ top: 59.0, left: 16.0,
                                    bottom: 60.0, right: 15.0 });

    JsUnit.assertFalse(flipped.isValid());
}

function coversTest() {
    let bbox = new BoundingBox({ top: 60.0, left: 15.0,
                                 bottom: 59.0, right: 16.0 });

    JsUnit.assertTrue(bbox.covers(59.5, 15.5));
    JsUnit.assertFalse(bbox.covers(0.0, 0.0));
    JsUnit.assertFalse(bbox.covers(59.0, -180.0));
}

main();
