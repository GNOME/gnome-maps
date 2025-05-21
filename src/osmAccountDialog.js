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

import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Adw from 'gi://Adw';

import {Application} from './application.js';
import * as Utils from './utils.js';

export class OSMAccountDialog extends Adw.Dialog {

    static Response = { SIGNED_IN: 0 };

    constructor({closeOnSignIn, ...params}) {
        super({...params});

        this.connect('closed', () => {
            this._cancellable.cancel();
            this.emit('response', this.response);
        });

        this._closeOnSignIn = closeOnSignIn;

        this._signInButton.connect('clicked',
                                   this._onSignInButtonClicked.bind(this));
        this._verifyButton.connect('clicked',
                                   this._onVerifyButtonClicked.bind(this));
        this._verificationEntry.connect('changed',
                                        this._onVerificationEntryChanged.bind(this));
        this._verificationEntry.connect('entry-activated',
                                        this._onVerificationEntryActivated.bind(this));
        this._signOutButton.connect('clicked',
                                    this._onSignOutButtonClicked.bind(this));

        this._cancellable = new Gio.Cancellable();

        this._cachedAvatarFilename = GLib.build_filenamev([
            GLib.get_user_data_dir(),
            "gnome-maps",
            "osm-user-avatar.png",
        ]);

        /* if there is a cached OSM avatar on disk, set it directly, while
         * also asynchronously downloading it again in the background (the first
         * time the dialog is opened) to catch upstream updates
         */
        try {
            const avatarTexture =
                Gdk.Texture.new_from_filename(this._cachedAvatarFilename);

            if (avatarTexture)
                this._statusPage.paintable = avatarTexture;
        } catch (e) {
            Utils.debug('No cached OSM user avatar found');
        }

        /* if the user is logged in, show the logged-in view */
        if (Application.osmEdit.isSignedIn) {
            this._updateSignedInUserLabel();
            this._loadAvatar();
            this._navigationView.replace_with_tags(['logged-in']);
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

    _loadAvatar() {
        Application.osmEdit.fetchUserAvatar(this._cancellable,
                                            (avatarAvailable, texture) => {
            /* if there is an avatar specified in the user details, update
             * the icon image if downloading it was successful and update
             * the cached icon, so that it can be loaded instantly when
             * opening the dialog the next time.
             * if not available, reset to the default icon, and remove cached
             * image (this could happen if the user has deleted the avatar in
             * their OSM profile).
             */
            if (avatarAvailable) {
                if (texture) {
                    this._statusPage.paintable = texture;
                    texture.save_to_png(this._cachedAvatarFilename);
                }
            } else {
                this._statusPage.icon_name = 'avatar-default-symbolic';
                Gio.File.new_for_path(this._cachedAvatarFilename).delete(null);
            }
        });
    }

    _onSignInButtonClicked() {
        this._performSignIn();
    }

    _performSignIn() {
        // switch to the verification view
        this._navigationView.replace_with_tags(['verify']);

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
            /* update the username label, and try to load the custom user avatar */
            this._updateSignedInUserLabel();
            this._loadAvatar();

            if (this._closeOnSignIn) {
                this.response = OSMAccountDialog.Response.SIGNED_IN;
                this.close();
            } else {
                /* switch to the logged in view and reset the state in case
                   the user signs out and start over again */
                this._navigationView.replace_with_tags(['logged-in']);
            }
        } else {
            if (errorMessage)
                Utils.showToastInOverlay(errorMessage, this._overlay);
            /* switch back to the sign-in view, and show a toast indicating
               that verification failed */
            Utils.showToastInOverlay(_("The verification code didn’t match, please try again."), this._overlay);
            this._signInButton.sensitive = true;
            this._navigationView.replace_with_tags(['sign-in']);
        }
        /* reset verification code entry */
        this._verificationEntry.text = '';
    }

    _onSignOutButtonClicked() {
        Application.osmEdit.signOut();
        this._signInButton.sensitive= true;
        this._navigationView.replace_with_tags(['sign-in']);
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/osm-account-dialog.ui',
    Properties: {
        'response': GObject.ParamSpec.int('response', '', '',
                                             GObject.ParamFlags.READABLE |
                                             GObject.ParamFlags.WRITABLE,
                                             0),
    },
    Signals: {
        'response': { param_types: [GObject.TYPE_INT] },
    },
    InternalChildren: ['navigationView',
                       'signInButton',
                       'verificationEntry',
                       'verifyButton',
                       'statusPage',
                       'signedInUserLabel',
                       'signOutButton',
                       'overlay'],
}, OSMAccountDialog);
