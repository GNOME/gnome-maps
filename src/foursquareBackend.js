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

const Lang = imports.lang;

const FoursquareGoaAuthorizer = imports.foursquareGoaAuthorizer;
const ServiceBackend = imports.serviceBackend;
const SocialPlace = imports.socialPlace;

const _PLACE_LINK_FORMAT = 'https://foursquare.com/v/foursquare-hq/%s';

const FoursquareBackend = new Lang.Class({
    Name: 'SocialServiceFoursquareBackend',
    Extends: ServiceBackend.ServiceBackend,

    get name() {
        return 'foursquare';
    },

    createRestCall: function(authorizer) {
        return FoursquareGoaAuthorizer.newRestCall(authorizer);
    },

    refreshAuthorization: function(authorizer, cancellable) {
        return authorizer.refreshAuthorization(cancellable);
    },

    getAuthorizerAccount: function(authorizer) {
        return authorizer.goaObject;
    },

    createAuthorizer: function(account) {
        return new FoursquareGoaAuthorizer.FoursquareGoaAuthorizer({ goaObject: account });
    },

    isTokenInvalid: function(restCall, data) {
        return data.meta.code === 401 || data.meta.code === 403;
    },

    isInvalidCall: function(restCall, data) {
        return !data || data.meta.code !== 200;
    },

    getCallResultCode: function(restCall, data) {
        return data ? data.meta.code : restCall.get_status_code();
    },

    getCallResultMessage: function(restCall, data) {
        return data ? data.meta.errorDetail : restCall.get_status_message();
    },

    _realPerformCheckIn: function(authorizer, checkIn, callback, cancellable) {
        let broadcast = checkIn.privacy;

        if (checkIn.broadcastFacebook)
            broadcast += ',facebook';

        if (checkIn.broadcastTwitter)
            broadcast += ',twitter';

        this.callAsync(authorizer,
                       'POST',
                       'checkins/add',
                       { 'shout': checkIn.message,
                         'venueId': checkIn.place.id,
                         'broadcast': broadcast },
                       callback,
                       cancellable);
    },

    _realFindPlaces: function(authorizer, latitude, longitude, distance, callback, cancellable) {
        this.callAsync(authorizer,
                       'GET',
                       'venues/search',
                       { 'll': latitude + ',' + longitude,
                         'radius': distance,
                         'intent': 'checkin' },
                       callback,
                       cancellable);
    },

    createPlaces: function(rawData) {
        return rawData.response.venues.map(function(place) {
            let link = _PLACE_LINK_FORMAT.format(place.id);

            return new SocialPlace.SocialPlace({ id: place.id,
                                                 name: place.name,
                                                 latitude: place.location.lat,
                                                 longitude: place.location.lng,
                                                 category: place.categories.length > 0 ?
                                                     place.categories[0].name :
                                                     null,
                                                 link: link,
                                                 originalData: place });
        });
    }
});
