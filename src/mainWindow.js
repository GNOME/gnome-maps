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
const GdkPixbuf = imports.gi.GdkPixbuf;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Champlain = imports.gi.Champlain;

const Lang = imports.lang;
const Mainloop = imports.mainloop;

const Application = imports.application;
const MapView = imports.mapView;
const SearchPopup = imports.searchPopup;
const ContextMenu = imports.contextMenu;
const PlaceStore = imports.placeStore;
const Utils = imports.utils;
const Config = imports.config;

const _ = imports.gettext.gettext;

const _CONFIGURE_ID_TIMEOUT = 100; // msecs
const _WINDOW_MIN_WIDTH = 600;
const _WINDOW_MIN_HEIGHT = 500;

const _PLACE_ICON_SIZE = 20;

const SearchResults = {
    COL_ICON:         0,
    COL_DESCRIPTION:  1,
    COL_PLACE:        2
};

const MainWindow = new Lang.Class({
    Name: 'MainWindow',

    _init: function(app) {
        this._configureId = 0;
        let ui = Utils.getUIObject('main-window', [ 'app-window',
                                                    'window-content',
                                                    'search-entry' ]);
        let grid = ui.windowContent;
        this._searchEntry = ui.searchEntry;
        this.window = ui.appWindow;
        this.window.application = app;

        this._mapOverlay = new Gtk.Overlay({ visible: true });
        this.mapView = new MapView.MapView(this._mapOverlay);
        this._mapOverlay.add(this.mapView);

        this.mapView.gotoUserLocation(false);

        this._contextMenu = new ContextMenu.ContextMenu(this.mapView);

        this._initPlaces();
        this._initSearchWidgets();
        this._initActions();
        this._initSignals();
        this._restoreWindowGeometry();

        this._mapOverlay.add_overlay(this._searchPopup);

        grid.add(this._mapOverlay);

        grid.show_all();
    },

    _initPlaces: function() {
        this._placeStore = new PlaceStore.PlaceStore();
        try {
            this._placeStore.load();
        } catch (e) {
            log('Failed to parse Maps places file, ' +
                'subsequent writes will overwrite the file!');
        }
    },

    _initSearchWidgets: function() {
        this._searchPopup = new SearchPopup.SearchPopup(10);

        let model = new Gtk.ListStore();
        model.set_column_types([GdkPixbuf.Pixbuf,
                                GObject.TYPE_STRING,
                                GObject.TYPE_OBJECT]);
        this._searchPopup.setModel(model);
        this._searchPopup.connect('selected',
                                  this._onSearchPopupSelected.bind(this));
        this.mapView.view.connect('button-press-event',
                                  this._searchPopup.hide.bind(this._searchPopup));
        this._searchEntry.connect('changed',
                                  this._searchPopup.hide.bind(this._searchPopup));

        // FIXME: do as much of the following from UI file as possible
        let completion = new Gtk.EntryCompletion({ model: this._placeStore,
                                                   popup_completion: true,
                                                   inline_completion: false,
                                                   minimum_key_length: 2 });

        let renderer = new Gtk.CellRendererPixbuf({ xpad: 2 });
        completion.pack_start(renderer, false);
        completion.add_attribute(renderer, "pixbuf", PlaceStore.Columns.PLACE_ICON);
        completion.reorder(renderer, 0);
        completion.set_text_column(PlaceStore.Columns.NAME);
        let textCell = completion.get_cells()[0];
        textCell.xpad = textCell.ypad = 4;

        completion.connect('match-selected', (function(completion, model, iter) {
            let place = model.get_value(iter, PlaceStore.Columns.PLACE);

            this.mapView.showNGotoLocation(place.location);
        }).bind(this));

        this._searchEntry.set_completion(completion);
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

    _onSearchPopupSelected: function(widget, iter) {
        let model = this._searchPopup.getModel();
        let place = model.get_value(iter, SearchResults.COL_PLACE);

        this.mapView.showNGotoLocation(place.location);

        this._placeStore.addRecent(place);
        this._searchPopup.hide();
    },

    _onSearchActivate: function() {
        let searchString = this._searchEntry.get_text();

        if (searchString.length > 0) {
            let model = this._searchPopup.getModel();

            model.clear();
            this._searchPopup.showSpinner();
            this.mapView.geocodeSearch(searchString,
                                       this._showSearchResults.bind(this));
        }
    },

    // We want to match case insensitive but present in the correct case.
    _boldMatch: function(description, searchStringLower) {
        let index = description.toLowerCase().indexOf(searchStringLower);

        if (index !== -1) {
            let substring = description.substring(index,
                                                  index + searchStringLower.length);

            description = description.replace(substring, substring.bold());
        }

        return description;
    },

    _showSearchResults: function(places) {
        let model = this._searchPopup.getModel();

        if (places === null) {
            this._searchPopup.hide();
            return;
        }

        // Lower case to match case insensitive
        let searchStringLower = this._searchEntry.text.toLowerCase();

        places.forEach((function(place) {
            let iter = model.append();
            let location = place.get_location();
            let icon = place.icon;

            if (location == null)
                return;

            let description = GLib.markup_escape_text(location.description, -1);
            description = this._boldMatch(description, searchStringLower);

            model.set(iter,
                      [SearchResults.COL_DESCRIPTION,
                       SearchResults.COL_PLACE],
                      [description,
                       place]);

            if (icon !== null) {
                Utils.load_icon(icon, _PLACE_ICON_SIZE, function(pixbuf) {
                    model.set(iter, [SearchResults.COL_ICON], [pixbuf]);
                });
            }
        }).bind(this));
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
                       'Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>' ],
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
