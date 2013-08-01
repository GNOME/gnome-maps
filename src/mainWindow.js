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
const GObject = imports.gi.GObject;
const Champlain = imports.gi.Champlain;

const Lang = imports.lang;
const Mainloop = imports.mainloop;

const Application = imports.application;
const MapView = imports.mapView;
const Utils = imports.utils;
const Config = imports.config;

const _ = imports.gettext.gettext;

const _CONFIGURE_ID_TIMEOUT = 100; // msecs
const _WINDOW_MIN_WIDTH = 600;
const _WINDOW_MIN_HEIGHT = 500;

const SearchResults = {
    COL_DESCRIPTION:  0,
    COL_LOCATION:     1
};

const MainWindow = new Lang.Class({
    Name: 'MainWindow',

    _init: function(app) {
        this._configureId = 0;
        let ui = Utils.getUIObject('main-window', [ 'app-window',
                                                    'window-content',
                                                    'search-box',
                                                    'track-user-button']);
        let grid = ui.windowContent,
            toggle = ui.trackUserButton;
        this._searchBox = ui.searchBox;
        this.window = ui.appWindow;
        this.window.application = app;

        this.mapView = new MapView.MapView();

        this.mapView.gotoUserLocation(false);

        this._initSearchWidgets();
        this._initActions();
        this._initSignals();
        this._restoreWindowGeometry();

        grid.add(this.mapView);

        grid.show_all();
    },

    _initSearchWidgets: function() {
        this._searchEntry = new Gtk.SearchEntry();
        this._searchBox.add(this._searchEntry);

        let model = new Gtk.ListStore();
        model.set_column_types([GObject.TYPE_STRING,
                                GObject.TYPE_OBJECT]);
        this._searchBox.model = model;
        this._searchBox.entry_text_column = SearchResults.COL_DESCRIPTION;
        this._searchBox.connect('changed',
                                this._onSearchBoxChanged.bind(this));
        this._searchBox.show_all();
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
        let variant = GLib.Variant.new ('ai', size);
        Application.settings.set_value('window-size', variant);

        let position = this.window.get_position();
        variant = GLib.Variant.new ('ai', position);
        Application.settings.set_value('window-position', variant);
    },

    _restoreWindowGeometry: function() {
        let size = Application.settings.get_value('window-size');
        if (size.n_children() === 2) {
            let width = size.get_child_value(0);
            let height = size.get_child_value(1);

            this.window.set_default_size(width.get_int32(),
                                         height.get_int32());
        }

        let position = Application.settings.get_value('window-position');
        if (position.n_children() === 2) {
            let x = position.get_child_value(0);
            let y = position.get_child_value(1);

            this.window.move(x.get_int32(),
                             y.get_int32());
        }

        if (Application.settings.get_boolean('window-maximized'))
            this.window.maximize();
    },

    _onConfigureEvent: function(widget, event) {
        if (this._configureId !== 0) {
            Mainloop.source_remove(this._configureId);
            this._configureId = 0;
        }

        this._configureId = Mainloop.timeout_add(_CONFIGURE_ID_TIMEOUT, (function() {
            this._saveWindowGeometry();
            return false;
        }).bind(this));
    },

    _onWindowStateEvent: function(widget, event) {
        let window = widget.get_window();
        let state = window.get_state();

        if (state & Gdk.WindowState.FULLSCREEN)
            return;

        let maximized = (state & Gdk.WindowState.MAXIMIZED);
        Application.settings.set_boolean('window-maximized', maximized);
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

    _onSearchBoxChanged: function() {
        let ret = this._searchBox.get_active_iter();
        let is_set = ret[0];
        let iter = ret[1];

        if (is_set) {
            let location =
                this._searchBox.model.get_value(iter,
                                                SearchResults.COL_LOCATION);
            this.mapView.showLocation(location);
        }
    },

    _onSearchActivate: function() {
        let searchString = this._searchEntry.get_text();

        if (searchString.length > 0) {
            this.mapView.geocodeSearch(searchString,
                                       this._showSearchResults.bind(this));
        }
    },

    _showSearchResults: function(places) {
        this._searchBox.model.clear();

        places.forEach((function(place) {
            let iter = this._searchBox.model.append();
            let location = place.get_location();

            if (location == null)
                return;

            this._searchBox.model.set(iter,
                                      [SearchResults.COL_DESCRIPTION,
                                       SearchResults.COL_LOCATION],
                                      [location.description,
                                       location]);
        }).bind(this));

        this._searchBox.popup();
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
                       'Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>' ],
            translator_credits: _("translator-credits"),
            program_name: _("Maps"),
            comments: _("A map application for GNOME"),
            copyright: 'Copyright ' + String.fromCharCode(0x00A9) +
                ' 2011' + String.fromCharCode(0x2013) +
                '2013 Red Hat, Inc.',
            license_type: Gtk.License.GPL_2_0,
            logo_icon_name: 'gnome-maps',
            version: Config.PACKAGE_VERSION,
            website: 'http://live.gnome.org/Maps',
            wrap_license: true,

            modal: true,
            transient_for: this.window
        });
        aboutDialog.show();
        aboutDialog.connect('response',
                            aboutDialog.destroy.bind(aboutDialog));
    }
});
