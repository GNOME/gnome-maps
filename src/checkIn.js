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

const GObject = imports.gi.GObject;
const Goa = imports.gi.Goa;
const Gtk = imports.gi.Gtk;

const CheckInDialog = imports.checkInDialog;
const FoursquareBackend = imports.foursquareBackend;

var CheckInManager = GObject.registerClass({
    Signals: {
        'accounts-refreshed': { }
    },
    Properties: {
        'hasCheckIn': GObject.ParamSpec.boolean('hasCheckIn',
                                                '',
                                                '',
                                                GObject.ParamFlags.READABLE)
    }
}, class CheckInManager extends GObject.Object {
    _init() {
        super._init();

        try {
            this._goaClient = Goa.Client.new_sync(null);
        } catch (e) {
            log('Error creating GOA client: %s'.format(e.message));
        }

        this._accounts = [];
        this._authorizers = {};
        this._backends = {};

        this._initBackends();

        if (this._goaClient) {
            this._goaClient.connect('account-added',
                                    this._refreshGoaAccounts.bind(this));
            this._goaClient.connect('account-changed',
                                    this._refreshGoaAccounts.bind(this));
            this._goaClient.connect('account-removed',
                                    this._refreshGoaAccounts.bind(this));
        }

        this._refreshGoaAccounts();
    }

    _initBackends() {
        let foursquareBackend = new FoursquareBackend.FoursquareBackend();
        this._backends[foursquareBackend.name] = foursquareBackend;
    }

    _refreshGoaAccounts() {
        if (!this._goaClient)
            return;
        let accounts = this._goaClient.get_accounts();
        this._accounts = [];
        this._accountsCount = 0;
        this._authorizers = {};

        accounts.forEach((object) => {
            if (!object.get_account())
                return;

            if (!object.get_maps())
                return;

            let accountId = object.get_account().id;
            this._accounts.push(object);

            this._authorizers[accountId] = this._getBackend(object).createAuthorizer(object);
        });

        this.emit('accounts-refreshed');
        this.notify('hasCheckIn');
    }

    get client() {
        return this._goaClient;
    }

    get accounts() {
        return this._accounts;
    }

    get hasCheckIn() {
        return this._accounts.length > 0;
    }

    _getAuthorizer(account) {
        return this._authorizers[account.get_account().id];
    }

    _getBackend(account) {
        return this._backends[account.get_account().provider_type];
    }

    performCheckIn(account, checkIn, callback, cancellable) {
        this._getBackend(account)
            .performCheckIn(this._getAuthorizer(account), checkIn, callback, cancellable);
    }

    findPlaces(account, latitude, longitude, distance, callback, cancellable) {
        this._getBackend(account)
            .findPlaces(this._getAuthorizer(account), latitude, longitude, distance, callback, cancellable);
    }

    showCheckInDialog(parentWindow, place, matchPlace) {
        let dialog = new CheckInDialog.CheckInDialog({ transient_for: parentWindow,
                                                       matchPlace: matchPlace,
                                                       place: place });
        let response = dialog.run();
        dialog.destroy();

        let message = null;

        switch (response) {
        case CheckInDialog.Response.FAILURE_NO_PLACES:
            if (matchPlace)
                /* Translators: %s is the place name that user wanted to check-in */
                message = _("Cannot find “%s” in the social service").format(place.name);
            else
                message = _("Cannot find a suitable place to check-in in this location");
            break;
        case CheckInDialog.Response.FAILURE_GET_PLACES:
            if (dialog.error.code === 401)
                message = _("Credentials have expired, please open Online Accounts to sign in and enable this account");
            else
                message = dialog.error.message;
            break;
        }

        if (message) {
            let messageDialog = new Gtk.MessageDialog({ transient_for: parentWindow,
                                                        destroy_with_parent: true,
                                                        message_type: Gtk.MessageType.ERROR,
                                                        buttons: Gtk.ButtonsType.OK,
                                                        modal: true,
                                                        text: _("An error has occurred"),
                                                        secondary_text: message });
            messageDialog.run();
            messageDialog.destroy();
        }
    }
});

var CheckIn = class {
    _init() {
        this.message = null;
        this.place = null;
        this.privacy = null;
        this.broadcastFacebook = false;
        this.broadcastTwitter = false;
    }
};
