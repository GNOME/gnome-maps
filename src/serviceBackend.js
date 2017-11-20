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

const Utils = imports.utils;

var ServiceBackend = GObject.registerClass({
    Abstract: true
}, class ServiceBackend extends GObject.Object {

    //Abstract
    get name() { }

    //Abstract
    createRestCall(authorizer) { }

    //Abstract
    refreshAuthorization(authorizer, cancellable) { }

    //Abstract
    getAuthorizerAccount(authorizer) { }

    //Abstract
    createAuthorizer(account) { }

    //Abstract
    isTokenInvalid(restCall, parsedPayload) { }

    //Abstract
    isInvalidCall(restCall, parsedPayload) { }

    //Abstract
    getCallResultCode(restCall, parsedPayload) { }

    //Abstract
    getCallResultMessage(restCall, parsedPayload) { }

    callAsync(authorizer, method, func, params, callback, cancellable, mustRefreshToken) {
        mustRefreshToken = mustRefreshToken || true;
        cancellable = cancellable || null;

        let restCall = this.createRestCall(authorizer);

        method = method.toUpperCase();
        restCall.set_method(method);

        for (let key in params)
            restCall.add_param(key, params[key].toString());

        restCall.set_function(func);

        Utils.debug(this.name + ': ' + func);

        restCall.invoke_async(cancellable, (call, result) => {
            let data = JSON.parse(call.get_payload());
            let account = this.getAuthorizerAccount(authorizer);

            if (data && this.isTokenInvalid(call, data))
                if (mustRefreshToken) {
                    //Unauthorized token error, we need to refresh the token
                    Utils.debug(this.name + ': The token is not authorized, refreshing token');
                    try {
                        this.refreshAuthorization(authorizer, cancellable);
                        this.callAsync(authorizer, method, func, params, callback, cancellable, false);
                    } catch(error) {
                        callback(account, data, { code: 401,
                                                  message: null });
                    }
                } else
                    callback(account, data, { code: 401,
                                              message: null });
            else if (this.isInvalidCall(call, data))
                callback(account, data, { code: this.getCallResultCode(call, data),
                                          message: this.getCallResultMessage(call, data) });
            else
                callback(account, data, null);
        });
    }

    performCheckIn(authorizer, checkIn, callback, cancellable) {
        callback = callback || function() {};
        this._realPerformCheckIn(authorizer, checkIn, callback, cancellable);
    }

    //Abstract
    _realPerformCheckIn(authorizer, checkIn, callback, cancellable) { }

    findPlaces(authorizer, latitude, longitude, distance, callback, cancellable) {
        callback = callback || function() {};
        this._realFindPlaces(authorizer,
                             latitude,
                             longitude,
                             distance,
                             (account, data, error) => {
                                 if (!error)
                                     callback(account, this.createPlaces(data), error);
                                 else
                                     callback(account, [], error);
                             },
                             cancellable);
    }

    //Abstract
    _realFindPlaces(authorizer, latitude, longitude, distance, callback, cancellable) { }

    //Abstract
    createPlaces(rawData) { }
});
