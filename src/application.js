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

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {Geoclue} from './geoclue.js';
import * as GeocodeFactory from './geocode.js';
import {Location} from './location.js';
import {MainWindow} from './mainWindow.js';
import {OSMEdit} from './osmEdit.js';
import {PlaceStore} from './placeStore.js';
import {RoutingDelegator} from './routingDelegator.js';
import {RouteQuery} from './routeQuery.js';
import {Settings} from './settings.js';
import * as Utils from './utils.js';
import * as URIS from './uris.js';
import { Place } from './place.js';

const Format = imports.format;

export class Application extends Adw.Application {

    // used globally
    static application = null;
    static settings = null;
    /** @type {PlaceStore} */
    static placeStore = null;
    /** @type {RoutingDelegator} */
    static routingDelegator = null;
    static geoclue = null;
    static osmEdit = null;
    static normalStartup = true;
    /** @type {RouteQuery} */
    static routeQuery = null;

    constructor() {
        /* Translators: This is the program name. */
        GLib.set_application_name(_("Maps"));
        Gtk.Window.set_default_icon_name(pkg.name);

        super({ application_id: pkg.name,
                flags: Gio.ApplicationFlags.HANDLES_OPEN |
                       Gio.ApplicationFlags.HANDLES_COMMAND_LINE,
                resource_base_path: '/org/gnome/Maps' });

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

    get mainWindow() {
        return this._mainWindow;
    }

    _onOsmAccountSetupActivate() {
        let dialog =
            Application.osmEdit.createAccountDialog(false);

        dialog.present(this._mainWindow);
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

    _initPlaceStore() {
        Application.placeStore = new PlaceStore({
            recentPlacesLimit: Application.settings.get('recent-places-limit'),
            recentRoutesLimit: Application.settings.get('recent-routes-limit')
        });
        try {
            Application.placeStore.load();
        } catch (e) {
            logError(e);
            log('Failed to parse Maps places file, ' +
                'subsequent writes will overwrite the file!');
        }
    }

    vfunc_startup() {
        super.vfunc_startup();

        Application.application = this;
        this._initServices();

        Utils.addActions(this, {
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

        let display = Gdk.Display.get_default();

        Gtk.IconTheme.get_for_display(display).add_search_path(
            GLib.build_filenamev([pkg.pkgdatadir, 'icons']));
        this._initPlaceStore();
    }

    _initServices() {
        Application.settings = Settings.getSettings('org.gnome.Maps');
        Application.routeQuery = new RouteQuery();
        Application.routingDelegator = new RoutingDelegator({ query: Application.routeQuery });
        Application.geoclue = new Geoclue();
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
        if (!this._mainWindow || !this._mainWindow.mapView.map.get_realized())
            return;

        let uri = files[0].get_uri();
        let scheme = GLib.uri_parse_scheme(uri);

        if (scheme === 'geo') {
            const q = URIS.getUriParam(uri, 'q');

            // handle the q= URI parameter as a free-text search term
            if (q) {
                const [geoUri, _] = URIS.parseAsGeoURI(uri);
                const location = new Location({ heading: -1 });

                location.set_from_uri(geoUri);

                /* treat coordinate (0,0) as search with no location bias,
                 * otherwise use the provided coordinates as bias
                 */
                if (location.latitude === 0 && location.longitude === 0) {
                    this._openSearchQuery(q);
                } else {
                    this._openSearchQuery(q,
                                          location.latitude, location.longitude);
                }
            } else {
                this._mainWindow.mapView.goToGeoURI(uri);
            }
        } else if (scheme === 'http' || scheme === 'https') {
            this._mainWindow.mapView.goToHttpURL(uri);
        } else if (scheme === 'maps') {
            // we get a URI that looks like maps:///q=Search, remove slashes
            let mapsURI = uri.replace(/\//g, '');
            this._openMapsUri(mapsURI);
        } else {
            let list = new Gio.ListStore(Gio.File.Gtype);

            for (let i = 0; i < files.length; i++) {
                list.insert(i, files[i]);
            }

            this._mainWindow.mapView.openShapeLayers(list);
        }
    }

    _openMapsUri(uri) {
        let query = URIS.parseMapsURI(uri);

        if (query)
            this._openSearchQuery(query);
        else
            this._invalidMapsUri(uri);
    }

    _openSearchQuery(query, latitude = null, longitude = null) {
        let cancellable = new Gio.Cancellable();

        /* unless there's exactly one place (which should be focused) in
         * the results, let the stored location be used on startup
         */
        Application.normalStartup = true;
        this.connect('shutdown', () => cancellable.cancel());
        GeocodeFactory.getGeocoder().search(query, latitude, longitude, cancellable,
                                            (places, error) => {
            if (error) {
                this._mainWindow.showToast(_("An error has occurred"));
            } else {
                // fill in search entry with query string
                this._mainWindow.searchBar.setTextWithoutTriggeringSearch(query);

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
                        this._mainWindow.searchBar.grab_focus();
                        this._mainWindow.searchBar.updateResults(places, query,
                                                                 false);
                    }
                } else {
                    this._mainWindow.showToast(_("No results found"));
                }
            }
        });
    }

    _invalidMapsUri(uri) {
        this._mainWindow.showToast(_("Invalid maps: URI: %s").format(uri));
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
        if (mapView.map.get_realized())
            this._openInternal(files);
        else
            mapView.map.connect('realize',
                                 this._openInternal.bind(this, files));
    }

    vfunc_command_line(cmdline) {
        let options = cmdline.get_options_dict();

        if (options.contains('local')) {
            let variant = options.lookup_value('local', null);
            this.local_tile_path = variant.deep_unpack();
            Application.normalStartup = false;
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

    vfunc_shutdown() {
        // need to unparent popover children to avoid GTK warnings on exit
        if (this._mainWindow) {
            this._mainWindow.searchBar.popover.unparent();
            this._mainWindow.sidebar.unparentSearchPopovers();
        }

        super.vfunc_shutdown();
    }
}

GObject.registerClass({
    Properties: {
        'selected-place': GObject.ParamSpec.object('selected-place',
                                                   'Selected Place',
                                                   'The selected place',
                                                   GObject.ParamFlags.READABLE |
                                                   GObject.ParamFlags.WRITABLE,
                                                   Place),
        'adaptive-mode': GObject.ParamSpec.boolean('adaptive-mode',
                                                   'Adaptive Move',
                                                   'Whether the main window is in adaptive (narrow) mode',
                                                   GObject.ParamFlags.READABLE |
                                                   GObject.ParamFlags.WRITABLE),
    }
}, Application);
