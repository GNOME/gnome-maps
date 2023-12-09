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

import 'gi://Gdk?version=4.0';
import 'gi://Gtk?version=4.0';
import 'gi://Soup?version=3.0';

import * as Wikipedia from '../src/wikipedia.js';

const JsUnit = imports.jsUnit;


// valid references
JsUnit.assertTrue(Wikipedia.isValidWikipedia('en:Test article'));
JsUnit.assertTrue(Wikipedia.isValidWikipedia('en:Test article:with colon'));
JsUnit.assertTrue(Wikipedia.isValidWikipedia('arz:ويكيبيديا مصرى'));
JsUnit.assertTrue(Wikipedia.isValidWikipedia('simple:Article'));
JsUnit.assertTrue(Wikipedia.isValidWikipedia('zh-yue:粵文維基百科'));

// invalid references
JsUnit.assertFalse(Wikipedia.isValidWikipedia('https://en.wikipedia.org/wiki/Article'));
JsUnit.assertFalse(Wikipedia.isValidWikipedia('Article with no edition'));

// valid wikidata references
JsUnit.assertTrue(Wikipedia.isValidWikidata('Q1234'));
JsUnit.assertTrue(Wikipedia.isValidWikidata('Q1'));
JsUnit.assertTrue(Wikipedia.isValidWikidata('Q100000000'));

// invalid wikidata references
JsUnit.assertFalse(Wikipedia.isValidWikidata('1234'));
JsUnit.assertFalse(Wikipedia.isValidWikidata('AAAA'));
JsUnit.assertFalse(Wikipedia.isValidWikidata('Q'));
JsUnit.assertFalse(Wikipedia.isValidWikidata('en:Article'));
