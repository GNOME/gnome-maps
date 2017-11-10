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
const Lang = imports.lang;

const Application = imports.application;
const OSMAccountDialog = imports.osmAccountDialog;
const OSMEditDialog = imports.osmEditDialog;
const OSMConnection = imports.osmConnection;
const Utils = imports.utils;

/* minimum zoom level at which to offer adding a location */
var MIN_ADD_LOCATION_ZOOM_LEVEL = 16;

var OSMEdit = new Lang.Class({
    Name: 'OSMEdit',
    Extends: GObject.Object,

    _init: function() {
        this._osmConnection = new OSMConnection.OSMConnection();
        this._osmObject = null; // currently edited object
        this._username = Application.settings.get('osm-username');
        this._isSignedIn = this._username !== null && this._username.length > 0;
    },

    get object() {
        return this._osmObject;
    },

    createEditDialog: function(parentWindow, place) {
        let dialog = new OSMEditDialog.OSMEditDialog({
            transient_for: parentWindow,
            modal: true,
            place: place
        });

        return dialog;
    },

    createEditNewDialog: function(parentWindow, latitude, longitude) {
        let dialog = new OSMEditDialog.OSMEditDialog({
            transient_for: parentWindow,
            modal: true,
            addLocation: true,
            latitude: latitude,
            longitude: longitude
        });

        return dialog;
    },

    createAccountDialog: function(parentWindow, closeOnSignIn) {
        let dialog = new OSMAccountDialog.OSMAccountDialog({
            transient_for: parentWindow,
            modal: true,
            closeOnSignIn: closeOnSignIn
        });

        return dialog;
    },

    fetchObject: function(place, callback, cancellable) {
        let osmType = Utils.osmTypeToString(place.osmType);

        /* reset currenly edited object */
        this._osmObject = null;
        this._osmConnection.getOSMObject(osmType, place.osm_id,
                     (function(success, status, osmObject, osmType) {
                         callback(success, status, osmObject, osmType);
                     }), cancellable);
    },

    uploadObject: function(object, type, comment, callback) {
        this._openChangeset(object, type, comment,
                            this._uploadObject.bind(this), callback);
    },

    _onChangesetOpened: function(success, status, changesetId, object, type,
                                 action, callback) {
        if (success) {
            let osmType = Utils.osmTypeToString(type);
            action(object, osmType, changesetId, callback);
        } else {
            callback(false, status);
        }
    },

    _openChangeset: function(object, type, comment, action, callback) {
        this._osmConnection.openChangeset(comment, (success, status, changesetId) => {
            this._onChangesetOpened(success, status, changesetId, object, type, action, callback);
        });
    },

    _onObjectUploaded: function(success, status, response, changesetId, callback) {
        if (success)
            this._closeChangeset(changesetId, callback);
        else
            callback(false, status);
    },

    _uploadObject: function(object, type, changesetId, callback) {
        this._osmObject = object;
        this._osmConnection.uploadObject(object, type, changesetId, (success, status, response) => {
            this._onObjectUploaded(success, status, response, changesetId, callback);
        });
    },

    deleteObject: function(object, type, comment, callback) {
        this._openChangeset(object, type, comment,
                            this._deleteObject.bind(this), callback);
    },

    _onObjectDeleted: function(success, status, response, changesetId, callback) {
        if (success)
            this._closeChangeset(changesetId, callback);
        else
            callback(false, status);
    },

    _deleteObject: function(object, type, changesetId, callback) {
        this._osmObject = object;
        this._osmConnection.deleteObject(object, type, changesetId, (success, status, response) => {
            this._onObjectDeleted(success, status, response, changesetId, callback);
        });
    },

    _closeChangeset: function(changesetId, callback) {
        this._osmConnection.closeChangeset(changesetId, callback);
    },

    performOAuthSignIn: function(username, password, callback) {
        this._osmConnection.requestOAuthToken((success) => {
            if (success)
                this._onOAuthTokenRequested(username, password, callback);
            else
                callback(false, null);
        });
    },

    _onOAuthTokenRequested: function(username, password, callback) {
        /* keep track of authorizing username */
        this._username = username;
        this._osmConnection.authorizeOAuthToken(username, password, callback);
    },

    requestOAuthAccessToken: function(code, callback) {
        this._osmConnection.requestOAuthAccessToken(code, (success, token) => {
            this._onOAuthAccessTokenRequested(success, callback);
        });
    },

    _onOAuthAccessTokenRequested: function(success, callback) {
        if (success) {
            this._isSignedIn = true;
            Application.settings.set('osm-username', this._username);
        } else {
            /* clear out username if verification was unsuccessful */
            this._username = null;
        }

        callback(success);
    },

    signOut: function() {
        this._username = null;
        this._isSignedIn = false;

        Application.settings.set('osm-username', '');
        this._osmConnection.signOut();
    },

    get isSignedIn() {
        return this._isSignedIn;
    },

    get username() {
        return this._username;
    }
});
