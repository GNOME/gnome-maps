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

pkg.require({ 'Gdk':  '3.0',
              'Gtk':  '3.0',
              'Soup': '2.4' });

const Wikipedia = imports.wikipedia;

function main() {
    isValidWikipediaTest();
}

function isValidWikipediaTest() {
    // valid references
    JsUnit.assertTrue(Wikipedia.isValidWikipedia('en:Test article'));
    JsUnit.assertTrue(Wikipedia.isValidWikipedia('en:Test article:with colon'));
    JsUnit.assertTrue(Wikipedia.isValidWikipedia('arz:ويكيبيديا مصرى'));
    JsUnit.assertTrue(Wikipedia.isValidWikipedia('simple:Article'));
    JsUnit.assertTrue(Wikipedia.isValidWikipedia('zh-yue:粵文維基百科'));

    // invalid references
    JsUnit.assertFalse(Wikipedia.isValidWikipedia('https://en.wikipedia.org/wiki/Article'));
    JsUnit.assertFalse(Wikipedia.isValidWikipedia('Article with no edition'));
}
