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

import gettext from 'gettext';

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Shumate from 'gi://Shumate';

import {Application} from './application.js';
import {ExportViewDialog} from './exportViewDialog.js';
import {FavoritesPopover} from './favoritesPopover.js';
import * as Geoclue from './geoclue.js';
import * as GeocodeFactory from './geocode.js';
import {HeaderBarLeft, HeaderBarRight} from './headerBar.js';
import {MapView} from './mapView.js';
import {PlaceBar} from './placeBar.js';
import {PlaceStore} from './placeStore.js';
import {PrintOperation} from './printOperation.js';
import {SearchBar} from './searchBar.js';
import * as Service from './service.js';
import {ShapeLayer} from './shapeLayer.js';
import {Sidebar} from './sidebar.js';
import * as Utils from './utils.js';
import {ZoomAndRotateControls} from './zoomAndRotateControls.js';

const _ = gettext.gettext;

const _CONFIGURE_ID_TIMEOUT = 100; // msecs
const _PLACE_ENTRY_MARGIN = 36;

class ShapeLayerFileChooser extends Gtk.FileChooserNative {

    constructor(params) {
        super(params);

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
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/shape-layer-file-chooser.ui'
}, ShapeLayerFileChooser);

export class MainWindow extends Adw.ApplicationWindow {

    get mapView() {
        return this._mapView;
    }

    get searchBar() {
        return this._searchBar;
    }

    get sidebar() {
        return this._sidebar;
    }

    constructor(params) {
        super(params);

        this._configureId = 0;

        this._mapView = new MapView({
            mapType: this.application.local_tile_path ?
                MapView.MapType.LOCAL : undefined,
            mainWindow: this,
            hexpand: true,
            vexpand: true });

        this._mapOverlay.child = this._mapView;

        this._mapOverlay.add_overlay(
            new ZoomAndRotateControls({ mapView: this._mapView,
                                        halign:  Gtk.Align.START,
                                        valign:  Gtk.Align.START,
                                        margin_start: 6,
                                        margin_top: 6 }));

        this._mapView.gotoUserLocation(false);

        this._sidebar = this._createSidebar();

        if (pkg.name.endsWith('.Devel'))
            this.get_style_context().add_class('devel');

        this._initActions();
        this._initHeaderbar();
        this._initSignals();
        this._restoreWindowGeometry();
        this._initDND();
        this._initPlaceBar();

        this._splitView.sidebar = this._sidebar;
        this._splitView.connect('notify::show-sidebar', () => {
            this._setRevealSidebar(this._splitView.show_sidebar);
        });

        /* for some reason, setting the title of the window through the .ui
         * template does not work anymore (maybe has something to do with
         * setting a custom title on the headerbar). Setting it programmatically
         * here works though. And yields a proper label in the gnome-shell
         * overview.
         */
        this.title = _("Maps");

        this._breakpoint.connect('apply', () => this._onBreakpointApplied());
        this._breakpoint.connect('unapply', () => this._onBreakpointUnapplied());
    }

    showToast(message) {
        Utils.showToastInOverlay(message, this._overlay);
    }

    addToast(toast) {
        this._overlay.add_toast(toast);
    }

    _createSearchBar() {
        let searchBar = new SearchBar({ mapView: this._mapView,
                                        margin_start: _PLACE_ENTRY_MARGIN,
                                        margin_end: _PLACE_ENTRY_MARGIN });
        searchBar.connect('notify::place', () => {
            if (searchBar.place) {
                this._mapView.showPlace(searchBar.place, true);
            }
        });

        let popover = searchBar.popover;
        popover.connect('selected', () => this._mapView.map.grab_focus());

        this._buttonPressGesture = new Gtk.GestureSingle();
        this._mapView.map.add_controller(this._buttonPressGesture);
        this._buttonPressGesture.connect('begin', () => popover.popdown());
        return searchBar;
    }

    _createSidebar() {
        let sidebar = new Sidebar({ mapView: this._mapView });

        Application.routeQuery.connect('notify', () => this._setRevealSidebar(true));

        return sidebar;
    }

    _initPlaceBar() {
        this._placeBar = new PlaceBar({ mapView: this._mapView, mainWindow: this });
        this._placeBarContainer.append(this._placeBar);

        this.application.bind_property('selected-place',
                                       this._placeBar, 'place',
                                       GObject.BindingFlags.DEFAULT);
    }

    _initDND() {
        this._dropTarget = Gtk.DropTarget.new(Gio.File, Gdk.DragAction.COPY);
        this.add_controller(this._dropTarget);

        this._dropTarget.connect('drop', (target, value, x, y, data) => {
            let list = new Gio.ListStore(Gio.File.Gtype);

            list.insert(0, value);

            return this._mapView.openShapeLayers(list);
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
            'goto-user-location': {
                accels: ['<Primary>L'],
                onActivate: () => this._onGotoUserLocationActivate()
            },
            'goto-antipode-location': {
                accels: ['<Primary>I'],
                onActivate: () => this._mapView.gotoAntipode()
            },
            'toggle-sidebar': {
                accels: ['<Primary>D'],
                state: ['b', false],
                onChangeState: (a, v) => this._onToggleSidebarChangeState(a, v)
            },
            'zoom-in': {
                accels: ['<Primary>plus', 'KP_Add', '<Primary>KP_Add', '<Primary>equal'],
                onActivate: () => this._mapView.zoomIn()
            },
            'zoom-out': {
                accels: ['<Primary>minus', 'KP_Subtract', '<Primary>KP_Subtract'],
                onActivate:  () => this._mapView.zoomOut()
            },
            'rotate-clockwise': {
                accels: ['<Primary>Right'],
                onActivate: () => this._rotateMap(Math.PI / 32)
            },
            'rotate-counter-clockwise': {
                accels: ['<Primary>Left'],
                onActivate: () => this._rotateMap(-Math.PI / 32)
            },
            'reset-rotation': {
                accels: ['<Primary>Up'],
                onActivate: () => { this._mapView.map.viewport.rotation = 0.0; }
            },
            'show-scale': {
                accels: ['<Primary>S'],
                paramType: 'b',
                setting: 'show-scale'
            },
            'find': {
                accels: ['<Primary>F'],
                onActivate: () => this._onFindActivate()
            },
            'browse': {
                accels: ['<Shift><Primary>F'],
                onActivate: () => this._onBrowseActivate()
            },
            'show-search-results': {
                accels: ['<Primary>R'],
                onActivate: () => this._onShowSearchResultsActivate()
            },
            'print-route': {
                accels: ['<Primary>P'],
                onActivate: () => this._printRouteActivate()
            },
            'open-shape-layer': {
                accels: ['<Primary>O'],
                onActivate: () => this._onOpenShapeLayer()
            },
            'show-main-menu': {
                accels: ['F10'],
                onActivate: () => this._showMainMenu()
            },
            'export-as-image': {
                onActivate: () => this._onExportActivated()
            },
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

        if (Shumate.VectorRenderer.is_supported()) {
            actions['enable-vector-layer'] = {
                state: ['b', Application.settings.get('map-type') === MapView.MapType.VECTOR],
                onChangeState: (action, variant) => {
                    action.set_state(variant);
                    const state = variant.get_boolean();
                    this._mapView.setMapType(state ? MapView.MapType.VECTOR : MapView.MapType.STREET);
                }
            };
        }

        Utils.addActions(this, actions, Application.settings);
    }

    _initSignals() {
        this.connect('close-request', () => this._quit());
        this.connect('notify::default-width', () => this._onSizeChanged());
        this.connect('notify::default-height', () => this._onSizeChanged());
        this.connect('notify::maximized', () => this._onMaximizedChanged());

        let viewport = this._mapView.map.viewport;

        viewport.connect('notify::zoom-level',
                         this._updateZoomButtonsSensitivity.bind(this));
        viewport.connect('notify::max-zoom-level',
                         this._updateZoomButtonsSensitivity.bind(this));
        viewport.connect('notify::min-zoom-level',
                         this._updateZoomButtonsSensitivity.bind(this));

        this._updateZoomButtonsSensitivity();
    }

    _updateZoomButtonsSensitivity() {
        let zoomLevel = this._mapView.map.viewport.zoom_level;
        let maxZoomLevel = this._mapView.map.viewport.max_zoom_level;
        let minZoomLevel = this._mapView.map.viewport.min_zoom_level;
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
        let sensitive = Application.geoclue.state !== Geoclue.State.INITIAL;

        this.lookup_action("goto-user-location").set_enabled(sensitive);
    }

    _initHeaderbar() {
        this._headerBarLeft = new HeaderBarLeft({ mapView: this._mapView });
        this._headerBar.pack_start(this._headerBarLeft);

        this._headerBarRight = new HeaderBarRight({ mapView: this._mapView });
        this._headerBar.pack_end(this._headerBarRight);

        this._searchBar = this._createSearchBar();
        this._headerBar.title_widget = this._searchBar;

        Application.geoclue.connect('notify::state',
                                    this._updateLocationSensitivity.bind(this));

        // action bar, for when the window is too narrow for the full headerbar
        this._actionBarLeft =  new HeaderBarLeft({ mapView: this._mapView });
        this._actionBar.pack_start(this._actionBarLeft);

        this._actionBarRight = new HeaderBarRight({ mapView: this._mapView });
        this._actionBar.pack_end(this._actionBarRight);
    }

    _onBreakpointApplied() {
        this.application.adaptive_mode = true;
        this._headerBarLeft.hide();
        this._headerBarRight.hide();
        this._searchBar.set_margin_start(0);
        this._searchBar.set_margin_end(0);
    }

    _onBreakpointUnapplied() {
        this.application.adaptive_mode = false;
        this._headerBarLeft.show();
        this._headerBarRight.show();
        this._searchBar.set_margin_start(_PLACE_ENTRY_MARGIN);
        this._searchBar.set_margin_end(_PLACE_ENTRY_MARGIN);
    }

    _saveWindowGeometry() {
        if (this.maximized)
            return;

        // GLib.Variant.new() can handle arrays just fine
        Application.settings.set('window-size',
                                 [this.default_width, this.default_height]);
    }

    _restoreWindowGeometry() {
        let size = Application.settings.get('window-size');
        if (size.length === 2) {
            let [width, height] = size;
            this.set_default_size(width, height);
        }

        if (Application.settings.get('window-maximized'))
            this.maximize();
    }

    _onSizeChanged() {
        if (this._configureId !== 0) {
            GLib.source_remove(this._configureId);
            this._configureId = 0;
        }

        this._configureId = GLib.timeout_add(null, _CONFIGURE_ID_TIMEOUT, () => {
            this._saveWindowGeometry();
            this._configureId = 0;
            return false;
        });
    }

    _onMaximizedChanged() {
        Application.settings.set('window-maximized', this.maximized);
    }

    _quit() {
        // remove configure event handler if still there
        if (this._configureId !== 0) {
            GLib.source_remove(this._configureId);
            this._configureId = 0;
        }

        // always save geometry before quitting
        this._saveWindowGeometry();

        return false;
    }

    _onFindActivate() {
        let placeEntry = this._searchBar.placeEntry;

        placeEntry.grab_focus();
        placeEntry.select_region(0, placeEntry.text.length);
    }

    _onBrowseActivate() {
        this._searchBar.placeEntry.browsePois();
    }

    _onShowSearchResultsActivate() {
        if (this._searchBar.placeEntry.popover.numResults > 0) {
            this._searchBar.placeEntry.popover.showResult();
            this._searchBar.placeEntry.grab_focus();
        }
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
                this.showToast(_("Failed to connect to location service"));
                break;

            case Geoclue.State.DENIED:
                let locationServiceToast =
                    new Adw.Toast({ title: _("Turn on location services"),
                                    button_label: _("Location Settings") });

                locationServiceToast.connect('button-clicked', () => {
                    let privacyInfo =
                        Gio.DesktopAppInfo.new('gnome-location-panel.desktop');

                    try {
                        let display = Gdk.Display.get_default();

                        privacyInfo.launch([], display.get_app_launch_context());
                    } catch(e) {
                        Utils.debug('launching privacy panel failed: ' + e);
                    }
                });

                this.addToast(locationServiceToast);

                break;

            default:
                this._mapView.gotoUserLocation(true);
                break;
            }
        });
    }

    _onExportActivated() {
        let {x, y, width, height} = this._mapView.get_allocation();
        let paintable = new Gtk.WidgetPaintable({ widget: this._mapView });
        let [latitude, longitude] =
            this._mapView.map.viewport.widget_coords_to_location(this._mapView.map,
                                                                 width / 2,
                                                                 height / 2);

        let dialog = new ExportViewDialog({
            transient_for: this,
            modal: true,
            paintable: paintable,
            latitude: latitude,
            longitude: longitude,
            width: width,
            height: height,
            mapView: this._mapView
        });

        dialog.connect('response', () => dialog.destroy());
        dialog.show();
    }

    _rotateMap(angle) {
        let rotation = this._mapView.map.viewport.rotation;

        rotation += angle;

        // keep the rotation in [0..2 * PI)
        if (rotation < 0)
            rotation += 2 * Math.PI
        else if (rotation >= 2 * Math.PI)
            rotation -= 2 * Math.PI;

        /* if the resulting angle is close to 0, snap back to 0 to avoid
         * rounding errors adding when doing multiple rotations
         */
        if (rotation < 0.01 || 2 * Math.PI - rotation < 0.01)
            rotation = 0;

        this._mapView.map.viewport.rotation = rotation;
    }

    _printRouteActivate() {
        if (this._mapView.routeShowing) {
            let operation = new PrintOperation({ mainWindow: this });
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
        this._splitView.show_sidebar = reveal;

        if (reveal)
            this._splitView.sidebar.focusStartEntry();
        else
            this._mapView.map.grab_focus();
    }

    _setRevealSidebar(value) {
        let action = this.lookup_action('toggle-sidebar');
        action.change_state(GLib.Variant.new_boolean(value));
    }

    _onAboutActivate() {
        let about = new Adw.AboutWindow({
            designers: [ 'Jakub Steiner <jimmac@gmail.com>',
                         'Andreas Nilsson <nisses.mail@home.se>' ],
            developers: [ 'Zeeshan Ali (Khattak) <zeeshanak@gnome.org>',
                          'Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>',
                          'Jonas Danielsson <jonas@threetimestwo.org>',
                          'Marcus Lundblad <ml@dfupdate.se>'],
            developer_name: _("The GNOME Project"),
            translator_credits: _("translator-credits"),
            /* Translators: This is the program name. */
            application_name: _("Maps"),
            application_icon: pkg.name,
            copyright: _("Copyright © 2011 – 2023 Red Hat, Inc. and The GNOME Maps authors"),
            license_type: Gtk.License.GPL_2_0,
            version: pkg.version,
            website: 'https://apps.gnome.org/Maps/',
            issue_url: 'https://gitlab.gnome.org/GNOME/gnome-maps/-/issues/new',
            transient_for: this
        });

        this._addAttribution(about);

        about.present();
    }

    _addAttribution(about) {
        let tileProviderInfo = Service.getService().tileProviderInfo;
        let photonGeocode = Service.getService().photonGeocode;
        let attribution = _("Map data by %s and contributors").format('<a href="https://www.openstreetmap.org">OpenStreetMap</a>');
        about.add_legal_section(_("Map Data Provider"), null, Gtk.License.CUSTOM, attribution);

        if (tileProviderInfo) {
            let tileProviderString;
            if (tileProviderInfo.url) {
                tileProviderString = '<a href="' + tileProviderInfo.url + '">' +
                                     tileProviderInfo.name + '</a>';
            } else {
                tileProviderString = tileProviderInfo.name;
            }

            about.add_legal_section(
                _("Map Tile Provider"),
                null,
                Gtk.License.CUSTOM,
                /* Translators: this is an attribution string giving credit to the
                * tile provider where the %s placeholder is replaced by either
                * the bare name of the tile provider, or a linkified URL if one
                * is available
                */
                _("Map tiles provided by %s").format(tileProviderString)
            );
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

        /* Translators: this is an attribution string giving credit to the
         * search provider where the first %s placeholder is replaced by either
         * the bare name of the geocoder provider, or a linkified URL if one
         * is available, and the second %s placeholder is replaced by the
         * URL to the geocoder project page. These placeholders
         * can be swapped, if needed using the %n$s positional syntax
         * (i.e. "%2$s ... %1$s ..." for positioning the project URL
         * before the provider).
         */
        about.add_legal_section(
            _("Search Provider"),
            null,
            Gtk.License.CUSTOM,
            _("Search provided by %s using %s").format(providerString, geocoderLink)
        );

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

    _showMainMenu() {
        this._mainMenuButton.activate();
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/main-window.ui',
    InternalChildren: [ 'headerBar',
                        'mainMenuButton',
                        'grid',
                        'actionBar',
                        'placeBarContainer',
                        'overlay',
                        'mapOverlay',
                        'splitView',
                        'breakpoint' ]
}, MainWindow);
