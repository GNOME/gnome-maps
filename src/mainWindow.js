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

const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Champlain = imports.gi.Champlain;
const GObject = imports.gi.GObject;

const Lang = imports.lang;
const Mainloop = imports.mainloop;

const Application = imports.application;
const MapView = imports.mapView;
const LayersPopover = imports.layersPopover;
const ContextMenu = imports.contextMenu;
const PlaceEntry = imports.placeEntry;
const PlaceStore = imports.placeStore;
const Sidebar = imports.sidebar;
const Utils = imports.utils;
const Config = imports.config;
const ZoomControl = imports.zoomControl;

const _ = imports.gettext.gettext;

const _CONFIGURE_ID_TIMEOUT = 100; // msecs
const _WINDOW_MIN_WIDTH = 600;
const _WINDOW_MIN_HEIGHT = 500;

const MainWindow = new Lang.Class({
    Name: 'MainWindow',

    _init: function(app, overlay) {
        this._configureId = 0;
        let ui = Utils.getUIObject('main-window', [ 'app-window',
                                                    'header-bar',
                                                    'grid',
                                                    'layers-button']);
        this.window = ui.appWindow;
        this.window.application = app;
        this._overlay = overlay;

        this.mapView = new MapView.MapView();
        overlay.add(this.mapView);

        this.mapView.gotoUserLocation(false);

        this._sidebar = new Sidebar.Sidebar(this.mapView);
        Application.routeService.route.connect('update',
                                               this._setRevealSidebar.bind(this, true));

        this._contextMenu = new ContextMenu.ContextMenu(this.mapView);

        ui.layersButton.popover = new LayersPopover.LayersPopover();

        let placeEntry = this._createPlaceEntry();
        ui.headerBar.set_custom_title(placeEntry);
        placeEntry.has_focus = true;

        this._initActions();
        this._initSignals();
        this._restoreWindowGeometry();

        this._overlay.add_overlay(new ZoomControl.ZoomControl(this.mapView));

        ui.grid.attach(this._overlay, 0, 0, 1, 1);
        ui.grid.attach(this._sidebar, 1, 0, 1, 1);

        ui.grid.show_all();
    },

    _createPlaceEntry: function() {
        let placeEntry = new PlaceEntry.PlaceEntry({ mapView:       this.mapView,
                                                     visible:       true,
                                                     margin_start:  6,
                                                     margin_end:    6,
                                                     width_request: 500
                                                   });
        placeEntry.connect('notify::place', (function() {
            if (placeEntry.place) {
                this.mapView.showSearchResult(placeEntry.place);
                Application.placeStore.addRecent(placeEntry.place);
            }
        }).bind(this));

        let popover = placeEntry.popover;
        popover.connect('selected',
                        this._overlay.grab_focus.bind(this._overlay));
        this.mapView.view.connect('button-press-event',
                                  popover.hide.bind(popover));
        return placeEntry;
    },

    _initActions: function() {
        Utils.initActions(this.window, [
            {
                properties: { name: 'close' },
                signalHandlers: { activate: this.window.close.bind(this.window) }
            }, {
                properties: { name: 'about' },
                signalHandlers: { activate: this._onAboutActivate }
            }, {
                properties: {
                    name: 'map-type-menu',
                    state: GLib.Variant.new('b', false)
                },
                signalHandlers: { activate: this._onMapTypeMenuActivate }
            }, {
                properties: {
                    name: 'map-type',
                    parameter_type: GLib.VariantType.new('s'),
                    state: GLib.Variant.new('s', 'STREET')
                },
                signalHandlers: { activate: this._onMapTypeActivate }
            }, {
                properties: { name: 'goto-user-location' },
                signalHandlers: { activate: this._onGotoUserLocationActivate }
            }, {
                properties: {
                    name: 'toggle-sidebar',
                    state: GLib.Variant.new_boolean(false)
                },
                signalHandlers: {
                    'change-state': this._onToggleSidebarChangeState
                }
            }
        ], this);

        let action = this.window.lookup_action('goto-user-location');
        Application.geoclue.bind_property('connected',
                                          action, 'enabled',
                                          GObject.BindingFlags.SYNC_CREATE);
    },

    _initSignals: function() {
        this.window.connect('delete-event', this._quit.bind(this));
        this.window.connect('configure-event',
                            this._onConfigureEvent.bind(this));
        this.window.connect('window-state-event',
                            this._onWindowStateEvent.bind(this));
        this.window.connect('key-press-event',
                            this._onKeyPressEvent.bind(this));

        this.mapView.view.connect('button-press-event',
                                  this._overlay.grab_focus.bind(this._overlay));
        this._viewMovedId = 0;
    },

    _saveWindowGeometry: function() {
        let window = this.window.get_window();
        let state = window.get_state();

        if (state & Gdk.WindowState.MAXIMIZED)
            return;

        // GLib.Variant.new() can handle arrays just fine
        let size = this.window.get_size();
        Application.settings.set('window-size', size);

        let position = this.window.get_position();
        Application.settings.set('window-position', position);
    },

    _restoreWindowGeometry: function() {
        let size = Application.settings.get('window-size');
        if (size.length === 2) {
            let [width, height] = size;
            this.window.set_default_size(width, height);
        }

        let position = Application.settings.get('window-position');
        if (position.length === 2) {
            let [x, y] = position;

            this.window.move(x, y);
        }

        if (Application.settings.get('window-maximized'))
            this.window.maximize();
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

    _onKeyPressEvent: function(widget, event) {
        let state = event.get_state()[1];

        if (state & Gdk.ModifierType.CONTROL_MASK) {
            let keyval = event.get_keyval()[1];

            if (keyval === Gdk.KEY_plus)
                this.mapView.view.zoom_in();

            if (keyval === Gdk.KEY_minus)
                this.mapView.view.zoom_out();
        }

        return false;
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

    _onGotoUserLocationActivate: function() {
        if (Application.geoclue.userSetLocation) {
            Utils.once(Application.geoclue,
                       'location-changed',
                       (function() {
                this.mapView.gotoUserLocation(true);
            }).bind(this));
            Application.geoclue.findLocation();
        } else
            this.mapView.gotoUserLocation(true);
    },

    _onMapTypeMenuActivate: function(action) {
        let state = action.get_state().get_boolean();
        action.set_state(GLib.Variant.new('b', !state));
    },

    _onMapTypeActivate: function(action, value) {
        action.set_state(value);
        let [mapType, len] = value.get_string();
        this.mapView.setMapType(MapView.MapType[mapType]);
    },

    _onToggleSidebarChangeState: function(action, variant) {
        action.set_state(variant);

        let reveal = variant.get_boolean();
        if (!reveal) {
            Application.routeService.route.reset();
            Application.routeService.query.reset();
        }
        this._sidebar.set_reveal_child(reveal);
    },

    _setRevealSidebar: function(value) {
        let action = this.window.lookup_action('toggle-sidebar');
        action.change_state(GLib.Variant.new_boolean(value));
    },

    _onAboutActivate: function() {
        let aboutDialog = new Gtk.AboutDialog({
            artists: [ 'Jakub Steiner <jimmac@gmail.com>',
                       'Andreas Nilsson <nisses.mail@home.se>' ],
            authors: [ 'Zeeshan Ali (Khattak) <zeeshanak@gnome.org>',
                       'Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>',
                       'Jonas Danielsson <jonas@threetimestwo.org>'],
            translator_credits: _("translator-credits"),
            /* Translators: This is the program name. */
            program_name: _("Maps"),
            comments: _("A map application for GNOME"),
            copyright: 'Copyright ' + String.fromCharCode(0x00A9) +
                       ' 2011' + String.fromCharCode(0x2013) +
                       '2013 Red Hat, Inc.',
            license_type: Gtk.License.GPL_2_0,
            logo_icon_name: 'gnome-maps',
            version: Config.PACKAGE_VERSION,
            website: 'https://live.gnome.org/Apps/Maps',
            wrap_license: true,

            modal: true,
            transient_for: this.window
        });
        aboutDialog.show();
        aboutDialog.connect('response',
                            aboutDialog.destroy.bind(aboutDialog));
    }
});
