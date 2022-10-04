/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2015 Marcus Lundblad
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
 * Author: Marcus Lundblad <ml@update.uu.se>
 */

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {Application} from './application.js';
import * as Utils from './utils.js';

export class OSMAccountDialog extends Gtk.Dialog {

    static Response = { SIGNED_IN: 0 };

    constructor({closeOnSignIn, ...params}) {
        /* use_header_bar is a construct-only property and cannot be set by GtkBuilder */
        super({...params, use_header_bar: true});

        this._closeOnSignIn = closeOnSignIn;
        this._signInButton.connect('clicked',
                                   this._onSignInButtonClicked.bind(this));
        this._verifyButton.connect('clicked',
                                   this._onVerifyButtonClicked.bind(this));
        this._verificationEntry.connect('changed',
                                        this._onVerificationEntryChanged.bind(this));
        this._verificationEntry.connect('activate',
                                        this._onVerificationEntryActivated.bind(this));
        this._signOutButton.connect('clicked',
                                    this._onSignOutButtonClicked.bind(this));

        /* if the user is logged in, show the logged-in view */
        if (Application.osmEdit.isSignedIn) {
            this._updateSignedInUserLabel();
            this._stack.visible_child_name = 'logged-in';
        }
    }

    _updateSignedInUserLabel() {
        /* if we couldn't determine the logged in username (e.g. the user
         * didn't grant permission to read user details, hide the username
         * label
         */
        if (Application.osmEdit.username === '_unknown_') {
            this._signedInUserLabel.visible = false;
        } else {
            this._signedInUserLabel.label = Application.osmEdit.username;
            this._signedInUserLabel.visible = true;
        }
    }

    _onSignInButtonClicked() {
        this._performSignIn();
    }

    _performSignIn() {
        // switch to the verification view
        this._stack.visible_child_name = 'verify';

        Application.osmEdit.performOAuthSignIn();
    }

    _onVerifyButtonClicked() {
        this._performVerification();
    }

    _performVerification() {
        /* allow copying the leading space between the "The verification is"
           label and the code */
        let verificationCode = this._verificationEntry.text.trim();

        /* Since the text shown on OSM's OAuth authorization verification form
           is a bit unclear with a trailing period after the verification code,
           let's strip that off if the user copied that over. */
        if (verificationCode.charAt(verificationCode.length - 1) === '.') {
            verificationCode = verificationCode.slice(0, -1);
        }

        Application.osmEdit.requestOAuthAccessToken(verificationCode,
                                                    this._onOAuthAccessTokenRequested.bind(this));
    }

    _onVerificationEntryChanged() {
        this._verifyButton.sensitive =
            this._verificationEntry.text &&
            this._verificationEntry.text.length > 0;
    }

    _onVerificationEntryActivated() {
        /* proceed with verification if a code has been entered */
        let verificationCode = this._verificationEntry.text;

        if (verificationCode && verificationCode.length > 0)
            this._performVerification();
    }

    _onOAuthAccessTokenRequested(success, errorMessage) {
        if (success) {
            /* update the username label */
            this._updateSignedInUserLabel();

            if (this._closeOnSignIn) {
                this.response(Response.SIGNED_IN);
            } else {
                /* switch to the logged in view and reset the state in case
                   the user signs out and start over again */
                this._errorLabel.visible = false;
                this._stack.visible_child_name = 'logged-in';
            }
        } else {
            if (errorMessage)
                Utils.showDialog(errorMessage, Gtk.MessageType.ERROR, this);
            /* switch back to the sign-in view, and show a label indicating
               that verification failed */
            this._errorLabel.visible = true;
            this._errorLabel.label =
                _("The verification code didn’t match, please try again.");
            this._signInButton.sensitive = true;
            this._stack.visible_child_name = 'sign-in';
        }
        /* reset verification code entry */
        this._verificationEntry.text = '';
    }

    _onSignOutButtonClicked() {
        Application.osmEdit.signOut();
        this._signInButton.sensitive= true;
        this._stack.visible_child_name = 'sign-in';
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/osm-account-dialog.ui',
    InternalChildren: ['stack',
                       'signInButton',
                       'verificationEntry',
                       'verifyButton',
                       'errorLabel',
                       'signedInUserLabel',
                       'signOutButton'],
}, OSMAccountDialog);
