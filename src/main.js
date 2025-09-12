/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2011, 2012, 2013 Red Hat, Inc.
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
 * Author: Cosimo Cecchi <cosimoc@redhat.com>
 *         Zeeshan Ali (Khattak) <zeeshanak@gnome.org>
 */

import 'gi://Adw?version=1';
import 'gi://GeocodeGlib?version=2.0';
import 'gi://Gdk?version=4.0';
import 'gi://GdkPixbuf?version=2.0';
import Gio from 'gi://Gio?version=2.0';
import GioUnix from 'gi://GioUnix?version=2.0';
import GLib from 'gi://GLib?version=2.0';
import 'gi://GObject?version=2.0';
import 'gi://Gtk?version=4.0';
import 'gi://GWeather?version=4.0';
import 'gi://Rest?version=1.0';
import 'gi://Shumate?version=1.0';
import 'gi://Soup?version=3.0';
import 'gi://Xdp?version=1.0';

import * as system from 'system';

import {Application} from './application.js';
import './prototypes.js';

pkg.initGettext();
pkg.initFormat();

Gio.Resource.load(GLib.build_filenamev([pkg.pkgdatadir, `${pkg.name}.shields.gresource`]))._register();

function main(args) {
    /* Add prototype to get last element of an array.
     * TODO: if we get more of these, might move initing
     * to a decicated Prototypes modules.
     */

    let application = new Application();
    return application.run(args);
}

main([system.programInvocationName, ...system.programArgs]);
