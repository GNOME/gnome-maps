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
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

const Application = imports.application;
const BusyMarker = imports.busyMarker;
const ContextMenu = imports.contextMenu;
const FavoritesPopover = imports.favoritesPopover;
const Geoclue = imports.geoclue;
const LayersPopover = imports.layersPopover;
const LocationServiceNotification = imports.locationServiceNotification;
const MapView = imports.mapView;
const PlaceEntry = imports.placeEntry;
const PlaceStore = imports.placeStore;
const PrintOperation = imports.printOperation;
const Service = imports.service;
const ShapeLayer = imports.shapeLayer;
const Sidebar = imports.sidebar;
const Utils = imports.utils;
const ZoomControl = imports.zoomControl;

const _CONFIGURE_ID_TIMEOUT = 100; // msecs
const _WINDOW_MIN_WIDTH = 600;
const _WINDOW_MIN_HEIGHT = 500;

var ShapeLayerFileChooser = new Lang.Class({
    Name: 'ShapeLayerFileChooser',
    Extends: Gtk.FileChooserNative,
    Template: 'resource:///org/gnome/Maps/ui/shape-layer-file-chooser.ui',

    _init: function(params) {
        this.parent(params);
        let allFilter = new Gtk.FileFilter();
        allFilter.set_name(_("All Layer Files"));
        this.add_filter(allFilter);
        this.set_filter(allFilter);

        ShapeLayer.SUPPORTED_TYPES.forEach((function(layerClass) {
            let filter = new Gtk.FileFilter();
            [filter, allFilter].forEach(function(f) {
                layerClass.mimeTypes.forEach(function(type) {
                    f.add_mime_type(type);
                });
            });
            filter.set_name(layerClass.displayName);
            this.add_filter(filter);
        }).bind(this));
    }
});

var MainWindow = new Lang.Class({
    Name: 'MainWindow',
    Extends: Gtk.ApplicationWindow,
    Template: 'resource:///org/gnome/Maps/ui/main-window.ui',
    InternalChildren: [ 'headerBar',
                        'grid',
                        'mainStack',
                        'noNetworkView',
                        'gotoUserLocationButton',
                        'toggleSidebarButton',
                        'layersButton',
                        'favoritesButton',
                        'printRouteButton' ],

    get mapView() {
        return this._mapView;
    },

    _init: function(params) {
        this._overlay = params.overlay;
        delete params.overlay;

        this.parent(params);

        this._configureId = 0;

        this._mapView = new MapView.MapView({
            mapType: this.application.local_tile_path ?
                MapView.MapType.LOCAL : MapView.MapType.STREET });

        this._overlay.add(this._mapView);

        this._mapView.gotoUserLocation(false);

        this._sidebar = this._createSidebar();

        this._contextMenu = new ContextMenu.ContextMenu({ mapView: this._mapView,
                                                          mainWindow: this });

        this.layersPopover = new LayersPopover.LayersPopover({
            mapView: this._mapView
        });
        this._layersButton.popover = this.layersPopover;
        this._favoritesButton.popover = new FavoritesPopover.FavoritesPopover({ mapView: this._mapView });
        this._overlay.add_overlay(new ZoomControl.ZoomControl(this._mapView));

        this._mainStack.add(this._overlay);
        this._busy = new BusyMarker.BusyMarker();
        this._overlay.add_overlay(this._busy);

        this._initHeaderbar();
        this._initActions();
        this._initSignals();
        this._restoreWindowGeometry();
        this._initDND();

        this._busySignalId = 0;

        this._grid.attach(this._sidebar, 1, 0, 1, 1);

        this._grid.show_all();
    },

    _createPlaceEntry: function() {
        let placeEntry = new PlaceEntry.PlaceEntry({ mapView: this._mapView,
                                                     visible: true,
                                                     margin_start: 35,
                                                     margin_end: 35,
                                                     max_width_chars: 50,
                                                     loupe: true,
                                                     matchRoute: true
                                                   });
        placeEntry.connect('notify::place', (function() {
            if (placeEntry.place) {
                this._mapView.showPlace(placeEntry.place, true);
            }
        }).bind(this));

        let popover = placeEntry.popover;
        popover.connect('selected', (function() {
            this._mapView.grab_focus();
        }).bind(this));
        this._mapView.view.connect('button-press-event', (function () {
            popover.hide();
        }));
        return placeEntry;
    },

    _createSidebar: function() {
        let sidebar = new Sidebar.Sidebar(this._mapView);

        Application.routeQuery.connect('notify',
                                       this._setRevealSidebar.bind(this, true));
        this._toggleSidebarButton.bind_property('active',
                                                this._mapView, 'routingOpen',
                                                GObject.BindingFlags.BIDIRECTIONAL);
        this.application.bind_property('connected',
                                       sidebar, 'visible',
                                       GObject.BindingFlags.DEFAULT);
        return sidebar;
    },

    _initDND: function() {
        this.drag_dest_set(Gtk.DestDefaults.DROP, null, 0);
        this.drag_dest_add_uri_targets();

        this.connect('drag-motion', (function(widget, ctx, x, y, time) {
            Gdk.drag_status(ctx, Gdk.DragAction.COPY, time);
            return true;
        }).bind(this));

        this.connect('drag-data-received', (function(widget, ctx, x, y, data, info, time) {
            let files = data.get_uris().map(Gio.file_new_for_uri);
            if (this._mapView.openShapeLayers(files))
                Gtk.drag_finish(ctx, true, false, time);
            else
                Gtk.drag_finish(ctx, false, false, time);
        }).bind(this));
    },

    _initActions: function() {
        Utils.addActions(this, {
            'close': {
                onActivate: this.close.bind(this)
            },
            'about': {
                onActivate: this._onAboutActivate.bind(this)
            },
            'map-type-menu': {
                state: ['b', false],
                onActivate: this._onMapTypeMenuActivate.bind(this)
            },
            'switch-to-street-view': {
                accels: ['<Primary>1', '<Primary>KP_1'],
                onActivate: this._onStreetViewActivate.bind(this)
            },
            'switch-to-aearial-view': {
                accels: ['<Primary>2', '<Primary>KP_2'],
                onActivate: this._onAerialViewActivate.bind(this)
            },
            'goto-user-location': {
                accels: ['<Primary>L'],
                onActivate: this._onGotoUserLocationActivate.bind(this)
            },
            'toggle-sidebar': {
                accels: ['<Primary>D'],
                state: ['b', false],
                onChangeState: this._onToggleSidebarChangeState.bind(this)
            },
            'zoom-in': {
                accels: ['plus', '<Primary>plus', 'KP_Add', '<Primary>KP_Add', 'equal', '<Primary>equal'],
                onActivate: this._mapView.view.zoom_in.bind(this._mapView.view)
            },
            'zoom-out': {
                accels: ['minus', '<Primary>minus', 'KP_Subtract', '<Primary>KP_Subtract'],
                onActivate:  this._mapView.view.zoom_out.bind(this._mapView.view)
            },
            'toggle-scale': {
                accels: ['<Primary>S'],
                onActivate:  this._mapView.toggleScale.bind(this._mapView)
            },
            'find': {
                accels: ['<Primary>F'],
                onActivate: this._placeEntry.grab_focus.bind(this._placeEntry)
            },
            'print-route': {
                accels: ['<Primary>P'],
                onActivate: this._printRouteActivate.bind(this)
            },
            'open-shape-layer': {
                accels: ['<Primary>O'],
                onActivate: this._onOpenShapeLayer.bind(this)
            }
        });
    },

    _initSignals: function() {
        this.connect('delete-event', this._quit.bind(this));
        this.connect('configure-event',
                     this._onConfigureEvent.bind(this));

        this.connect('window-state-event',
                     this._onWindowStateEvent.bind(this));
        this._mapView.view.connect('button-press-event', (function() {
            // Can not call something that will generate clutter events
            // from a clutter event-handler. So use an idle.
            Mainloop.idle_add((function() {
                this._mapView.grab_focus();
            }).bind(this));
        }).bind(this));

        this.application.connect('notify::connected', (function() {
            if (this.application.connected || this.application.local_tile_path)
                this._mainStack.visible_child = this._overlay;
            else
                this._mainStack.visible_child = this._noNetworkView;
        }).bind(this));

        /*
         * If the currently focused widget is an entry then we will
         * hijack the key-press to the main window and make sure that
         * they reach the entry before they can be swallowed as accelerator.
         */
        this.connect('key-press-event', (function(window, event) {
            let focusWidget = window.get_focus();
            let keyval = event.get_keyval()[1];
            let keys = [Gdk.KEY_plus, Gdk.KEY_KP_Add,
                        Gdk.KEY_minus, Gdk.KEY_KP_Subtract,
                        Gdk.KEY_equal];
            let isPassThroughKey = keys.indexOf(keyval) !== -1;

            /* if no entry is focused, and the key is not one we should treat
             * as a zoom accelerator when no entry is focused, focus the
             * main search entry in the headebar to propaget the keypress there
             */
            if (!(focusWidget instanceof Gtk.Entry) && !isPassThroughKey) {
                /* if the search entry does not handle the event, pass it on
                 * instead of activating the entry
                 */
                if (this._placeEntry.handle_event(event) === Gdk.EVENT_PROPAGATE)
                    return false;

                this._placeEntry.has_focus = true;
                focusWidget = this._placeEntry;
            }

            if (focusWidget instanceof Gtk.Entry)
                return focusWidget.event(event);

            return false;
        }).bind(this));
    },

    _updateLocationSensitivity: function() {
        let sensitive = (Application.geoclue.state !== Geoclue.State.INITIAL &&
                         (this.application.connected ||
                          this.application.local_tile_path));

        this._gotoUserLocationButton.sensitive = sensitive;
    },

    _initHeaderbar: function() {
        this._placeEntry = this._createPlaceEntry();
        this._headerBar.custom_title = this._placeEntry;

        let favoritesPopover = this._favoritesButton.popover;
        this._favoritesButton.sensitive = favoritesPopover.rows > 0;
        favoritesPopover.connect('notify::rows', (function() {
            this._favoritesButton.sensitive = favoritesPopover.rows > 0;
        }).bind(this));

        this._mapView.bind_property('routeShowing', this._printRouteButton,
                                    'visible', GObject.BindingFlags.DEFAULT);

        Application.geoclue.connect('notify::state',
                                    this._updateLocationSensitivity.bind(this));
        this.application.connect('notify::connected', (function() {
            let app = this.application;

            this._updateLocationSensitivity();
            this._layersButton.sensitive = app.connected;
            this._toggleSidebarButton.sensitive = app.connected;
            this._favoritesButton.sensitive = (app.connected &&
                                               favoritesPopover.rows > 0);
            this._placeEntry.sensitive = app.connected;
            this._printRouteButton.sensitive = app.connected;
        }).bind(this));
    },

    _saveWindowGeometry: function() {
        let window = this.get_window();
        let state = window.get_state();

        if (state & Gdk.WindowState.MAXIMIZED)
            return;

        // GLib.Variant.new() can handle arrays just fine
        let size = this.get_size();
        Application.settings.set('window-size', size);

        let position = this.get_position();
        Application.settings.set('window-position', position);
    },

    _restoreWindowGeometry: function() {
        let size = Application.settings.get('window-size');
        if (size.length === 2) {
            let [width, height] = size;
            this.set_default_size(width, height);
        }

        let position = Application.settings.get('window-position');
        if (position.length === 2) {
            let [x, y] = position;

            this.move(x, y);
        }

        if (Application.settings.get('window-maximized'))
            this.maximize();
    },

    _onConfigureEvent: function(widget, event) {
        if (this._configureId !== 0) {
            Mainloop.source_remove(this._configureId);
            this._configureId = 0;
        }

        this._configureId = Mainloop.timeout_add(_CONFIGURE_ID_TIMEOUT, (function() {
            this._saveWindowGeometry();
            this._configureId = 0;
            return false;
        }).bind(this));
    },

    _onWindowStateEvent: function(widget, event) {
        let window = widget.get_window();
        let state = window.get_state();

        if (state & Gdk.WindowState.FULLSCREEN)
            return;

        let maximized = (state & Gdk.WindowState.MAXIMIZED);
        Application.settings.set('window-maximized', maximized);
    },

    _quit: function() {
        // remove configure event handler if still there
        if (this._configureId !== 0) {
            Mainloop.source_remove(this._configureId);
            this._configureId = 0;
        }

        // always save geometry before quitting
        this._saveWindowGeometry();

        return false;
    },

    _getLocationServiceNotification: function() {
        if (!this._locationServiceNotification) {
            this._locationServiceNotification =
                new LocationServiceNotification.LocationServiceNotification();
        }

        return this._locationServiceNotification;
    },

    _onGotoUserLocationActivate: function() {
        let message;

        if (Application.geoclue.state === Geoclue.State.ON) {
            this._mapView.gotoUserLocation(true);
            return;
        }

        Application.geoclue.start((function() {
            switch(Application.geoclue.state) {
            case Geoclue.State.FAILED:
                message = _("Failed to connect to location service");
                Application.notificationManager.showMessage(message);
                break;

            case Geoclue.State.DENIED:
                let notification = this._getLocationServiceNotification();
                Application.notificationManager.showNotification(notification);
                break;

            default:
                this._mapView.gotoUserLocation(true);
                break;
            }
        }).bind(this));
    },

    _printRouteActivate: function() {
        if (this._mapView.routeShowing) {
            let operation = new PrintOperation.PrintOperation({ mainWindow: this });
        }
    },

    _onMapTypeMenuActivate: function(action) {
        let state = action.get_state().get_boolean();
        action.set_state(GLib.Variant.new('b', !state));
    },

    _onStreetViewActivate: function() {
        this._mapView.setMapType(MapView.MapType.STREET);
        this.layersPopover.setMapType(MapView.MapType.STREET);
    },

    _onAerialViewActivate: function() {
        this._mapView.setMapType(MapView.MapType.AERIAL);
        this.layersPopover.setMapType(MapView.MapType.AERIAL);
    },

    _onToggleSidebarChangeState: function(action, variant) {
        action.set_state(variant);

        let reveal = variant.get_boolean();
        this._sidebar.set_reveal_child(reveal);
    },

    _setRevealSidebar: function(value) {
        let action = this.lookup_action('toggle-sidebar');
        action.change_state(GLib.Variant.new_boolean(value));
    },

    _onAboutActivate: function() {
        let aboutDialog = new Gtk.AboutDialog({
            artists: [ 'Jakub Steiner <jimmac@gmail.com>',
                       'Andreas Nilsson <nisses.mail@home.se>' ],
            authors: [ 'Zeeshan Ali (Khattak) <zeeshanak@gnome.org>',
                       'Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>',
                       'Jonas Danielsson <jonas@threetimestwo.org>',
                       'Marcus Lundblad <ml@update.uu.se>'],
            translator_credits: _("translator-credits"),
            /* Translators: This is the program name. */
            program_name: _("Maps"),
            comments: _("A map application for GNOME"),
            license_type: Gtk.License.GPL_2_0,
            logo_icon_name: 'org.gnome.Maps',
            version: pkg.version,
            website: 'https://live.gnome.org/Apps/Maps',
            wrap_license: true,

            modal: true,
            transient_for: this
        });

        let copyright = _("Copyright © 2011 – 2017 Red Hat, Inc. and The GNOME Maps authors");
        let attribution = this._getAttribution();

        copyright += '\n' + attribution;

        /* HACK: we need to poke into gtkaboutdialog internals
         * to set the copyright with markup like attribution requires
         */

        let copyrightLabel = aboutDialog.get_template_child(Gtk.AboutDialog, 'copyright_label');
        copyrightLabel.set_markup('<span size="small">' + copyright + '</span>');
        copyrightLabel.show();

        aboutDialog.show();
        aboutDialog.connect('response', (function() {
            aboutDialog.destroy();
        }));
    },

    _getAttribution: function() {
        let tileProviderInfo = Service.getService().tileProviderInfo;
        let attribution = _("Map data by %s and contributors").format('<a href="https://www.openstreetmap.org">OpenStreetMap</a>');

        if (tileProviderInfo) {
            let tileProviderString;
            if (tileProviderInfo.url) {
                tileProviderString = '<a href="' + tileProviderInfo.url + '">' +
                                     tileProviderInfo.name + '</a>';
            } else {
                tileProviderString = tileProviderInfo.name;
            }
            attribution += '\n';
            /* Translators: this is an attribution string giving credit to the
             * tile provider where the %s placeholder is replaced by either
             * the bare name of the tile provider, or a linkified URL if one
             * is available
             */
            attribution += _("Map tiles provided by %s").format(tileProviderString);
        }

        return attribution;
    },

    _onOpenShapeLayer: function() {
        let fileChooser = new ShapeLayerFileChooser({
            transient_for: this,
        });

        fileChooser.connect('response', (function(widget, response) {
            if (response === Gtk.ResponseType.ACCEPT) {
                this._mapView.openShapeLayers(fileChooser.get_files());
                this.layersPopover.popdown();
            }
            fileChooser.destroy();
        }).bind(this));
        fileChooser.show();
    },

    markBusy: function() {
        if (this._busySignalId !== 0)
            return;

        this._busy.show();

        let stage = this._mapView.view.get_stage();
        this._busySignalId = stage.connect('captured-event', function() {
            return true;
        });
    },

    unmarkBusy: function() {
        this._busy.hide();

        let stage = this._mapView.view.get_stage();
        stage.disconnect(this._busySignalId);
        this._busySignalId = 0;
    }
});
