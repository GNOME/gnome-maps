/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
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
 */

const JsUnit = imports.jsUnit;

import { BoundingBox } from "../src/boundingBox.js";
import { DownloadManager } from "../src/downloads.js";

pkg.initGettext();

const storage = {
    _json: null,
    load() {
        return this._json;
    },
    save(json) {
        this._json = json;
    },
};

const downloadManager = new DownloadManager({ storage });

JsUnit.assertEquals(0, downloadManager.areas.n_items);

const area = downloadManager.addArea(
    "Test area",
    new BoundingBox({
        left: -89.77878,
        top: 25.28312,
        right: -89.73751,
        bottom: 25.24605,
    })
);

JsUnit.assertEquals(1, downloadManager.areas.n_items);
JsUnit.assertEquals("1", area.id);
JsUnit.assertEquals("Test area", area.name);
_assertArrayEquals(
    [
        "0/0/0",
        "1/0/0",
        "2/1/1",
        "3/2/3",
        "4/4/6",
        "5/8/13",
        "6/16/27",
        "7/32/54",
        "8/64/109",
        "9/128/218",
        "10/256/437",
        "11/513/875",
        "12/1026/1750",
        "13/2053/3501",
        "14/4106/7002",
        "14/4106/7003",
        "14/4107/7002",
        "14/4107/7003",
    ],
    area.getTiles()["vector"]
);

function _assertArrayEquals(arr1, arr2) {
    JsUnit.assertEquals(arr1.length, arr2.length);
    for (let i = 0; i < arr1.length; i++) {
        JsUnit.assertEquals(arr1[i], arr2[i]);
    }
}
