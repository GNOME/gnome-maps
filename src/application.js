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

const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GtkClutter = imports.gi.GtkClutter;
const WebKit2 = imports.gi.WebKit2;

const CheckIn = imports.checkIn;
const ContactPlace = imports.contactPlace;
const Format = imports.format;
const Geoclue = imports.geoclue;
const GeocodeService = imports.geocodeService;
const MainWindow = imports.mainWindow;
const Maps = imports.gi.GnomeMaps;
const NotificationManager = imports.notificationManager;
const OSMEdit = imports.osmEdit;
const OSMTypeSearchEntry = imports.osmTypeSearchEntry;
const PlaceStore = imports.placeStore;
const RoutingDelegator = imports.routingDelegator;
const RouteQuery = imports.routeQuery;
const Settings = imports.settings;
const Utils = imports.utils;

// used globally
var application = null;
var settings = null;
var placeStore = null;
var notificationManager = null;
var routingDelegator = null;
var geoclue = null;
var geocodeService = null;
var networkMonitor = null;
var checkInManager = null;
var contactStore = null;
var osmEdit = null;
var normalStartup = true;
var routeQuery = null;

const _ensuredTypes = [WebKit2.WebView,
                       OSMTypeSearchEntry.OSMTypeSearchEntry];

var Application = GObject.registerClass({
    Properties: {
        'connected': GObject.ParamSpec.boolean('connected',
                                               '',
                                               '',
                                               GObject.ParamFlags.READABLE |
                                               GObject.ParamFlags.WRITABLE)
    },
}, class Application extends Gtk.Application {

    set connected(p) {
        this._connected = p;
        this.notify('connected');
    }

    get connected() {
        return this._connected;
    }

    _init() {
        /* Translators: This is the program name. */
        GLib.set_application_name(_("Maps"));

        /* Needed to be able to use in UI files */
        _ensuredTypes.forEach((type) => GObject.type_ensure(type));

        super._init({ application_id: 'org.gnome.Maps',
                      flags: Gio.ApplicationFlags.HANDLES_OPEN });
        this._connected = false;

        this.add_main_option('local',
                             0,
                             GLib.OptionFlags.NONE,
                             GLib.OptionArg.FILENAME,
                             _("A path to a local tiles directory structure"),
                             null);

        this.add_main_option('version', 'v'.charCodeAt(0), GLib.OptionFlags.NONE, GLib.OptionArg.NONE,
                             _("Show the version of the program"), null);

        this.connect('handle-local-options', (app, options) => {
            if (options.contains('local')) {
                let variant = options.lookup_value('local', null);
                this.local_tile_path = variant.deep_unpack();
                normalStartup = false;
            } else if (options.contains('version')) {
                print(pkg.version);
                /* quit the invoked process after printing the version number
                 * leaving the running instance unaffected
                 */
                return 0;
            }

            return -1;
        });
    }

    _checkNetwork() {
        this.connected = networkMonitor.connectivity === Gio.NetworkConnectivity.FULL;
    }

    _showContact(id) {
        contactStore.lookup(id, (contact) => {
            this._mainWindow.markBusy();
            if (!contact) {
                this._mainWindow.unmarkBusy();
                return;
            }
            contact.geocode(() => {
                this._mainWindow.unmarkBusy();
                this._mainWindow.mapView.showContact(contact);
            });
        });
    }

    _onShowContactActivate(action, parameter) {
        this._createWindow();
        this._checkNetwork();
        this._mainWindow.present();

        let id = parameter.deep_unpack();

        if (contactStore.state === Maps.ContactStoreState.LOADED) {
            this. _showContact(id);
        } else {
            Utils.once(contactStore, 'notify::state', () => {
                if (contactStore.state === Maps.ContactStoreState.LOADED)
                    this._showContact(id);
            });
        }
    }

    _onQuitActivate() {
        this._mainWindow.destroy();
    }

    _onOsmAccountSetupActivate() {
        let dialog = osmEdit.createAccountDialog(this._mainWindow, false);

        dialog.show();
        dialog.connect('response', () => dialog.destroy());
    }

    _addContacts() {
        contactStore.get_contacts().forEach((contact) => {
            contact.geocode(function() {
                contact.get_places().forEach((p) => {
                    if (!p.location)
                        return;

                    Utils.debug('Adding contact address: ' + p.name);
                    let place = new ContactPlace.ContactPlace({ place: p,
                                                                contact: contact });
                    placeStore.addPlace(place, PlaceStore.PlaceType.CONTACT);
                });
            });
        });
    }

    _initPlaceStore() {
        placeStore = new PlaceStore.PlaceStore({
            recentPlacesLimit: settings.get('recent-places-limit'),
            recentRoutesLimit: settings.get('recent-routes-limit')
        });
        try {
            placeStore.load();
        } catch (e) {
            log('Failed to parse Maps places file, ' +
                'subsequent writes will overwrite the file!');
        }

        if (contactStore.state === Maps.ContactStoreState.LOADED) {
            this._addContacts();
        } else {
            Utils.once(contactStore, 'notify::state', () => {
                if (contactStore.state === Maps.ContactStoreState.LOADED)
                    this._addContacts();
            });
        }
    }

    _initAppMenu() {
        let builder = new Gtk.Builder();
        builder.add_from_resource('/org/gnome/Maps/ui/app-menu.ui');

        let menu = builder.get_object('app-menu');
        this.set_app_menu(menu);
    }

    vfunc_startup() {
        super.vfunc_startup();

        GtkClutter.init(null);

        Utils.loadStyleSheet(Gio.file_new_for_uri('resource:///org/gnome/Maps/application.css'));

        application = this;
        this._initServices();

        Utils.addActions(this, {
            'quit': { onActivate: this._onQuitActivate.bind(this) },
            'show-contact': {
                paramType: 's',
                onActivate: this._onShowContactActivate.bind(this)
            },
            'osm-account-setup': {
                onActivate: this._onOsmAccountSetupActivate.bind(this)
            }
        });

        Gtk.IconTheme.get_default().append_search_path(GLib.build_filenamev([pkg.pkgdatadir,
                                                                             'icons']));
        this._initPlaceStore();
        this._initAppMenu();
    }

    _initServices() {
        settings         = Settings.getSettings('org.gnome.Maps');
        routeQuery       = new RouteQuery.RouteQuery();
        routingDelegator = new RoutingDelegator.RoutingDelegator({ query: routeQuery });
        geoclue          = new Geoclue.Geoclue();
        geocodeService   = new GeocodeService.GeocodeService();
        networkMonitor   = Gio.NetworkMonitor.get_default();
        networkMonitor.connect('network-changed',
                               this._checkNetwork.bind(this));
        checkInManager = new CheckIn.CheckInManager();
        contactStore = new Maps.ContactStore();
        contactStore.load();
        osmEdit = new OSMEdit.OSMEdit();
    }

    _createWindow() {
        if (this._mainWindow)
            return;

        let overlay = new Gtk.Overlay({ visible: true, can_focus: false });
        notificationManager = new NotificationManager.NotificationManager(overlay);
        this._mainWindow = new MainWindow.MainWindow({ application: this,
                                                       overlay: overlay });
        this._mainWindow.connect('destroy', () => this._onWindowDestroy());
        if (GLib.getenv('MAPS_DEBUG') === 'focus') {
            this._mainWindow.connect('set-focus', (window, widget) => {
                log('* focus widget: %s'.format(widget));
            });
        }
    }

    vfunc_dbus_register(connection, path) {
        super.vfunc_dbus_register(connection, path);
        return true;
    }

    vfunc_dbus_unregister(connection, path) {
        super.vfunc_dbus_register(connection, path);
    }

    vfunc_activate() {
        this._createWindow();
        this._checkNetwork();
        this._mainWindow.present();
    }

    _openInternal(files) {
        if (!this._mainWindow || !this._mainWindow.mapView.view.realized)
            return;

        let uri = files[0].get_uri();

        if (GLib.uri_parse_scheme(uri) === 'geo') {
            /* we get an uri that looks like geo:///lat,lon, remove slashes */
            let geoURI = uri.replace(/\//g, '');
            this._mainWindow.mapView.goToGeoURI(geoURI);
        } else {
            this._mainWindow.mapView.openShapeLayers(files);
        }
    }

    vfunc_open(files) {
        normalStartup = false;
        this.activate();

        let mapView = this._mainWindow.mapView;
        if (mapView.view.realized)
            this._openInternal(files);
        else
            mapView.view.connect('notify::realized',
                                 this._openInternal.bind(this, files));
    }

    _onWindowDestroy(window) {
        this._mainWindow = null;
    }
});
