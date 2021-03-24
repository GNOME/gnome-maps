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
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const Application = imports.application;

var AccountRow = GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/account-row.ui',
    InternalChildren: [ 'providerLabel',
                        'identityLabel',
                        'providerImage',
                        'attentionNeededImage' ],
}, class AccountRow extends Gtk.ListBoxRow {
    _init(params) {
        this.account = params.account;
        delete params.account;

        super._init(params);

        let account = this.account.get_account();

        this._providerLabel.label = account.provider_name;
        this._identityLabel.label = account.presentation_identity;
        this._providerImage.gicon = Gio.Icon.new_for_string(account.provider_icon);
        this._attentionNeededImage.visible = account.attention_needed;
    }
});

var AccountListBox = GObject.registerClass({
    Signals: {
        'account-selected': { param_types: [Goa.Object] }
    },
}, class AccountListBox extends Gtk.ListBox {
    _init(params) {
        params.activate_on_single_click = true;
        super._init(params);

        Application.checkInManager.connect('accounts-refreshed', () => this.refresh());

        this.connect('row-activated',
                     (list, row) => this.emit('account-selected', row.account));

        this.refresh();
    }

    refresh() {
        let accounts = Application.checkInManager.accounts;

        this.foreach((row) => this.remove(row));

        accounts.forEach((account) => {
            this.insert(new AccountRow({ account: account }), -1);
        });
    }
});
