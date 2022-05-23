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

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Geocode from 'gi://GeocodeGlib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import GtkClutter from 'gi://GtkClutter';
import Hdy from 'gi://Handy';

import {ContactPlace} from './contactPlace.js';
import {Geoclue} from './geoclue.js';
import * as GeocodeFactory from './geocode.js';
import {MainWindow} from './mainWindow.js';
import GnomeMaps from 'gi://GnomeMaps';
import {OSMEdit} from './osmEdit.js';
import {OSMTypeSearchEntry} from './osmTypeSearchEntry.js';
import {PlaceStore} from './placeStore.js';
import {RoutingDelegator} from './routingDelegator.js';
import {RouteQuery} from './routeQuery.js';
import {Settings} from './settings.js';
import * as Utils from './utils.js';
import * as URIS from './uris.js';

const Format = imports.format;

const _ensuredTypes = [OSMTypeSearchEntry];

export class Application extends Gtk.Application {

    // used globally
    static application = null;
    static settings = null;
    static placeStore = null;
    static routingDelegator = null;
    static geoclue = null;
    static contactStore = null;
    static osmEdit = null;
    static normalStartup = true;
    static routeQuery = null;

    constructor() {
        /* Translators: This is the program name. */
        GLib.set_application_name(_("Maps"));

        /* Needed to be able to use in UI files */
        _ensuredTypes.forEach((type) => GObject.type_ensure(type));

        super({ application_id: pkg.name,
                flags: Gio.ApplicationFlags.HANDLES_OPEN |
                       Gio.ApplicationFlags.HANDLES_COMMAND_LINE });

        this.add_main_option('local',
                             0,
                             GLib.OptionFlags.NONE,
                             GLib.OptionArg.FILENAME,
                             _("A path to a local tiles directory structure"),
                             null);
        this.add_main_option('local-tile-size',
                             0,
                             GLib.OptionFlags.NONE,
                             GLib.OptionArg.INT,
                             _("Tile size for local tiles directory"),
                             null);

        this.add_main_option('version', 'v'.charCodeAt(0), GLib.OptionFlags.NONE, GLib.OptionArg.NONE,
                             _("Show the version of the program"), null);

        this.add_main_option('search',
                             'S'.charCodeAt(0),
                             GLib.OptionFlags.NONE,
                             GLib.OptionArg.STRING,
                             _("Search for places"),
                             null);

        /* due to https://gitlab.gnome.org/GNOME/gjs/-/issues/330 the
         * description for the remaining args needs to be passed as both
         * description and arg_description
         */
        this.add_main_option(GLib.OPTION_REMAINING,
                             0,
                             0,
                             GLib.OptionArg.STRING_ARRAY,
                             _("[FILE…|URI]"),
                             _("[FILE…|URI]"));
    }

    _showContact(id) {
        contactStore.lookup(id, (contact) => {
            this.mark_busy();
            if (!contact) {
                this.unmark_busy();
                return;
            }
            contact.geocode(() => {
                this.unmark_busy();
                this._mainWindow.mapView.showContact(contact);
            });
        });
    }

    _onShowContactActivate(action, parameter) {
        this._createWindow();
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

    _onOsmAccountSetupActivate() {
        let dialog =
            Application.osmEdit.createAccountDialog(this._mainWindow, false);

        dialog.show();
        dialog.connect('response', () => dialog.destroy());
    }

    _onSearchActivate(action, parameter) {
        this._createWindow();
        this._mainWindow.present();

        let query = parameter.deep_unpack();
        let mapView = this._mainWindow.mapView;

        if (mapView.view.realized)
            this._openSearchQuery(query);
        else
            mapView.view.connect('notify::realized',
                                 this._openSearchQuery.bind(this, query));
    }

    _addContacts() {
        let contacts = Application.contactStore.get_contacts();

        this._addContactsRecursive(contacts, 0);
    }

    _addContactsRecursive(contacts, index) {
        if (index < contacts.length) {
            let contact = contacts[index];

            contact.geocode(() => {
                contact.get_places().forEach((p) => {
                    if (!p.location)
                        return

                    Utils.debug('Adding contact address: ' + p.name);
                    let place = new ContactPlace({ place: p, contact: contact });

                    Application.placeStore.addPlace(place, PlaceStore.PlaceType.CONTACT);
                });

                this._addContactsRecursive(contacts, index + 1);
            });
        }
    }

    _initPlaceStore() {
        Application.placeStore = new PlaceStore({
            recentPlacesLimit: Application.settings.get('recent-places-limit'),
            recentRoutesLimit: Application.settings.get('recent-routes-limit')
        });
        try {
            Application.placeStore.load();
        } catch (e) {
            log('Failed to parse Maps places file, ' +
                'subsequent writes will overwrite the file!');
        }

        if (Application.contactStore.state === GnomeMaps.ContactStoreState.LOADED) {
            this._addContacts();
        } else {
            Utils.once(Application.contactStore, 'notify::state', () => {
                if (Application.contactStore.state === GnomeMaps.ContactStoreState.LOADED)
                    this._addContacts();
            });
        }
    }

    vfunc_startup() {
        super.vfunc_startup();

        GtkClutter.init(null);
        Hdy.init();

        Utils.loadStyleSheet(Gio.file_new_for_uri('resource:///org/gnome/Maps/application.css'));

        Application.application = this;
        this._initServices();

        Utils.addActions(this, {
            'show-contact': {
                paramType: 's',
                onActivate: this._onShowContactActivate.bind(this)
            },
            'osm-account-setup': {
                onActivate: this._onOsmAccountSetupActivate.bind(this)
            },
            'search': {
                paramType: 's',
                onActivate: this._onSearchActivate.bind(this)
            },
            'quit': {
                onActivate: () => this.quit(),
                accels: ['<Primary>Q']
            }
        }, Application.settings);


        this._styleManager = Hdy.StyleManager.get_default();
        this._styleManager.set_color_scheme(Hdy.ColorScheme.PREFER_LIGHT);

        Gtk.IconTheme.get_default().append_search_path(GLib.build_filenamev([pkg.pkgdatadir,
                                                                             'icons']));
        this._initPlaceStore();
    }

    _initServices() {
        Application.settings = Settings.getSettings('org.gnome.Maps');
        Application.routeQuery = new RouteQuery();
        Application.routingDelegator = new RoutingDelegator({ query: Application.routeQuery });
        Application.geoclue = new Geoclue();
        Application.contactStore = new GnomeMaps.ContactStore();
        Application.contactStore.load();
        Application.osmEdit = new OSMEdit();
    }

    _createWindow() {
        if (this._mainWindow)
            return;

        this._mainWindow = new MainWindow({ application: this });
        this._mainWindow.connect('destroy', () => this._onWindowDestroy());
        if (GLib.getenv('MAPS_DEBUG') === 'focus') {
            this._mainWindow.connect('set-focus', (window, widget) => {
                log(`* focus widget: ${widget}`);
            });
        }
    }

    vfunc_dbus_register(connection, path) {
        super.vfunc_dbus_register(connection, path);
        return true;
    }

    vfunc_dbus_unregister(connection, path) {
        super.vfunc_dbus_unregister(connection, path);
    }

    vfunc_activate() {
        this._createWindow();
        this._mainWindow.present();
    }

    _openInternal(files) {
        if (!this._mainWindow || !this._mainWindow.mapView.view.realized)
            return;

        let uri = files[0].get_uri();
        let scheme = GLib.uri_parse_scheme(uri);

        if (scheme === 'geo') {
            // we get a URI that looks like geo:///lat,lon, remove slashes
            let geoURI = uri.replace(/\//g, '');
            this._mainWindow.mapView.goToGeoURI(geoURI);
        } else if (scheme === 'http' || scheme === 'https') {
            this._mainWindow.mapView.goToHttpURL(uri);
        } else if (scheme === 'maps') {
            // we get a URI that looks like maps:///q=Search, remove slashes
            let mapsURI = uri.replace(/\//g, '');
            this._openMapsUri(mapsURI);
        } else {
            this._mainWindow.mapView.openShapeLayers(files);
        }
    }

    _openMapsUri(uri) {
        let query = URIS.parseMapsURI(uri);

        if (query)
            this._openSearchQuery(query);
        else
            this._invalidMapsUri(uri);
    }

    _openSearchQuery(query) {
        let cancellable = new Gio.Cancellable();

        /* unless there's exactly one place (which should be focused) in
         * the results, let the stored location be used on startup
         */
        Application.normalStartup = true;
        this.connect('shutdown', () => cancellable.cancel());
        GeocodeFactory.getGeocoder().search(query, null, null, cancellable,
                                            (places, error) => {
            if (error) {
                Utils.showDialog(_("An error has occurred"),
                                 Gtk.MessageType.ERROR, this._mainWindow);
            } else {
                // clear search entry
                this._mainWindow.placeEntry.text = '';

                if (places) {
                    /* if there's only one place in results, show it directly
                     * with it's bubble, otherwise present the results in the
                     * search popover
                     */
                    if (places?.length === 1) {
                        /* don't use the stored location on startup, as we're
                         * zooming in directly on the place
                         */
                        Application.normalStartup = false;
                        this._mainWindow.mapView.showPlace(places[0], true);
                    } else {
                        this._mainWindow.placeEntry.grab_focus();
                        this._mainWindow.placeEntry.updateResults(places, query,
                                                                  false);
                    }
                } else {
                    Utils.showDialog(_("No results found"),
                                     Gtk.MessageType.INFO, this._mainWindow);
                }
            }
        });
    }

    _invalidMapsUri(uri) {
        Utils.showDialog(_("Invalid maps: URI: %s").format(uri),
                         Gtk.MessageType.ERROR, this._mainWindow);
    }

    vfunc_open(files) {
        /* unless the first argument is a maps: URI with a search query
         * we should not perform the normal startup behavior of going to
         * the stored location, as shape layers, directly addressed OSM
         * objects, and geo: URIs will override the startup location
         */
        let uri = files[0].get_uri();

        if (GLib.uri_parse_scheme(uri) !== 'maps')
            Application.normalStartup = false;

        this.activate();

        let mapView = this._mainWindow.mapView;
        if (mapView.view.realized)
            this._openInternal(files);
        else
            mapView.view.connect('notify::realized',
                                 this._openInternal.bind(this, files));
    }

    vfunc_command_line(cmdline) {
        let options = cmdline.get_options_dict();

        if (options.contains('local')) {
            let variant = options.lookup_value('local', null);
            this.local_tile_path = variant.deep_unpack();
            normalStartup = false;
            if (options.contains('local-tile-size')) {
                variant = options.lookup_value('local-tile-size', null);
                this.local_tile_size = variant.deep_unpack();
            }
        } else if (options.contains('version')) {
            print(pkg.version);
            /* quit the invoked process after printing the version number
             * leaving the running instance unaffected
             */
            return 0;
        }

        let remaining = options.lookup(GLib.OPTION_REMAINING, null);
        let files = [];

        // when given the search CLI argument, insert URI as first file
        if (options.contains('search')) {
            let query = options.lookup_value('search', null).deep_unpack();

            files = [Gio.File.new_for_uri(`maps:q=${query}`)];
        }

        if (remaining) {
            remaining.forEach((r) => {
                let path = r.get_string()[0];

                if (path.startsWith('geo:') || path.startsWith('http://') ||
                    path.startsWith('https://') || path.startsWith('maps:')) {
                    files.push(Gio.File.new_for_uri(path));
                } else {
                    files.push(Gio.File.new_for_path(path));
                }
            });
        }

        if (files.length > 0)
            this.open(files, '');
        else
            this.activate();

        return 0;
    }

    _onWindowDestroy(window) {
        this._mainWindow = null;
    }
}

GObject.registerClass({
    Properties: {
        'selected-place': GObject.ParamSpec.object('selected-place',
                                                   'Selected Place',
                                                   'The selected place',
                                                   GObject.ParamFlags.READABLE |
                                                   GObject.ParamFlags.WRITABLE,
                                                   Geocode.Place),
        'adaptive-mode': GObject.ParamSpec.boolean('adaptive-mode',
                                                   'Adaptive Move',
                                                   'Whether the main window is in adaptive (narrow) mode',
                                                   GObject.ParamFlags.READABLE |
                                                   GObject.ParamFlags.WRITABLE),
    }
}, Application);
