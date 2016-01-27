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

const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const WebKit2 = imports.gi.WebKit2;

const Application = imports.application;

const Response = {
    SIGNED_IN: 0
};

const OSMAccountDialog = new Lang.Class({
    Name: 'OSMAccountDialog',
    Extends: Gtk.Dialog,
    Template: 'resource:///org/gnome/Maps/ui/osm-account-dialog.ui',
    InternalChildren: ['stack',
                       'emailEntry',
                       'passwordEntry',
                       'signInButton',
                       'signInSpinner',
                       'signUpLinkButton',
                       'resetPasswordLabel',
                       'verifyView',
                       'verificationEntry',
                       'verifyButton',
                       'verificationFailedLabel',
                       'signedInUserLabel',
                       'signOutButton'],

    _init: function(params) {
        /* This is a construct-only property and cannot be set by GtkBuilder */
        params.use_header_bar = true;
        GObject.type_ensure(WebKit2.WebView);

        this._closeOnSignIn = params.closeOnSignIn;
        delete params.closeOnSignIn;

        this.parent(params);

        this._emailEntry.connect('changed',
                                 this._onCredentialsChanged.bind(this));
        this._passwordEntry.connect('changed',
                                    this._onCredentialsChanged.bind(this));
        this._passwordEntry.connect('activate',
                                    this._onPasswordActivated.bind(this));
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
            this._signedInUserLabel.label = Application.osmEdit.username;
            this._stack.visible_child_name = 'logged-in';
        }
    },

    _onCredentialsChanged: function() {
        let email = this._emailEntry.text;
        let password = this._passwordEntry.text;

        /* make sign in button sensitive if credential have been entered
            TODO: should we try to validate email addresses? */
        this._signInButton.sensitive =
            email && email.length > 0 && password && password.length > 0;
    },

    _onSignInButtonClicked: function() {
        this._performSignIn();
    },

    _onPasswordActivated: function() {
        /* if username and password was entered, proceed with sign-in */
        let email = this._emailEntry.text;
        let password = this._passwordEntry.text;

        if (email && email.length > 0 && password && password.length > 0)
            this._performSignIn();
    },

    _performSignIn: function() {
        /* turn on signing in spinner and desensisize credential entries */
        this._signInSpinner.visible = true;
        this._signInButton.sensitive = false;
        this._emailEntry.sensitive = false;
        this._passwordEntry.sensitive = false;
        this._signUpLinkButton.visible = false;

        Application.osmEdit.performOAuthSignIn(this._emailEntry.text,
                                               this._passwordEntry.text,
                                               this._onOAuthSignInPerformed.bind(this));
    },

    _onOAuthSignInPerformed: function(success, verificationPage) {
        if (success) {
            /* switch to the verification view and show the verification
               page */
            this._verifyView.load_html(verificationPage,
                                       'https://www.openstreetmap.org/');
            this._stack.visible_child_name = 'verify';
        } else {
            /* clear password entry */
            this._passwordEntry.text = '';
            /* show the password reset link */
            this._resetPasswordLabel.visible = true;
        }

        this._signInSpinner.visible = false;
        /* re-sensisize credential entries */
        this._emailEntry.sensitive = true;
        this._passwordEntry.sensitive = true;
    },

    _onVerifyButtonClicked: function() {
        this._performVerification();
    },

    _performVerification: function() {
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
    },

    _onVerificationEntryChanged: function() {
        this._verifyButton.sensitive =
            this._verificationEntry.text &&
            this._verificationEntry.text.length > 0;
    },

    _onVerificationEntryActivated: function() {
        /* proceed with verfication if a code has been entered */
        let verificationCode = this._verificationEntry.text;

        if (verificationCode && verificationCode.length > 0)
            this._performVerification();
    },

    _onOAuthAccessTokenRequested: function(success) {
        if (success) {
            /* update the username label */
            this._signedInUserLabel.label = Application.osmEdit.username;

            if (this._closeOnSignIn) {
                this.response(Response.SIGNED_IN);
            } else {
                /* switch to the logged in view and reset the state in case
                   the user signs out and start over again */
                this._resetPasswordLabel.visible = false;
                this._verificationFailedLabel = false;
                this._signUpLinkButton.visible = true;
                this._stack.visible_child_name = 'logged-in';
            }
        } else {
            /* switch back to the sign-in view, and show a label indicating
               that verification failed */
            this._resetPasswordLabel.visible = false;
            this._signUpLinkButton.visible = false;
            this._verificationFailedLabel.visible = true;
            this._signInButton.sensitive = true;
            this._stack.visible_child_name = 'sign-in';
        }
        /* reset verification code entry */
        this._verificationEntry.text = '';
    },

    _onSignOutButtonClicked: function() {
        Application.osmEdit.signOut();
        this._stack.visible_child_name = 'sign-in';
    }
});
