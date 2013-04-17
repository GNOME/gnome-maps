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
const Gd = imports.gi.Gd;
const Champlain = imports.gi.Champlain;
const Geocode = imports.gi.GeocodeGlib;

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

const MainWindow = new Lang.Class({
    Name: 'MainWindow',

    _init: function(app) {
        this._configureId = 0;

        this.window = new Gtk.ApplicationWindow({ application: app,
                                                  width_request: _WINDOW_MIN_WIDTH,
                                                  height_request: _WINDOW_MIN_HEIGHT,
                                                  window_position: Gtk.WindowPosition.CENTER,
                                                  hide_titlebar_when_maximized: true,
                                                  title: _("Maps") });

        Utils.initActions(this.window, [
            { name: 'about', callback: this._onActionAbout }
        ]);

        // apply the last saved window size and position
        let size = Application.settings.get_value('window-size');
        if (size.n_children() == 2) {
            let width = size.get_child_value(0);
            let height = size.get_child_value(1);

            this.window.set_default_size(width.get_int32(),
                                         height.get_int32());
        }

        let position = Application.settings.get_value('window-position');
        if (position.n_children() == 2) {
            let x = position.get_child_value(0);
            let y = position.get_child_value(1);

            this.window.move(x.get_int32(),
                             y.get_int32());
        }

        if (Application.settings.get_boolean('window-maximized'))
            this.window.maximize();

        this.window.connect('delete-event',
                            Lang.bind(this, this._quit));
        this.window.connect('configure-event',
                            Lang.bind(this, this._onConfigureEvent));
        this.window.connect('window-state-event',
                            Lang.bind(this, this._onWindowStateEvent));

        let grid = new Gtk.Grid ();
        grid.set_orientation (Gtk.Orientation.VERTICAL);
        this.window.add(grid);

        this._searchEntry = new Gd.TaggedEntry({ width_request: 500 });
        this._searchEntry.connect('activate', Lang.bind(this, this._onSearchActivate));

        let headerBar = new Gd.HeaderBar();
        headerBar.set_custom_title(this._searchEntry);

        this.mapView = new MapView.MapView();

        let trackUserLocation = Application.settings.get_boolean('track-user-location');
        if (trackUserLocation)
            this.mapView.gotoUserLocation(false);

        let toggle = new Gd.HeaderToggleButton({ symbolic_icon_name: 'find-location-symbolic',
                                                 active: trackUserLocation });

        let onViewMoved = Lang.bind(this,
            function () {
                if (!this.mapView.userLocationVisible())
                    toggle.active = false;
            });
        if (trackUserLocation)
            this._onViewMovedId = this.mapView.connect('view-moved', onViewMoved);

        toggle.connect('toggled', Lang.bind(this,
            function() {
                if (this._onViewMovedId > 0) {
                    this.mapView.disconnect(this._onViewMovedId);
                    this._onViewMovedId = 0;
                }

                if (toggle.active) {
                    let goneToUserLocationId = this.mapView.connect('gone-to-user-location', Lang.bind(this,
                        function () {
                            this.mapView.disconnect(goneToUserLocationId);
                            this._onViewMovedId = this.mapView.connect('view-moved', onViewMoved);
                        }));
                    this.mapView.gotoUserLocation(true);
                }

                Application.settings.set_boolean('track-user-location', toggle.active);
            }));
        headerBar.pack_start(toggle);

        grid.add(headerBar);

        grid.add(this.mapView);

        grid.show_all();
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

    _onConfigureEvent: function(widget, event) {
        if (this._configureId != 0) {
            Mainloop.source_remove(this._configureId);
            this._configureId = 0;
        }

        this._configureId = Mainloop.timeout_add(_CONFIGURE_ID_TIMEOUT, Lang.bind(this,
            function() {
                this._saveWindowGeometry();
                return false;
            }));
    },

    _onWindowStateEvent: function(widget, event) {
        let window = widget.get_window();
        let state = window.get_state();

        if (state & Gdk.WindowState.FULLSCREEN)
            return;

        let maximized = (state & Gdk.WindowState.MAXIMIZED);
        Application.settings.set_boolean('window-maximized', maximized);
    },

    _onSearchActivate: function() {
        let string = this._searchEntry.get_text();

        this.mapView.geocodeSearch(string);
    },

    _quit: function() {
        // remove configure event handler if still there
        if (this._configureId != 0) {
            Mainloop.source_remove(this._configureId);
            this._configureId = 0;
        }

        // always save geometry before quitting
        this._saveWindowGeometry();

        return false;
    },

    _onActionAbout: function() {
        let aboutDialog = new Gtk.AboutDialog();

        aboutDialog.artists = [ 'Jakub Steiner <jimmac@gmail.com>', 'Andreas Nilsson <nisses.mail@home.se>' ];
        aboutDialog.authors = [ 'Zeeshan Ali (Khattak) <zeeshanak@gnome.org>',
                                'Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>' ];
        aboutDialog.translator_credits = _("translator-credits");
        aboutDialog.program_name = _("Maps");
        aboutDialog.comments = _("A map application for GNOME");
        aboutDialog.copyright = 'Copyright ' + String.fromCharCode(0x00A9) + ' 2011' + String.fromCharCode(0x2013) + '2013 Red Hat, Inc.';
        aboutDialog.license_type = Gtk.License.GPL_2_0;
        aboutDialog.logo_icon_name = 'gnome-maps';
        aboutDialog.version = Config.PACKAGE_VERSION;
        aboutDialog.website = 'http://live.gnome.org/Maps';
        aboutDialog.wrap_license = true;

        aboutDialog.modal = true;
        aboutDialog.transient_for = this;

        aboutDialog.show();
        aboutDialog.connect('response', function() {
            aboutDialog.destroy();
        });
    }
});
