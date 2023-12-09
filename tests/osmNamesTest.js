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

import 'gi://Gdk?version=4.0';
import 'gi://Gtk?version=4.0';

import * as OSMNames from '../src/osmNames.js';

const JsUnit = imports.jsUnit;

const TAGS1 = { 'name': 'Name',
                'name:en': 'Name',
                'name:de': 'Name',
                'name:sv': 'Namn' };

const TAGS2 = { 'int_name': 'Shin-Ōsaka',
                'name': '新大阪',
                'name:en': 'Shin-Osaka',
                'name:ja': '新大阪',
                'name:ja_rm': 'Shin Ōsaka',
                'name:ko': '신오사카' };

const TAGS3 = { 'int_name': 'Shin-Ōsaka',
                'name': '新大阪',
                'name:en': 'Shin-Osaka',
                'name:ja': '新大阪',
                'name:ja-Latn': 'Shin Ōsaka',
                'name:ko': '신오사카' };

const TAGS4 = { 'name': 'Uppsala',
                'name:de': 'Uppsala',
                'name:eo': 'Upsalo',
                'name:fi': 'Uppsala',
                'name:he': 'אופסלה',
                'name:hu': 'Uppsala',
                'name:is': 'Uppsalir',
                'name:ko': '웁살라',
                'name:lt': 'Upsala',
                'name:nds': 'Uppsala',
                'name:ru': 'Уппсала',
                'name:sv': 'Uppsala',
                'name:yi': 'אופסאלא'};

JsUnit.assertEquals('Name in language', 'Namn',
                    OSMNames.getNameForLanguageAndCountry(TAGS1, 'sv', 'GB'));
JsUnit.assertEquals('Fallback when language not localized', 'Name',
                    OSMNames.getNameForLanguageAndCountry(TAGS1, 'fi', 'GB'));
JsUnit.assertEquals('Legacy Japanese romanization tag', 'Shin Ōsaka',
                    OSMNames.getNameForLanguageAndCountry(TAGS2, 'sv', 'JP'));
JsUnit.assertEquals('Japanese romanization tag', 'Shin Ōsaka',
                    OSMNames.getNameForLanguageAndCountry(TAGS3, 'sv', 'JP'));
JsUnit.assertEquals('Explicit English', 'Shin-Osaka',
                    OSMNames.getNameForLanguageAndCountry(TAGS3, 'en', 'JP'));
JsUnit.assertEquals('Available tag in similar alphabeth', 'Уппсала',
                    OSMNames.getNameForLanguageAndCountry(TAGS4, 'uk', 'SE'));



