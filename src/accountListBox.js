/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2014 Damián Nohales
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
 * Author: Damián Nohales <damiannohales@gmail.com>
 */

const Gio = imports.gi.Gio;
const Goa = imports.gi.Goa;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Application = imports.application;

var AccountRow = new Lang.Class({
    Name: 'AccountRow',
    Extends: Gtk.ListBoxRow,
    Template: 'resource:///org/gnome/Maps/ui/account-row.ui',
    InternalChildren: [ 'providerLabel',
                        'identityLabel',
                        'providerImage',
                        'attentionNeededImage' ],

    _init: function(params) {
        this.account = params.account;
        delete params.account;

        this.parent(params);

        let account = this.account.get_account();

        this._providerLabel.label = account.provider_name;
        this._identityLabel.label = account.presentation_identity;
        this._providerImage.gicon = Gio.Icon.new_for_string(account.provider_icon);
        this._attentionNeededImage.visible = account.attention_needed;
    }
});

var AccountListBox = new Lang.Class({
    Name: 'AccountListBox',
    Extends: Gtk.ListBox,
    Signals: {
        'account-selected': { param_types: [Goa.Object] }
    },

    _init: function(params) {
        params.activate_on_single_click = true;
        this.parent(params);

        Application.checkInManager.connect('accounts-refreshed', () => this.refresh());

        this.connect('row-activated',
                     (list, row) => this.emit('account-selected', row.account));

        this.refresh();
    },

    refresh: function() {
        let accounts = Application.checkInManager.accounts;

        this.forall(function(row) {
            row.destroy();
        });

        accounts.forEach((account) => this.add(new AccountRow({ account: account })));
    }
});
