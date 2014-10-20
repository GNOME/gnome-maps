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
 * with GNOME Maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Cosimo Cecchi <cosimoc@redhat.com>
 *         Zeeshan Ali (Khattak) <zeeshanak@gnome.org>
 */

const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GtkClutter = imports.gi.GtkClutter;
const Lang = imports.lang;
const _ = imports.gettext.gettext;

const Format = imports.format;
const Geoclue = imports.geoclue;
const GeocodeService = imports.geocodeService;
const MainWindow = imports.mainWindow;
const NotificationManager = imports.notificationManager;
const Path = imports.path;
const PlaceStore = imports.placeStore;
const RouteService = imports.routeService;
const Settings = imports.settings;
const Utils = imports.utils;

// used globally
let application = null;
let settings = null;
let placeStore = null;
let notificationManager = null;
let routeService = null;
let geoclue = null;
let geocodeService = null;
let networkMonitor = null;

const Application = new Lang.Class({
    Name: 'Application',
    Extends: Gtk.Application,
    Properties: {
        'connected': GObject.ParamSpec.boolean('connected',
                                               '',
                                               '',
                                               GObject.ParamFlags.READABLE |
                                               GObject.ParamFlags.WRITABLE)
    },

    set connected(p) {
        this._connected = p;
        this.notify('connected');
    },

    get connected() {
        return this._connected;
    },

    _init: function() {
        Gettext.bindtextdomain('gnome-maps', Path.LOCALE_DIR);
        Gettext.textdomain('gnome-maps');
        GLib.set_prgname('gnome-maps');
        /* Translators: This is the program name. */
        GLib.set_application_name(_("Maps"));

        this.parent({ application_id: 'org.gnome.Maps' });
        this._connected = false;
    },

    _checkNetwork: function() {
        let addr = new Gio.NetworkAddress({ hostname: 'tile.openstreetmap.org',
                                            port: 80 });

        networkMonitor.can_reach_async(addr, null, (function(networkMonitor, res) {
            try {
                if (networkMonitor.can_reach_finish(res))
                    this.connected = true;
            } catch(e) {
                this.connected = false;
                Utils.debug('Connection failed: ' + e.message);
            }
        }).bind(this));
    },

    _onQuitActivate: function() {
        this._mainWindow.window.destroy();
    },

    _initPlaceStore: function() {
        placeStore = new PlaceStore.PlaceStore();
        try {
            placeStore.load();
        } catch (e) {
            log('Failed to parse Maps places file, ' +
                'subsequent writes will overwrite the file!');
        }
    },

    _initAppMenu: function() {
        let builder = new Gtk.Builder();
        builder.add_from_resource('/org/gnome/maps/app-menu.ui');

        let menu = builder.get_object('app-menu');
        this.set_app_menu(menu);
    },

    vfunc_startup: function() {
        this.parent();
        String.prototype.format = Format.format;

        GtkClutter.init(null);

        Utils.loadStyleSheet(Gio.file_new_for_uri('resource:///org/gnome/maps/application.css'));

        application = this;
        this._initServices();

        Utils.initActions(this, [{
            properties: { name: 'quit' },
            signalHandlers: { activate: this._onQuitActivate }
        }], this);

        this._initPlaceStore();
        this._initAppMenu();
    },

    _initServices: function() {
        settings       = new Settings.Settings('org.gnome.maps');
        routeService   = new RouteService.GraphHopper();
        geoclue        = new Geoclue.Geoclue();
        geocodeService = new GeocodeService.GeocodeService();
        networkMonitor = Gio.NetworkMonitor.get_default();
        networkMonitor.connect('network-changed',
                               this._checkNetwork.bind(this));
    },

    _createWindow: function() {
        if (this._mainWindow)
            return;

        Gtk.IconTheme.get_default().append_search_path(Path.ICONS_DIR);
        let overlay = new Gtk.Overlay({ visible: true, can_focus: false });
        notificationManager = new NotificationManager.NotificationManager(overlay);
        this._mainWindow = new MainWindow.MainWindow(this, overlay);
        this._mainWindow.window.connect('destroy', this._onWindowDestroy.bind(this));
    },

    vfunc_dbus_register: function(connection, path) {
        this.parent(connection, path);
        return true;
    },

    vfunc_dbus_unregister: function(connection, path) {
        this.parent(connection, path);
    },

    vfunc_activate: function() {
        this._createWindow();
        this._checkNetwork();
        this._mainWindow.window.present();
    },

    _onWindowDestroy: function(window) {
        this._mainWindow = null;
    }
});
