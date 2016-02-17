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

const GFBGraph = imports.gi.GFBGraph;
const Lang = imports.lang;

const ServiceBackend = imports.serviceBackend;
const SocialPlace = imports.socialPlace;

const _PLACE_LINK_FORMAT = 'https://www.facebook.com/%s';

const FacebookBackend = new Lang.Class({
    Name: 'SocialServiceFacebookBackend',
    Extends: ServiceBackend.ServiceBackend,

    get name() {
        return 'facebook';
    },

    createRestCall: function(authorizer) {
        return GFBGraph.new_rest_call(authorizer);
    },

    refreshAuthorization: function(authorizer, cancellable) {
        return authorizer.refresh_authorization(cancellable);
    },

    getAuthorizerAccount: function(authorizer) {
        return authorizer.goa_object;
    },

    createAuthorizer: function(account) {
        return new GFBGraph.GoaAuthorizer({ goa_object: account });
    },

    isTokenInvalid: function(restCall, data) {
        return data.error &&
               (data.error.code === 2500 || data.error.code === 104 || data.error.code === 190);
    },

    isInvalidCall: function(restCall, data) {
        return !data || data.error;
    },

    getCallResultCode: function(restCall, data) {
        return data ?
            (data.error ? data.error.code : null) :
            restCall.get_status_code();
    },

    getCallResultMessage: function(restCall, data) {
        return data ?
            (data.error ? data.error.message : null) :
            restCall.get_status_message();
    },

    _realPerformCheckIn: function(authorizer, checkIn, callback, cancellable) {
        this.callAsync(authorizer,
                       'POST',
                       'me/feed',
                       { 'message': checkIn.message,
                         'place': checkIn.place.id,
                         'privacy_value': checkIn.privacy },
                       callback,
                       cancellable);
    },

    _realFindPlaces: function(authorizer, latitude, longitude, distance, callback, cancellable) {
        this.callAsync(authorizer,
                       'GET',
                       'search',
                       { 'type': 'place',
                         'center': latitude + ',' + longitude,
                         'distance': distance },
                       callback,
                       cancellable);
    },

    createPlaces: function(rawData) {
        return rawData.data.map(function(place) {
            let link = _PLACE_LINK_FORMAT.format(place.id);

            return new SocialPlace.SocialPlace({ id: place.id,
                                                 name: place.name,
                                                 latitude: place.location.latitude,
                                                 longitude: place.location.longitude,
                                                 category: place.category,
                                                 link: link,
                                                 originalData: place });
        });
    }
});
