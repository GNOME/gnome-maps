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

const _ = imports.gettext.gettext;

const Maps = imports.gi.GnomeMaps;
const Rest = imports.gi.Rest;
const Secret = imports.gi.Secret;
const Soup = imports.gi.Soup;

const Utils = imports.utils;

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

var OSMConnection = class OSMConnection {

    constructor() {
        this._session = new Soup.Session({ user_agent : 'gnome-maps/' + pkg.version });

        /* OAuth proxy used for making OSM uploads */
        this._callProxy = Rest.OAuthProxy.new(CONSUMER_KEY, CONSUMER_SECRET,
                                              BASE_URL + '/' + API_VERSION,
                                              false);
        Maps.osm_init();
    }

    getOSMObject(type, id, callback, cancellable) {
        let url = this._getQueryUrl(type, id);
        let uri = new Soup.URI(url);
        let request = new Soup.Message({ method: 'GET', uri: uri });

        cancellable.connect(() => {
            this._session.cancel_message(request, Soup.STATUS_CANCELLED);
        });

        this._session.queue_message(request, (obj, message) => {
            if (message.status_code !== Soup.Status.OK) {
                callback(false, message.status_code, null, type, null);
                return;
            }

            try {
                let object = Maps.osm_parse (message.response_body.data,
                                             message.response_body.length);
                callback(true, message.status_code, object, type, null);
            } catch (e) {
                Utils.debug(e);
                callback(false, message.status_code, null, type, e);
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
            Maps.OSMChangeset.new(comment, 'gnome-maps ' + pkg.version);
        let xml = changeset.serialize();

        let call = Maps.OSMOAuthProxyCall.new(this._callProxy, xml);
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
        let call = Maps.OSMOAuthProxyCall.new(this._callProxy, xml);

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
        let call = Maps.OSMOAuthProxyCall.new(this._callProxy, xml);

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

    authorizeOAuthToken(username, password, callback) {
        /* get login session ID */
        let loginUrl = LOGIN_URL + '?cookie_test=true';
        let uri = new Soup.URI(loginUrl);
        let msg = new Soup.Message({method: 'GET', uri: uri});

        this._session.queue_message(msg, (obj, message) => {
            this._onLoginFormReceived(message, username, password, callback);
        });
    }

    _onLoginFormReceived(message, username, password, callback) {
        if (message.status_code !== Soup.Status.OK) {
            callback(false);
            return;
        }

        let osmSessionID =
            this._extractOSMSessionID(message.response_headers);
        let osmSessionToken =
            this._extractToken(message.response_body.data);

        if (osmSessionID === null || osmSessionToken === null) {
            callback(false, null);
            return;
        }

        this._login(username, password, osmSessionID, osmSessionToken, callback);
    }

    _login(username, password, sessionId, token, callback) {
        /* post login form */
        let msg = Soup.form_request_new_from_hash('POST', LOGIN_URL,
                                                  {username: username,
                                                   password: password,
                                                   referer: '/',
                                                   commit: 'Login',
                                                   authenticity_token: token});
        let requestHeaders = msg.request_headers;

        requestHeaders.append('Content-Type',
                              'application/x-www-form-urlencoded');
        requestHeaders.append('Cookie', '_osm_session=' + sessionId);
        msg.flags |= Soup.MessageFlags.NO_REDIRECT;

        this._session.queue_message(msg, (obj, message) => {
            if (message.status_code === Soup.Status.MOVED_TEMPORARILY)
                this._fetchAuthorizeForm(username, sessionId, callback);
            else
                callback(false, null);
        });

    }

    _fetchAuthorizeForm(username, sessionId, callback) {
        let auth = '/authorize?oauth_token=';
        let authorizeUrl = OAUTH_ENDPOINT_URL + auth + this._oauthToken;
        let uri = new Soup.URI(authorizeUrl);
        let msg = new Soup.Message({uri: uri, method: 'GET'});

        msg.request_headers.append('Cookie',
                                   '_osm_session=' + sessionId +
                                   '; _osm_username=' + username);
        this._session.queue_message(msg, (obj, message) => {
            if (message.status_code === Soup.Status.OK) {
                let token = this._extractToken(message.response_body.data);
                this._postAuthorizeForm(username, sessionId, token, callback);
            } else {
                callback(false, null);
            }
        });
    }

    _postAuthorizeForm(username, sessionId, token, callback) {
        let authorizeUrl = OAUTH_ENDPOINT_URL + '/authorize';
        let msg = Soup.form_request_new_from_hash('POST', authorizeUrl, {
            oauth_token: this._oauthToken,
            oauth_callback: '',
            authenticity_token: token,
            allow_write_api: '1',
            commit: 'Save changes'
        });
        let requestHeaders = msg.request_headers;

        requestHeaders.append('Content-Type',
                              'application/x-www-form-urlencoded');
        requestHeaders.append('Cookie',
                              '_osm_session=' + sessionId +
                              '; _osm_username=' + username);

        this._session.queue_message(msg, (obj, message) => {
            if (msg.status_code === Soup.Status.OK) {
                callback(true, message.response_body.data);
            } else
                callback(false, null);
        });
    }

    requestOAuthAccessToken(code, callback) {
        this._oauthProxy.access_token_async('access_token', code, (p, error, w, data) => {
            this._onAccessOAuthToken(error, callback);
        }, this._oauthProxy);
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
        if (result)
            res = Secret.password_store_finish(result);
        callback(res);
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

    /* extract the session ID from the login form response headers */
    _extractOSMSessionID(responseHeaders) {
        let cookie = responseHeaders.get('Set-Cookie');

        if (cookie === null)
            return null;

        let cookieParts = cookie.split(';');
        for (let cookiePart of cookieParts) {
            let kvPair = cookiePart.trim().split('=');
            let kv = kvPair;

            if (kv.length !== 2) {
                continue;
            } else if (kv[0] === '_osm_session') {
                return kv[1];
            }
        }

        return null;
    }

    /* extract the authenticity token from the hidden input field of the login
       form */
    _extractToken(messageBody) {
        let regex = /.*authenticity_token.*value=\"([^\"]+)\".*/;
        let lines = messageBody.split('\n');

        for (let line of lines) {
            let match = line.match(regex);

            if (match && match.length === 2)
                return match[1];
        }

        return null;
    }
};

/*
 * Gets a status message (usually for an error case)
 * to show for a given OSM server response.
 */
function getStatusMessage(statusCode) {
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
