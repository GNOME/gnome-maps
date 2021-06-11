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
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;

const AccountListBox = imports.accountListBox;
const Application = imports.application;
const CheckIn = imports.checkIn;
const SocialPlaceListBox = imports.socialPlaceListBox;
const SocialPlaceMatcher = imports.socialPlaceMatcher;

var Response = {
    SUCCESS: 0,
    CANCELLED: 1,
    FAILURE_NO_PLACES: 2,
    FAILURE_GET_PLACES: 3,
    FAILURE_ACCOUNT_DISABLED: 4,
    FAILURE_CHECKIN_DISABLED: 5
};

var CheckInDialog = GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/check-in-dialog.ui',
    InternalChildren: [ 'cancelButton',
                        'okButton',
                        'stack',
                        'accountFrame',
                        'placeScrolledWindow',
                        'placeNotFoundInfoBar',
                        'placeNotFoundLabel',
                        'messageInfoLabel',
                        'messageInfoAccountImage',
                        'messageTextView',
                        'foursquareOptionsGrid',
                        'foursquareOptionsPrivacyComboBox',
                        'foursquareOptionsBroadcastFacebookCheckButton',
                        'foursquareOptionsBroadcastTwitterCheckButton' ],
}, class CheckInDialog extends Gtk.Dialog {
    _init(params) {
        this._place = params.place;
        delete params.place;

        this._matchPlace = params.matchPlace;
        delete params.matchPlace;

        // This is a construct-only property and cannot be set by GtkBuilder
        params.use_header_bar = true;

        super._init(params);

        this._account = null;
        this._checkIn = new CheckIn.CheckIn();
        this.error = null;

        this._cancellable = new Gio.Cancellable();
        this._cancellable.connect(() => this.response(Response.CANCELLED));

        this.connect('delete-event', () => this._cancellable.cancel());

        Application.checkInManager.connect('accounts-refreshed',
                                           () => this._onAccountRefreshed());

        this._initHeaderBar();
        this._initWidgets();
    }

    _initHeaderBar() {
        this._cancelButton.connect('clicked',
                                   () => this._cancellable.cancel());

        this._okButton.connect('clicked', () => this._startCheckInStep());
    }

    _initWidgets() {
        // Limitations in Gjs means we can't do this in UI files yet
        this._accountListBox = new AccountListBox.AccountListBox({ visible: true });
        this._accountFrame.add(this._accountListBox);

        this._placeListBox = new SocialPlaceListBox.SocialPlaceListBox({ visible: true });
        this._placeScrolledWindow.add(this._placeListBox);

        Application.settings.bind('checkin-foursquare-privacy',
                                  this._foursquareOptionsPrivacyComboBox,
                                  'active_id', Gio.SettingsBindFlags.DEFAULT);

        Application.settings.bind('checkin-foursquare-broadcast-facebook',
                                  this._foursquareOptionsBroadcastFacebookCheckButton,
                                  'active', Gio.SettingsBindFlags.DEFAULT);

        Application.settings.bind('checkin-foursquare-broadcast-twitter',
                                  this._foursquareOptionsBroadcastTwitterCheckButton,
                                  'active', Gio.SettingsBindFlags.DEFAULT);

        this._accountListBox.connect('account-selected', (list, account) => {
            this._account = account;
            this._startPlaceStep();
        });

        this._placeListBox.connect('place-selected', (list, place) => {
            this._checkIn.place = place;
            this._startMessageStep();
        });
    }

    vfunc_show() {
        this._startup();
        super.vfunc_show();
    }

    _startup() {
        let accounts = Application.checkInManager.accounts;

        if (accounts.length > 1)
            this._startAccountStep();
        else if (accounts.length === 1) {
            this._account = Application.checkInManager.accounts[0];
            this._startPlaceStep();
        } else {
            Mainloop.idle_add(() => {
                this.response(Response.FAILURE_CHECKIN_DISABLED);
            });
        }
    }

    _onAccountRefreshed() {
        let accounts = Application.checkInManager.accounts;

        if (!Application.checkInManager.hasCheckIn)
            this.response(Response.FAILURE_CHECKIN_DISABLED);
        else if (this._account) {
            for (let account of accounts) {
                if (this._account.get_account().id === account.get_account().id)
                    return;
            }

            this.response(Response.FAILURE_ACCOUNT_DISABLED);
        }
    }

    _startAccountStep() {
        this.set_title(_("Select an account"));
        this._stack.set_visible_child_name('account');
    }

    _startPlaceStep() {
        this.set_title(_("Loading"));
        this._stack.set_visible_child_name('loading');

        Application.checkInManager.findPlaces(this._account,
                                              this._place.location.latitude,
                                              this._place.location.longitude,
                                              100,
                                              this._onFindPlacesFinished.bind(this),
                                              this._cancellable);
    }

    _onFindPlacesFinished(account, places, error) {
        if (!error) {
            if (places.length === 0) {
                this.response(Response.FAILURE_NO_PLACES);
                return;
            }

            let matches = SocialPlaceMatcher.match(this._place, places);

            if (matches.exactMatches.length === 1 && this._matchPlace) {
                this._checkIn.place = matches.exactMatches[0];
                this._startMessageStep();
            } else {
                this.set_title(_("Select a place"));
                this._placeListBox.matches = matches;

                if (this._matchPlace) {
                    if (this._account.get_account().provider_type === 'foursquare')
                        this._placeNotFoundLabel.label = _("Maps cannot find the place to check in to with Foursquare. Please select one from this list.");
                } else
                    this._placeNotFoundInfoBar.hide();

                this._stack.set_visible_child_name('place');
            }
        } else {
            this.error = error;
            this.response(Response.FAILURE_GET_PLACES);
        }
    }

    _startMessageStep() {
        /* Translators: %s is the name of the place to check in.
         */
        this.set_title(_("Check in to %s").format(this._checkIn.place.name));
        this._stack.set_visible_child_name('message');

        this._messageTextView.grab_focus();
        this._okButton.show();

        let account = this._account.get_account();

        /* Translators: %s is the name of the place to check in.
         */
        let labelMessageInfo = _("Write an optional message to check in to %s.");
        this._messageInfoLabel.label = labelMessageInfo.format('<a href="%s">%s</a>'.format(this._checkIn.place.link,
                                                                                            this._checkIn.place.name));
        this._messageInfoAccountImage.gicon = Gio.Icon.new_for_string(account.provider_icon);

        let optionsGrids = { 'foursquare': this._foursquareOptionsGrid };

        for (let provider in optionsGrids)
            if (provider === account.provider_type)
                optionsGrids[provider].show();
            else
                optionsGrids[provider].hide();
    }

    _startCheckInStep() {
        this.set_title(_("Loading"));
        this._stack.set_visible_child_name('loading');

        this._okButton.hide();

        let message = this._messageTextView.buffer.text;
        let privacy;

        if (this._account.get_account().provider_type === 'foursquare')
            privacy = this._foursquareOptionsPrivacyComboBox.active_id;

        let broadcastFacebook = this._foursquareOptionsBroadcastFacebookCheckButton.active;
        let broadcastTwitter = this._foursquareOptionsBroadcastTwitterCheckButton.active;

        this._checkIn.message = message;
        this._checkIn.privacy = privacy;
        this._checkIn.broadcastFacebook = broadcastFacebook;
        this._checkIn.broadcastTwitter = broadcastTwitter;

        Application.checkInManager.performCheckIn(this._account,
                                                  this._checkIn,
                                                  this._onPerformCheckInFinished.bind(this),
                                                  this._cancellable);
    }

    _onPerformCheckInFinished(account, data, error) {
        if (!error)
            this.response(Response.SUCCESS);
        else {
            let messageDialog = new Gtk.MessageDialog({ transient_for: this,
                                                        destroy_with_parent: true,
                                                        message_type: Gtk.MessageType.ERROR,
                                                        buttons: Gtk.ButtonsType.OK,
                                                        modal: true,
                                                        text: _("An error has occurred"),
                                                        secondary_text: error.message });
            messageDialog.run();
            messageDialog.destroy();

            this._startMessageStep();
        }
    }
});
