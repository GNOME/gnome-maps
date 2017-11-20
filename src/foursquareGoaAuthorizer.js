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

const Rest = imports.gi.Rest;

const _FOURSQUARE_API_VERSION = '20140226';

var FoursquareGoaAuthorizer = class FoursquareGoaAuthorizer {
    constructor(params) {
        if (!params.goaObject) {
            logError('FoursquareGoaAuthorizer requires goaObject parameter');
            return;
        }

        this.goaObject = params.goaObject;
    }

    get goaObject() {
        return this._goaObject;
    }

    set goaObject(object) {
        this._goaObject = object;
        this._accessToken = null;
    }

    _refreshAccessToken(cancellable) {
        if (this._accessToken)
            return true;

        let getAccessTokenResult = this.goaObject.get_oauth2_based().call_get_access_token_sync(cancellable);

        if (getAccessTokenResult[0]) {
            this._accessToken = getAccessTokenResult[1];
            return true;
        }

        return false;
    }

    processCall(restCall) {
        this._refreshAccessToken(null);
        restCall.add_param('oauth_token', this._accessToken);
        restCall.add_param('v', _FOURSQUARE_API_VERSION);
    }

    processMessage(soupMessage) {
        this._refreshAccessToken(null);
        let uri = soupMessage.get_uri();
        uri.set_query(uri, 'oauth_token' + this._accessToken + '&v=' + _FOURSQUARE_API_VERSION);
    }

    refreshAuthorization(cancellable) {
        let ensureCredentialsResult = this.goaObject.get_account().call_ensure_credentials_sync(cancellable);
        if (ensureCredentialsResult[0]) {
            this._accessToken = null;
            return this._refreshAccessToken(cancellable);
        }

        return false;
    }
};

function newRestCall(authorizer)
{
    let proxy = new Rest.Proxy({ url_format: 'https://api.foursquare.com/v2',
                                 binding_required: false });
    let restCall = proxy.new_call();

    authorizer.processCall(restCall);

    return restCall;
}
