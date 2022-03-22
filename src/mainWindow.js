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

const _ = imports.gettext.gettext;

const Champlain = imports.gi.Champlain;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;

const Application = imports.application;
const ContextMenu = imports.contextMenu;
const ExportViewDialog = imports.exportViewDialog;
const FavoritesPopover = imports.favoritesPopover;
const Geoclue = imports.geoclue;
const GeocodeFactory = imports.geocode;
const HeaderBar = imports.headerBar;
const LocationServiceDialog = imports.locationServiceDialog;
const MapView = imports.mapView;
const PlaceBar = imports.placeBar;
const PlaceEntry = imports.placeEntry;
const PlaceStore = imports.placeStore;
const PrintOperation = imports.printOperation;
const Service = imports.service;
const ShapeLayer = imports.shapeLayer;
const Sidebar = imports.sidebar;
const Utils = imports.utils;

const _CONFIGURE_ID_TIMEOUT = 100; // msecs
const _ADAPTIVE_VIEW_WIDTH = 700;
const _PLACE_ENTRY_MARGIN = 35;

var ShapeLayerFileChooser = GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/shape-layer-file-chooser.ui'
}, class ShapeLayerFileChooser extends Gtk.FileChooserNative {

    _init(params) {
        super._init(params);
        let allFilter = new Gtk.FileFilter();
        allFilter.set_name(_("All Layer Files"));
        this.add_filter(allFilter);
        this.set_filter(allFilter);
        this.title = _("Open Shape Layer");

        ShapeLayer.SUPPORTED_TYPES.forEach((layerClass) => {
            let filter = new Gtk.FileFilter();
            [filter, allFilter].forEach((f) => {
                layerClass.mimeTypes.forEach((type) => {
                    f.add_mime_type(type);
                });
            });
            filter.set_name(layerClass.displayName);
            this.add_filter(filter);
        });
    }
});

var MainWindow = GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/main-window.ui',
    InternalChildren: [ 'headerBar',
                        'grid',
                        'mainStack',
                        'mainGrid',
                        'noNetworkView',
                        'actionBar',
                        'actionBarRevealer',
                        'placeBarContainer']
}, class MainWindow extends Gtk.ApplicationWindow {

    get mapView() {
        return this._mapView;
    }

    get placeEntry() {
        return this._placeEntry;
    }

    _init(params) {
        super._init(params);

        this._configureId = 0;

        this._mapView = new MapView.MapView({
            mapType: this.application.local_tile_path ?
                MapView.MapType.LOCAL : undefined,
            mainWindow: this });

        this._mainGrid.attach(this._mapView, 0, 0, 1, 1);

        this._mapView.gotoUserLocation(false);

        this._sidebar = this._createSidebar();

        this._contextMenu = new ContextMenu.ContextMenu({ mapView: this._mapView,
                                                          mainWindow: this });

        if (pkg.name.endsWith('.Devel'))
            this.get_style_context().add_class('devel');

        this._initActions();
        this._initHeaderbar();
        this._initSignals();
        this._restoreWindowGeometry();
        this._initDND();
        this._initPlaceBar();

        this._grid.attach(this._sidebar, 1, 0, 1, 2);

        this._grid.show_all();

        /* for some reason, setting the title of the window through the .ui
         * template does not work anymore (maybe has something to do with
         * setting a custom title on the headerbar). Setting it programmatically
         * here works though. And yields a proper label in the gnome-shell
         * overview.
         */
        this.title = _("Maps");
    }

    _createPlaceEntry() {
        let placeEntry = new PlaceEntry.PlaceEntry({ mapView: this._mapView,
                                                     visible: true,
                                                     margin_start: _PLACE_ENTRY_MARGIN,
                                                     margin_end: _PLACE_ENTRY_MARGIN,
                                                     max_width_chars: 50,
                                                     loupe: true,
                                                     matchRoute: true
                                                   });
        placeEntry.connect('notify::place', () => {
            if (placeEntry.place) {
                this._mapView.showPlace(placeEntry.place, true);
            }
        });

        let popover = placeEntry.popover;
        popover.connect('selected', () => this._mapView.grab_focus());
        this._mapView.view.connect('button-press-event', () => popover.hide());
        return placeEntry;
    }

    _createSidebar() {
        let sidebar = new Sidebar.Sidebar(this._mapView);

        Application.routeQuery.connect('notify', () => this._setRevealSidebar(true));
        this.application.bind_property('connected',
                                       sidebar, 'visible',
                                       GObject.BindingFlags.DEFAULT);
        return sidebar;
    }

    _initPlaceBar() {
        this._placeBar = new PlaceBar.PlaceBar({ mapView: this._mapView,
                                                 visible: true });
        this._placeBarContainer.add(this._placeBar);

        this.application.bind_property('selected-place',
                                       this._placeBar, 'place',
                                       GObject.BindingFlags.DEFAULT);
    }

    _initDND() {
        this.drag_dest_set(Gtk.DestDefaults.DROP, null, 0);
        this.drag_dest_add_uri_targets();

        this.connect('drag-motion', (widget, ctx, x, y, time) => {
            Gdk.drag_status(ctx, Gdk.DragAction.COPY, time);
            return true;
        });

        this.connect('drag-data-received', (widget, ctx, x, y, data, info, time) => {
            let files = data.get_uris().map(Gio.file_new_for_uri);
            if (this._mapView.openShapeLayers(files))
                Gtk.drag_finish(ctx, true, false, time);
            else
                Gtk.drag_finish(ctx, false, false, time);
        });
    }

    _initActions() {
        let actions = {
            'about': {
                onActivate: () => this._onAboutActivate()
            },
            'map-type-menu': {
                state: ['b', false],
                onActivate: () => this._onMapTypeMenuActivate()
            },
            'hybrid-aerial': {
                paramType:     'b',
                setting:       'hybrid-aerial'
            },
            'goto-user-location': {
                accels: ['<Primary>L'],
                onActivate: () => this._onGotoUserLocationActivate()
            },
            'goto-antipode-location': {
                accels: ['<Primary>A'],
                onActivate: () => this._mapView.gotoAntipode()
            },
            'toggle-sidebar': {
                accels: ['<Primary>D'],
                state: ['b', false],
                onChangeState: (a, v) => this._onToggleSidebarChangeState(a, v)
            },
            'zoom-in': {
                accels: ['plus', '<Primary>plus', 'KP_Add', '<Primary>KP_Add', 'equal', '<Primary>equal'],
                onActivate: () => this._mapView.view.zoom_in()
            },
            'zoom-out': {
                accels: ['minus', '<Primary>minus', 'KP_Subtract', '<Primary>KP_Subtract'],
                onActivate:  () => this._mapView.view.zoom_out()
            },
            'toggle-scale': {
                accels: ['<Primary>S'],
                onActivate:  () => this._mapView.toggleScale()
            },
            'find': {
                accels: ['<Primary>F'],
                onActivate: () => this._placeEntry.grab_focus()
            },
            'print-route': {
                accels: ['<Primary>P'],
                onActivate: () => this._printRouteActivate()
            },
            'open-shape-layer': {
                accels: ['<Primary>O'],
                onActivate: () => this._onOpenShapeLayer()
            },
            'export-as-image': {
                onActivate: () => this._onExportActivated()
            }
        };

        // when aerial tiles are available, add shortcuts to switch
        if (Service.getService().tiles.aerial) {
            actions['switch-to-street-view'] = {
                accels: ['<Primary>1', '<Primary>KP_1'],
                onActivate: () => this._onStreetViewActivate()
            };

            actions['switch-to-aearial-view'] = {
                accels: ['<Primary>2', '<Primary>KP_2'],
                onActivate: () => this._onAerialViewActivate()
            };
        }

        Utils.addActions(this, actions, Application.settings);
    }

    _initSignals() {
        this.connect('delete-event', this._quit.bind(this));
        this.connect('configure-event',
                     this._onConfigureEvent.bind(this));

        this.connect('window-state-event',
                     this._onWindowStateEvent.bind(this));
        this._mapView.view.connect('button-press-event', () => {
            // Can not call something that will generate clutter events
            // from a clutter event-handler. So use an idle.
            Mainloop.idle_add(() => this._mapView.grab_focus());
        });

        this.application.connect('notify::connected', () => {
            if (this.application.connected || this.application.local_tile_path)
                this._mainStack.visible_child = this._mainGrid;
            else
                this._mainStack.visible_child = this._noNetworkView;
        });

        /*
         * If the currently focused widget is an entry then we will
         * hijack the key-press to the main window and make sure that
         * they reach the entry before they can be swallowed as accelerator.
         */
        /* TODO: GTK 4. This should probably be handled by something like
         * setting the map view as key capture widget for the search entry
         */
        this.connect('key-press-event', (window, event) => {
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
        });

        this._mapView.view.connect('notify::zoom-level',
                                   this._updateZoomButtonsSensitivity.bind(this));
        this._mapView.view.connect('notify::max-zoom-level',
                                   this._updateZoomButtonsSensitivity.bind(this));
        this._mapView.view.connect('notify::min-zoom-level',
                                   this._updateZoomButtonsSensitivity.bind(this));
    }

    _updateZoomButtonsSensitivity() {
        let zoomLevel = this._mapView.view.zoom_level;
        let maxZoomLevel = this._mapView.view.max_zoom_level;
        let minZoomLevel = this._mapView.view.min_zoom_level;
        let zoomInAction = this.lookup_action("zoom-in");
        let zoomOutAction = this.lookup_action("zoom-out");

        if (zoomLevel >= maxZoomLevel)
            zoomInAction.set_enabled(false);
        else
            zoomInAction.set_enabled(true);

        if (zoomLevel <= minZoomLevel)
            zoomOutAction.set_enabled(false);
        else
            zoomOutAction.set_enabled(true);
    }

    _updateLocationSensitivity() {
        let sensitive = (Application.geoclue.state !== Geoclue.State.INITIAL &&
                         (this.application.connected ||
                          this.application.local_tile_path));

        this.lookup_action("goto-user-location").set_enabled(sensitive);
    }

    _initHeaderbar() {
        this._headerBarLeft = new HeaderBar.HeaderBarLeft({
            mapView: this._mapView,
            application: this.application
        });
        this._headerBar.pack_start(this._headerBarLeft);

        this._headerBarRight = new HeaderBar.HeaderBarRight({
            mapView: this._mapView,
            application: this.application
        });
        this._headerBar.pack_end(this._headerBarRight);

        this._placeEntry = this._createPlaceEntry();
        this._headerBar.custom_title = this._placeEntry;

        Application.geoclue.connect('notify::state',
                                    this._updateLocationSensitivity.bind(this));
        this.application.connect('notify::connected', () => {
            let app = this.application;

            this._updateLocationSensitivity();
            this._placeEntry.sensitive = app.connected;
        });

        // action bar, for when the window is too narrow for the full headerbar
        this._actionBarLeft =  new HeaderBar.HeaderBarLeft({
            mapView: this._mapView,
            application: this.application
        })
        this._actionBar.pack_start(this._actionBarLeft);

        this._actionBarRight = new HeaderBar.HeaderBarRight({
            mapView: this._mapView,
            application: this.application
        })
        this._actionBar.pack_end(this._actionBarRight);

        this.connect('size-allocate', () => {
            let [width, height] = this.get_size();
            if (width < _ADAPTIVE_VIEW_WIDTH) {
                this.application.adaptive_mode = true;
                this._headerBarLeft.hide();
                this._headerBarRight.hide();
                this._actionBarRevealer.set_reveal_child(true);
                this._placeEntry.set_margin_start(0);
                this._placeEntry.set_margin_end(0);
            } else {
                this.application.adaptive_mode = false;
                this._headerBarLeft.show();
                this._headerBarRight.show();
                this._actionBarRevealer.set_reveal_child(false);
                this._placeEntry.set_margin_start(_PLACE_ENTRY_MARGIN);
                this._placeEntry.set_margin_end(_PLACE_ENTRY_MARGIN);
            }
        });
    }

    _saveWindowGeometry() {
        let window = this.get_window();
        let state = window.get_state();

        if (state & Gdk.WindowState.MAXIMIZED)
            return;

        // GLib.Variant.new() can handle arrays just fine
        let size = this.get_size();
        Application.settings.set('window-size', size);

        let position = this.get_position();
        Application.settings.set('window-position', position);
    }

    _restoreWindowGeometry() {
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
    }

    _onConfigureEvent(widget, event) {
        if (this._configureId !== 0) {
            Mainloop.source_remove(this._configureId);
            this._configureId = 0;
        }

        this._configureId = Mainloop.timeout_add(_CONFIGURE_ID_TIMEOUT, () => {
            this._saveWindowGeometry();
            this._configureId = 0;
            return false;
        });
    }

    _onWindowStateEvent(widget, event) {
        let window = widget.get_window();
        let state = window.get_state();

        if (state & Gdk.WindowState.FULLSCREEN)
            return;

        let maximized = (state & Gdk.WindowState.MAXIMIZED);
        Application.settings.set('window-maximized', maximized);
    }

    _quit() {
        // remove configure event handler if still there
        if (this._configureId !== 0) {
            Mainloop.source_remove(this._configureId);
            this._configureId = 0;
        }

        // always save geometry before quitting
        this._saveWindowGeometry();

        return false;
    }

    _onGotoUserLocationActivate() {
        let message;

        if (Application.geoclue.state === Geoclue.State.ON) {
            this._mapView.gotoUserLocation(true);
            return;
        }

        Application.geoclue.start(() => {
            switch(Application.geoclue.state) {
            case Geoclue.State.FAILED:
                message = _("Failed to connect to location service");
                Utils.showDialog(message, Gtk.MessageType.ERROR, this);
                break;

            case Geoclue.State.DENIED:
                let dialog = new LocationServiceDialog.LocationServiceDialog({
                    visible: true,
                    transient_for: this,
                    modal: true });

                dialog.connect('response', () => dialog.destroy());
                dialog.show_all();
                break;

            default:
                this._mapView.gotoUserLocation(true);
                break;
            }
        });
    }

    _activateExport() {
        let view = this._mapView.view;
        let surface = view.to_surface(true);
        let bbox = view.get_bounding_box();
        let [latitude, longitude] = bbox.get_center();

        let dialog = new ExportViewDialog.ExportViewDialog({
            transient_for: this,
            modal: true,
            surface: surface,
            latitude: latitude,
            longitude: longitude,
            mapView: this._mapView
        });

        dialog.connect('response', () => dialog.destroy());
        dialog.show_all();
    }

    _onExportActivated() {
        if (this._mapView.view.state === Champlain.State.DONE) {
            this._activateExport();
        } else {
            let notifyId = this._mapView.view.connect('notify::state', () => {
                if (this._mapView.view.state === Champlain.State.DONE) {
                    this._mapView.view.disconnect(notifyId);
                    this._activateExport();
                }
            });
        }
    }

    _printRouteActivate() {
        if (this._mapView.routeShowing) {
            let operation = new PrintOperation.PrintOperation({ mainWindow: this });
        }
    }

    _onMapTypeMenuActivate(action) {
        let state = action.get_state().get_boolean();
        action.set_state(GLib.Variant.new('b', !state));
    }

    _onStreetViewActivate() {
        this._mapView.setMapType(MapView.MapType.STREET);
    }

    _onAerialViewActivate() {
        // don't attempt to switch to aerial if we don't have tiles for it
        if (Service.getService().tiles.aerial) {
            this._mapView.setMapType(MapView.MapType.AERIAL);
        }
    }

    _onToggleSidebarChangeState(action, variant) {
        action.set_state(variant);

        let reveal = variant.get_boolean();
        this._sidebar.set_reveal_child(reveal);
    }

    _setRevealSidebar(value) {
        let action = this.lookup_action('toggle-sidebar');
        action.change_state(GLib.Variant.new_boolean(value));
    }

    _onAboutActivate() {
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
            logo_icon_name: pkg.name,
            version: pkg.version,
            website: 'https://live.gnome.org/Apps/Maps',
            wrap_license: true,

            modal: true,
            transient_for: this
        });

        let copyright = _("Copyright © 2011 – 2022 Red Hat, Inc. and The GNOME Maps authors");
        let attribution = this._getAttribution();

        copyright += '\n' + attribution;

        /* HACK: we need to poke into gtkaboutdialog internals
         * to set the copyright with markup like attribution requires
         */

        let copyrightLabel = aboutDialog.get_template_child(Gtk.AboutDialog, 'copyright_label');
        copyrightLabel.set_markup('<span size="small">' + copyright + '</span>');
        copyrightLabel.show();

        aboutDialog.show();
        aboutDialog.connect('response', () => aboutDialog.destroy());
    }

    _getAttribution() {
        let tileProviderInfo = Service.getService().tileProviderInfo;
        let photonGeocode = Service.getService().photonGeocode;
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

        let provider = GeocodeFactory.getGeocoder().attribution;
        let providerUrl = GeocodeFactory.getGeocoder().attributionUrl;
        let geocoderName = GeocodeFactory.getGeocoder().name;
        let geocoderUrl = GeocodeFactory.getGeocoder().url;

        let providerString;
        if (providerUrl) {
            providerString =
                '<a href="' + providerUrl + '">' + provider + '</a>';
        } else {
            providerString = provider;
        }

        let geocoderLink =
            '<a href="%s">%s</a>'.format(geocoderUrl, geocoderName);

        attribution += '\n';
        /* Translators: this is an attribution string giving credit to the
         * search provider where the first %s placeholder is replaced by either
         * the bare name of the geocoder provider, or a linkified URL if one
         * is available, and the second %s placeholder is replaced by the
         * URL to the geocoder project page. These placeholders
         * can be swapped, if needed using the %n$s positional syntax
         * (i.e. "%2$s ... %1$s ..." for positioning the project URL
         * before the provider).
         */
        attribution += _("Search provided by %s using %s").
            format(providerString, geocoderLink);

        return attribution;
    }

    _onOpenShapeLayer() {
        this._fileChooser = new ShapeLayerFileChooser({
            transient_for: this,
        });

        this._fileChooser.connect('response', (widget, response) => {
            if (response === Gtk.ResponseType.ACCEPT) {
                this._mapView.openShapeLayers(this._fileChooser.get_files());
                this._headerBarLeft.popdownLayersPopover();
                this._actionBarLeft.popdownLayersPopover();
            }
            this._fileChooser.destroy();
        });
        this._fileChooser.show();
    }
});
