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

import * as PlaceZoom from '../src/placeZoom.js';

// specific place types
JsUnit.assertEquals(17,
                    PlaceZoom.getZoomLevelForPlace({ osmKey:   'shop',
                                                     osmValue: 'supermarket' }));
JsUnit.assertEquals(4,
                    PlaceZoom.getZoomLevelForPlace({ osmKey:   'place',
                                                     osmValue: 'continent' }));

// fallback for for OSM key
JsUnit.assertEquals(17,
                    PlaceZoom.getZoomLevelForPlace({ osmKey:   'place',
                                                     osmValue: 'other' }));

// undefined for not defined type
JsUnit.assertUndefined(PlaceZoom.getZoomLevelForPlace({ osmKey:   'type',
                                                        osmValue: 'other' }));

