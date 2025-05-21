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

import {Application} from './application.js';
import {OSMAccountDialog} from './osmAccountDialog.js';
import {OSMEditDialog} from './osmEditDialog.js';
import {OSMConnection} from './osmConnection.js';
import * as Utils from './utils.js';

export class OSMEdit {

    // minimum zoom level at which to offer adding a location
    static get MIN_ADD_LOCATION_ZOOM_LEVEL() { return 16; }

    constructor() {
        this._osmConnection = new OSMConnection();
        this._osmObject = null; // currently edited object
        this._username = Application.settings.get('osm-username-oauth2');
        this._isSignedIn = this._username !== null && this._username.length > 0;
    }

    get object() {
        return this._osmObject;
    }

    createEditDialog(place) {
        let dialog = new OSMEditDialog({ place: place });

        return dialog;
    }

    createEditNewDialog(latitude, longitude) {
        let dialog = new OSMEditDialog({ addLocation: true,
                                         latitude: latitude,
                                         longitude: longitude });

        return dialog;
    }

    createAccountDialog(closeOnSignIn) {
        let dialog = new OSMAccountDialog({
            closeOnSignIn: closeOnSignIn
        });

        return dialog;
    }

    fetchObject(place, callback, cancellable) {
        let osmType = Utils.osmTypeToString(place.osmType);

        /* reset currently edited object */
        this._osmObject = null;
        this._osmConnection.getOSMObject(osmType, place.osmId,
                     (function(success, status, osmObject, osmType) {
                         callback(success, status, osmObject, osmType);
                     }), cancellable);
    }

    uploadObject(object, type, comment, callback) {
        this._openChangeset(object, type, comment,
                            this._uploadObject.bind(this), callback);
    }

    _onChangesetOpened(success, status, changesetId, object, type, action, callback) {
        if (success) {
            let osmType = Utils.osmTypeToString(type);
            action(object, osmType, changesetId, callback);
        } else {
            callback(false, status);
        }
    }

    _openChangeset(object, type, comment, action, callback) {
        this._osmConnection.openChangeset(comment, (success, status, changesetId) => {
            this._onChangesetOpened(success, status, changesetId, object, type, action, callback);
        });
    }

    _onObjectUploaded(success, status, response, changesetId, callback) {
        if (success)
            this._closeChangeset(changesetId, callback);
        else
            callback(false, status);
    }

    _uploadObject(object, type, changesetId, callback) {
        this._osmObject = object;
        this._osmConnection.uploadObject(object, type, changesetId, (success, status, response) => {
            this._onObjectUploaded(success, status, response, changesetId, callback);
        });
    }

    deleteObject(object, type, comment, callback) {
        this._openChangeset(object, type, comment,
                            this._deleteObject.bind(this), callback);
    }

    _onObjectDeleted(success, status, response, changesetId, callback) {
        if (success)
            this._closeChangeset(changesetId, callback);
        else
            callback(false, status);
    }

    _deleteObject(object, type, changesetId, callback) {
        this._osmObject = object;
        this._osmConnection.deleteObject(object, type, changesetId, (success, status, response) => {
            this._onObjectDeleted(success, status, response, changesetId, callback);
        });
    }

    _closeChangeset(changesetId, callback) {
        this._osmConnection.closeChangeset(changesetId, callback);
    }

    performOAuthSignIn() {
        this._osmConnection.authorizeOAuthToken();
    }

    requestOAuthAccessToken(code, callback) {
        this._osmConnection.requestOAuthAccessToken(code, (success, token) => {
            this._onOAuthAccessTokenRequested(success, callback);
        });
    }

    _onOAuthAccessTokenRequested(success, callback) {
        if (success) {
            this._osmConnection.fetchLoggedInUser((username) => {
                this._isSignedIn = true;
                /* if we couldn't retrieve the logged-in username,
                 * e.g. if the user de-selected the permission when
                 * authorizing the OAuth token, use a dummy placeholder
                 * username to signify that we are signed in
                 */
                this._username = username ?? '_unknown_';
                Application.settings.set('osm-username-oauth2', this._username);
                callback(true);
            });
        } else {
            callback(false);
        }
    }

    /**
     * Fetch user avatar
     *
     * The callback returns a boolean to indicate wheather the user details
     * specified an avatar picture, and the texture of the avatar (null if
     * downloading the image failed).
     */
    fetchUserAvatar(cancellable, callback) {
        this._osmConnection.fetchUserAvatar(cancellable, callback)
    }

    signOut() {
        this._username = null;
        this._isSignedIn = false;

        Application.settings.set('osm-username-oauth2', '');
        this._osmConnection.signOut();
    }

    get isSignedIn() {
        return this._isSignedIn;
    }

    get username() {
        return this._username;
    }
}
