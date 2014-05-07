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
const SearchPopup = imports.searchPopup;
const ContextMenu = imports.contextMenu;
const PlaceStore = imports.placeStore;
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
                                                    'search-entry',
                                                    'search-completion',
                                                    'layers-button']);
        this._searchEntry = ui.searchEntry;
        this._searchCompletion = ui.searchCompletion;
        this.window = ui.appWindow;
        this.window.application = app;
        this._placeStore = Application.placeStore;
        this._overlay = overlay;

        ui.appWindow.add(this._overlay);

        this.mapView = new MapView.MapView();
        overlay.add(this.mapView);

        this.mapView.gotoUserLocation(false);

        this._contextMenu = new ContextMenu.ContextMenu(this.mapView);

        ui.layersButton.popover = new LayersPopover.LayersPopover();

        this._initSearchWidgets();
        this._initActions();
        this._initSignals();
        this._restoreWindowGeometry();

        this._overlay.add_overlay(new ZoomControl.ZoomControl(this.mapView));
        this._overlay.show_all();
    },

    _initSearchWidgets: function() {
        this._searchPopup = new SearchPopup.SearchPopup(this._searchEntry, 10);

        this._searchPopup.connect('selected',
                                  this._onSearchPopupSelected.bind(this));
        this._searchPopup.connect('selected',
                                  this._overlay.grab_focus.bind(this._overlay));
        this.mapView.view.connect('button-press-event',
                                  this._searchPopup.hide.bind(this._searchPopup));
        this.mapView.view.connect('button-press-event',
                                  this._overlay.grab_focus.bind(this._overlay));
        this._searchEntry.connect('changed',
                                  this._searchPopup.hide.bind(this._searchPopup));

        this._searchCompletion.set_model(this._placeStore);
        this._searchCompletion.connect('match-selected', (function(c, m, iter) {
            let place = m.get_value(iter, PlaceStore.Columns.PLACE);
            this.mapView.showNGotoLocation(place);
            this._placeStore.addRecent(place);
        }).bind(this));

        this._searchCompletion.set_match_func(PlaceStore.completionMatchFunc);
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
            }
        ], this);

        let action = this.window.lookup_action('goto-user-location');
        this.mapView.geoclue.bind_property('connected',
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

        this._searchEntry.connect('activate',
                                  this._onSearchActivate.bind(this));
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

    _onSearchPopupSelected: function(widget, place) {
        this.mapView.showNGotoLocation(place);

        this._placeStore.addRecent(place);
        this._searchPopup.hide();
    },

    _onSearchActivate: function() {
        let searchString = this._searchEntry.get_text();

        if (searchString.length > 0) {
            this._searchPopup.showSpinner();
            this.mapView.geocodeSearch(searchString,
                                       this._showSearchResults.bind(this));
        }
    },

    _showSearchResults: function(places) {
        if (places === null) {
            this._searchPopup.hide();
            return;
        }
        this._searchPopup.updateResult(places, this._searchEntry.get_text());
        this._searchPopup.showResult();
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
        if (this.mapView.geoclue.userSetLocation) {
            Utils.once(this.mapView.geoclue,
                       'location-changed',
                       (function() {
                this.mapView.gotoUserLocation(true);
            }).bind(this));
            this.mapView.geoclue.findLocation();
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
