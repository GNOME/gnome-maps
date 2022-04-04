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

pkg.initGettext();
pkg.initFormat();
pkg.require({ 'cairo': '1.0',
              'Champlain': '0.12',
              'Clutter': '1.0',
              'Cogl': '1.0',
              'GeocodeGlib': '1.0',
              'Gdk': '3.0',
              'GdkPixbuf': '2.0',
              'Gio': '2.0',
              'GLib': '2.0',
              'Goa': '1.0',
              'GObject': '2.0',
              'Gtk': '3.0',
              'GtkChamplain': '0.12',
              'GtkClutter': '1.0',
              'GWeather': '4.0',
              'Handy': '1',
              'Rest': '0.7',
              'Soup': '2.4',
              'WebKit2': '4.0' });

const Application = imports.application;

function main(args) {
    /* Add prototype to get last element of an array.
     * TODO: if we get more of these, might move initing
     * to a decicated Prototypes modules.
     */
    if (!Array.prototype.last) {
        Array.prototype.last = function() {
            return this[this.length - 1];
        }
    }

    let application = new Application.Application();
    return application.run(args);
}
