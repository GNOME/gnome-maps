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

import gettext from 'gettext';

import GnomeMaps from 'gi://GnomeMaps';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Rest from 'gi://Rest';
import Secret from 'gi://Secret';
import Soup from 'gi://Soup';

import * as Utils from './utils.js';

const _ = gettext.gettext;

const BASE_URL = 'https://api.openstreetmap.org/api';
const API_VERSION = '0.6';

/* OAuth constants */
const CONSUMER_KEY = '2lbpDoED0ZspGssTBAJ8zOCtrtmUoX4KnmZUIWIK';
const CONSUMER_SECRET = 'AO9BhDl9sJ33DjaZgQmYcNIuM3ZSml4xtugai6gE';
const OAUTH_ENDPOINT_URL = 'https://www.openstreetmap.org/oauth';
const LOGIN_URL = 'https://www.openstreetmap.org/login';

const SECRET_SCHEMA = new Secret.Schema("org.gnome.Maps",
    Secret.SchemaFlags.NONE,
    {
    }
);

export class OSMConnection {

    constructor() {
        this._session = new Soup.Session({ user_agent : 'gnome-maps/' + pkg.version });

        /* OAuth proxy used for making OSM uploads */
        this._callProxy = Rest.OAuthProxy.new(CONSUMER_KEY, CONSUMER_SECRET,
                                              BASE_URL + '/' + API_VERSION,
                                              false);
        GnomeMaps.osm_init();
    }

    getOSMObject(type, id, callback, cancellable) {
        let url = this._getQueryUrl(type, id);
        let request = Soup.Message.new('GET', url);

        this._session.send_and_read_async(request, GLib.PRIORITY_DEFAULT, cancellable,
                                          (source, res) => {
            if (request.get_status() !== Soup.Status.OK) {
                callback(false, message.get_status(), null, type, null);
                return;
            }

            try {
                let body = this._session.send_and_read_finish(res);
                let object = GnomeMaps.osm_parse (Utils.getBufferText(body.get_data()),
                                                  body.get_size());
                callback(true, request.get_status(), object, type, null);
            } catch (e) {
                Utils.debug(e);
                callback(false, request.get_status(), null, type, e);
            }
        });
    }

    _getQueryUrl(type, id) {
        return BASE_URL + '/' + API_VERSION + '/' + type + '/' + id;
    }

    openChangeset(comment, callback) {
        /* we assume that this would only be called if there's already been an
           OAuth access token enrolled, so, if the currently instantiated
           proxy instance doesn't have a token set, we could safely count on
           it being present in the keyring */
        if (this._callProxy.get_token() === null) {
            Secret.password_lookup(SECRET_SCHEMA, {}, null, (s, res) => {
                this._onPasswordLookedUp(res,
                                         comment,
                                         callback);
            });
        } else {
            this._doOpenChangeset(comment, callback);
        }
    }

    _onPasswordLookedUp(result, comment, callback) {
        let password = Secret.password_lookup_finish(result);

        if (password) {
            let token = password.split(':')[0];
            let secret = password.split(':')[1];

            this._callProxy.token = token;
            this._callProxy.token_secret = secret;
            this._doOpenChangeset(comment, callback);
        } else {
            callback(false, null, null);
        }
    }

    _doOpenChangeset(comment, callback) {
        let changeset =
            GnomeMaps.OSMChangeset.new(comment, 'gnome-maps ' + pkg.version);
        let xml = changeset.serialize();

        let call = GnomeMaps.OSMOAuthProxyCall.new(this._callProxy, xml);
        call.set_method('PUT');
        call.set_function('/changeset/create');

        call.invoke_async(null, (call, res, userdata) =>
                                { this._onChangesetOpened(call, callback); });
    }

    _onChangesetOpened(call, callback) {
        if (call.get_status_code() !== Soup.Status.OK) {
            callback(false, call.get_status_code(), null);
            return;
        }

        let changesetId = parseInt(call.get_payload());
        callback(true, call.get_status_code(), changesetId);
    }

    uploadObject(object, type, changeset, callback) {
        object.changeset = changeset;

        let xml = object.serialize();
        let call = GnomeMaps.OSMOAuthProxyCall.new(this._callProxy, xml);

        call.set_method('PUT');
        call.set_function(this._getCreateOrUpdateFunction(object, type));

        call.invoke_async(null, (call, res, userdata) =>
                                { this._onObjectUploaded(call, callback); });
    }

    _onObjectUploaded(call, callback) {
        if (call.get_status_code() !== Soup.Status.OK) {
            callback(false, call.get_status_code(), null);
            return;
        }

        callback(true, call.get_status_code(), call.get_payload());
    }

    deleteObject(object, type, changeset, callback) {
        object.changeset = changeset;

        let xml = object.serialize();
        let call = GnomeMaps.OSMOAuthProxyCall.new(this._callProxy, xml);

        call.set_method('DELETE');
        call.set_function(this._getDeleteFunction(object, type));

        call.invoke_async(null, (call, res, userdata) =>
                                { this._onObjectDeleted(call, callback); });
    }

    _onObjectDeleted(call, callback) {
        if (call.get_status_code() !== Soup.Status.OK) {
            callback(false, call.get_status_code(), null);
            return;
        }

        callback(true, call.get_status_code(), call.get_payload());
    }

    closeChangeset(changesetId, callback) {
        let call = this._callProxy.new_call();
        call.set_method('PUT');
        call.set_function(this._getCloseChangesetFunction(changesetId));

        call.invoke_async(null, (call, res, userdata) =>
                                { this._onChangesetClosed(call, callback); });
    }

    _onChangesetClosed(call, callback) {
        if (call.get_status_code() !== Soup.Status.OK) {
            callback(false, call.get_status_code(), null);
            return;
        }

        callback(true, call.get_status_code(), call.get_payload());
    }

    _getCloseChangesetFunction(changesetId) {
        return '/changeset/' + changesetId + '/close';
    }

    _getCreateOrUpdateFunction(object, type) {
        if (object.id)
            return type + '/' + object.id;
        else
            return type + '/create';
    }

    _getDeleteFunction(object, type) {
        return type + '/' + id;
    }

    requestOAuthToken(callback) {
        /* OAuth proxy used for enrolling access tokens */
        this._oauthProxy = Rest.OAuthProxy.new(CONSUMER_KEY, CONSUMER_SECRET,
                                               OAUTH_ENDPOINT_URL, false);
        this._oauthProxy.request_token_async('request_token', 'oob', (p, error, w, u) => {
            this._onRequestOAuthToken(error, callback);
        }, this._oauthProxy);
    }

    _onRequestOAuthToken(error, callback) {
        if (error) {
            Utils.debug(error);
            callback(false);
            return;
        }

        this._oauthToken = this._oauthProxy.get_token();
        this._oauthTokenSecret = this._oauthProxy.get_token_secret();
        callback(true);
    }

    authorizeOAuthToken(callback) {
        let auth = '/authorize?oauth_token=';
        let authorizeUrl = OAUTH_ENDPOINT_URL + auth + this._oauthToken;

        Utils.debug('Trying to open: ' + authorizeUrl);

        try {
            Gio.AppInfo.launch_default_for_uri(authorizeUrl, null);
            callback(true);
        } catch (e) {
            Utils.debug('error: ' + e.message);
            callback(false);
        }
    }

    requestOAuthAccessToken(code, callback) {
        this._oauthProxy.access_token_async('access_token', code, (p, error, w, data) => {
            this._onAccessOAuthToken(error, callback);
        }, this._oauthProxy);
    }

    fetchLoggedInUser(callback) {
        let call = this._callProxy.new_call();
        call.set_method('GET');
        call.set_function('/user/details');

        call.invoke_async(null, (call, res, userdata) =>
                                { this._onFetchedLoggedInUser(call, callback); });
    }

    _onFetchedLoggedInUser(call, callback) {
        switch (call.get_status_code()) {
            case Soup.Status.OK:
                try {
                    callback(GnomeMaps.osm_parse_user_details(call.get_payload()));
                } catch (e) {
                    Utils.debug('Error parsing user details: ' + e.message);
                    callback(null);
                }
                break;
            default:
                /* Not ok, most likely 403 (forbidden), meaning the user
                 * didn't give permission to read user details.
                 * Just consider the user name unknown in this case
                 */
                Utils.debug('Got status code ' + call.get_status_code() +
                            ' getting user details');
                callback(null);
                break;
        }
    }

    _onAccessOAuthToken(error, callback) {
        if (error) {
            callback(false);
            return;
        }

        let token = this._oauthProxy.token;
        let secret = this._oauthProxy.token_secret;

        this._callProxy.token = token;
        this._callProxy.token_secret = secret;
        Secret.password_store(SECRET_SCHEMA, {}, Secret.COLLECTION_DEFAULT,
                              "OSM OAuth access token and secret",
                              this._oauthProxy.token + ":" +
                              this._oauthProxy.token_secret, null,
                              (source, result, userData) => {
                                this._onPasswordStored(result, callback);
                              });
    }

    _onPasswordStored(result, callback) {
        let res = false;
        let errorMessage;
        if (result) {
            try {
                res = Secret.password_store_finish(result);
            } catch (error) {
                errorMessage = error.message;
            }
        }
        callback(res, errorMessage);
    }

    signOut() {
        /* clear token on call proxy, so it will use a new token if the user
           signs in again (with a new access token) during this running
           session */
        this._callProxy.token = null;
        this._callProxy.token_secret = null;

        Secret.password_clear(SECRET_SCHEMA, {}, null,
            this._onPasswordCleared.bind(this));
    }

    _onPasswordCleared(source, result) {
        Secret.password_clear_finish(result);
    }

    /*
     * Gets a status message (usually for an error case)
     * to show for a given OSM server response.
     */
    static getStatusMessage(statusCode) {
        switch (statusCode) {
        case Soup.Status.IO_ERROR:
        case Soup.Status.UNAUTHORIZED:
            /* setting the status in session.cancel_message still seems
               to always give status IO_ERROR */
            return _("Incorrect user name or password");
        case Soup.Status.OK:
            return _("Success");
        case Soup.Status.BAD_REQUEST:
            return _("Bad request");
        case Soup.Status.NOT_FOUND:
            return _("Object not found");
        case Soup.Status.CONFLICT:
            return _("Conflict, someone else has just modified the object");
        case Soup.Status.GONE:
            return _("Object has been deleted");
        case Soup.Status.PRECONDITION_FAILED:
            return _("Way or relation refers to non-existing children");
        default:
            return null;
        }
    }
}
