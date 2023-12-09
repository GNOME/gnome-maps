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

import * as Address from '../src/address.js';

function streetAddressForCountryCodeTest() {
    // Test known expected address formats for some countries
    JsUnit.assertEquals('42 Some Street',
                        Address.streetAddressForCountryCode('Some Street',
                                                            '42', 'US'));
    JsUnit.assertEquals('42 Some Street',
                        Address.streetAddressForCountryCode('Some Street',
                                                            '42', 'GB'));
    JsUnit.assertEquals('Sonderstraße 42',
                        Address.streetAddressForCountryCode('Sonderstraße',
                                                            '42', 'DE'));
    JsUnit.assertEquals('42, Rue du Labrador',
                        Address.streetAddressForCountryCode('Rue du Labrador',
                                                            '42', 'FR'));
    JsUnit.assertEquals('Rue du Labrador 42',
                        Address.streetAddressForCountryCode('Rue du Labrador',
                                                            '42', 'BE'));
    JsUnit.assertEquals('Calle Mapas, 42',
                        Address.streetAddressForCountryCode('Calle Mapas',
                                                            '42', 'ES'));
    JsUnit.assertEquals('Calle Mapas No° 42',
                        Address.streetAddressForCountryCode('Calle Mapas',
                                                            '42', 'CL'));
    /* Test fallback to "Number Street name" scheme for unknown countries,
     * using fictionary "UT" (Utopia)
     */
    JsUnit.assertEquals('42 Some Street',
                        Address.streetAddressForCountryCode('Some Street',
                                                            '42', 'UT'));
}

streetAddressForCountryCodeTest();
