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

import Adw from 'gi://Adw?version=1';
import 'gi://GeocodeGlib?version=2.0';
import 'gi://Gdk?version=4.0';
import 'gi://GdkPixbuf?version=2.0';
import Gio from 'gi://Gio?version=2.0';
import GioUnix from 'gi://GioUnix?version=2.0';
import GLib from 'gi://GLib?version=2.0';
import GnomeMaps from 'gi://GnomeMaps';
import 'gi://GObject?version=2.0';
import 'gi://Gtk?version=4.0';
import 'gi://GWeather?version=4.0';
import 'gi://Rest?version=1.0';
import 'gi://Shumate?version=1.0';
import Soup from 'gi://Soup?version=3.0';
import 'gi://Xdp?version=1.0';

import * as system from 'system';

import {Application} from './application.js';
import './prototypes.js';

pkg.initGettext();
pkg.initFormat();

Gio.Resource.load(GLib.build_filenamev([pkg.pkgdatadir, `${pkg.name}.shields.gresource`]))._register();

Gio._promisify(Adw.AlertDialog.prototype, 'choose', 'choose_finish');

Gio._promisify(Gio.InputStream.prototype, 'read_bytes_async', 'read_bytes_finish');
Gio._promisify(Gio.OutputStream.prototype, 'splice_async', 'splice_finish');

Gio._promisify(GnomeMaps.DownloadStore.prototype, 'insert_async', 'insert_finish');
Gio._promisify(GnomeMaps.DownloadStore.prototype, 'remove_async', 'remove_finish');
Gio._promisify(GnomeMaps.DownloadStore.prototype, 'get_async', 'get_finish');
Gio._promisify(GnomeMaps.DownloadStore.prototype, 'exec_async', 'exec_finish');
Gio._promisify(GnomeMaps.DownloadStore.prototype, 'list_tilesets_async', 'list_tilesets_finish');
Gio._promisify(GnomeMaps.DownloadStore.prototype, 'list_tiles_async', 'list_tiles_finish');
Gio._promisify(GnomeMaps.DownloadStore.prototype, 'compute_size_async', 'compute_size_finish');
Gio._promisify(GnomeMaps.DownloadStore.prototype, 'filter_by_mtime_async', 'filter_by_mtime_finish');

Gio._promisify(Soup.Session.prototype, 'send_async', 'send_finish');
Gio._promisify(Soup.Session.prototype, 'send_and_read_async', 'send_and_read_finish');

function main(args) {
    /* Add prototype to get last element of an array.
     * TODO: if we get more of these, might move initing
     * to a decicated Prototypes modules.
     */

    let application = new Application();
    return application.runAsync(args);
}

main([system.programInvocationName, ...system.programArgs]);
