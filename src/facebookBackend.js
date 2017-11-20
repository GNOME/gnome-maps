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
const GObject = imports.gi.GObject;

const ServiceBackend = imports.serviceBackend;
const SocialPlace = imports.socialPlace;

const _PLACE_LINK_FORMAT = 'https://www.facebook.com/%s';

var FacebookBackend = GObject.registerClass(
class FacebookBackend extends ServiceBackend.ServiceBackend {
    get name() {
        return 'facebook';
    }

    createRestCall(authorizer) {
        return GFBGraph.new_rest_call(authorizer);
    }

    refreshAuthorization(authorizer, cancellable) {
        return authorizer.refresh_authorization(cancellable);
    }

    getAuthorizerAccount(authorizer) {
        return authorizer.goa_object;
    }

    createAuthorizer(account) {
        return new GFBGraph.GoaAuthorizer({ goa_object: account });
    }

    isTokenInvalid(restCall, data) {
        return data.error &&
               (data.error.code === 2500 || data.error.code === 104 || data.error.code === 190);
    }

    isInvalidCall(restCall, data) {
        if (!data) {
            return true;
        } else if (data.error) {
            return true;
        } else {
            return false;
        }
    }

    getCallResultCode(restCall, data) {
        return data ?
            (data.error ? data.error.code : null) :
            restCall.get_status_code();
    }

    getCallResultMessage(restCall, data) {
        return data ?
            (data.error ? data.error.message : null) :
            restCall.get_status_message();
    }

    _realPerformCheckIn(authorizer, checkIn, callback, cancellable) {
        this.callAsync(authorizer,
                       'POST',
                       'me/feed',
                       {
                           'message': checkIn.message,
                           'place': checkIn.place.id,
                           'privacy_value': checkIn.privacy
                       },
                       callback,
                       cancellable);
    }

    _realFindPlaces(authorizer, latitude, longitude, distance, callback, cancellable) {
        this.callAsync(authorizer,
                       'GET',
                       'search',
                       {
                           'type': 'place',
                           'center': latitude + ',' + longitude,
                           'distance': distance
                       },
                       callback,
                       cancellable);
    }

    createPlaces(rawData) {
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
