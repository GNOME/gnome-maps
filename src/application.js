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

const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Signals = imports.signals;
const Gettext = imports.gettext;
const _ = imports.gettext.gettext;

const GtkClutter = imports.gi.GtkClutter;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;

const Main = imports.main;
const Format = imports.format;
const MainWindow = imports.mainWindow;
const Utils = imports.utils;
const Path = imports.path;
//const MainToolbar = imports.mainToolbar;

// used globally
let application = null;
let settings = null;

const Application = new Lang.Class({
    Name: 'Application',
    Extends: Gtk.Application,

    _init: function() {
        Gettext.bindtextdomain('gnome-maps', Path.LOCALE_DIR);
        Gettext.textdomain('gnome-maps');
        GLib.set_prgname('gnome-maps');
        GLib.set_application_name(_("Maps"));

        this.parent({ application_id: 'org.gnome.Maps',
                      inactivity_timeout: 12000 });
    },

    _onActionQuit: function() {
        this._mainWindow.window.destroy();
    },

    _onActionAbout: function() {
        this._mainWindow.showAbout();
    },

    _initActions: function() {
        this._actionEntries.forEach(Lang.bind(this,
            function(actionEntry) {
                let state = actionEntry.state;
                let parameterType = actionEntry.parameter_type ?
                    GLib.VariantType.new(actionEntry.parameter_type) : null;
                let action;

                if (state)
                    action = Gio.SimpleAction.new_stateful(actionEntry.name,
                        parameterType, actionEntry.state);
                else
                    action = new Gio.SimpleAction({ name: actionEntry.name });

                if (actionEntry.create_hook)
                    actionEntry.create_hook.apply(this, [action]);

                if (actionEntry.callback)
                    action.connect('activate', Lang.bind(this, actionEntry.callback));

                if (actionEntry.accel)
                    this.add_accelerator(actionEntry.accel, 'app.' + actionEntry.name, null);

                this.add_action(action);
            }));
    },

    _initAppMenu: function() {
        let builder = new Gtk.Builder();
        builder.add_from_resource('/org/gnome/maps/app-menu.ui');

        let menu = builder.get_object('app-menu');
        this.set_app_menu(menu);
    },

    vfunc_startup: function() {
        this.parent();
        String.prototype.format = Format.format;

        GtkClutter.init(null);

        let resource = Gio.Resource.load(Path.RESOURCE_DIR + '/gnome-maps.gresource');
        resource._register();

        application = this;
        settings = new Gio.Settings({ schema: 'org.gnome.maps' });

        this._actionEntries = [
            { name: 'about',
              callback: this._onActionAbout },
            { name: 'quit',
              callback: this._onActionQuit }
        ];

        this._initActions();
        this._initAppMenu();
    },

    _createWindow: function() {
        if (this._mainWindow)
            return;

        this._mainWindow = new MainWindow.MainWindow(this);
        this._mainWindow.window.connect('destroy', Lang.bind(this, this._onWindowDestroy));
    },

    vfunc_activate: function() {
        this._createWindow();
        this._mainWindow.window.present();
    },

    _onWindowDestroy: function(window) {
        this._mainWindow = null;

        // clean up signals

        // reset state
    },
});
Utils.addJSSignalMethods(Application.prototype);
