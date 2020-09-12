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

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;

const Application = imports.application;
const ContactPlace = imports.contactPlace;
const OSMAccountDialog = imports.osmAccountDialog;
const OSMEditDialog = imports.osmEditDialog;
const OSMUtils = imports.osmUtils;
const Place = imports.place;
const PlaceFormatter = imports.placeFormatter;
const PlaceStore = imports.placeStore;
const SendToDialog = imports.sendToDialog;
const Utils = imports.utils;

var Button = {
    NONE: 0,
    ROUTE: 2,
    SEND_TO: 4,
    FAVORITE: 8,
    CHECK_IN: 16,
    EDIT_ON_OSM: 32,
};

var MapBubble = GObject.registerClass({ Abstract: true },
class MapBubble extends Gtk.Popover {

    _init(params) {
        this._place = params.place;
        delete params.place;

        this._mapView = params.mapView;
        params.relative_to = params.mapView;
        params.transitions_enabled = false;
        delete params.mapView;

        let buttonFlags = params.buttons || Button.NONE;
        delete params.buttons;

        let routeFrom = params.routeFrom;
        delete params.routeFrom;

        let checkInMatchPlace = params.checkInMatchPlace;
        if (checkInMatchPlace !== false)
            checkInMatchPlace = true;
        delete params.checkInMatchPlace;

        params.modal = false;

        super._init(params);
        let ui = Utils.getUIObject('map-bubble', [ 'bubble-main-box',
                                                   'bubble-spinner',
                                                   'bubble-thumbnail',
                                                   'thumbnail-separator',
                                                   'label-title',
                                                   'contact-avatar',
                                                   'address-label',
                                                   'bubble-main-stack',
                                                   'bubble-content-area',
                                                   'bubble-button-area',
                                                   'bubble-route-button',
                                                   'bubble-send-to-button',
                                                   'bubble-favorite-button',
                                                   'bubble-check-in-button',
                                                   'bubble-edit-button',
                                                   'bubble-favorite-button-image']);
        this._title = ui.labelTitle;
        this._thumbnail = ui.bubbleThumbnail;
        this._thumbnailSeparator = ui.thumbnailSeparator;
        this._content = ui.bubbleContentArea;
        this._mainStack = ui.bubbleMainStack;
        this._spinner = ui.bubbleSpinner;
        this._mainBox = ui.bubbleMainBox;
        this._contactAvatar = ui.contactAvatar;
        this._addressLabel = ui.addressLabel;

        if (!buttonFlags)
            ui.bubbleButtonArea.visible = false;
        else {
            if (buttonFlags & Button.ROUTE)
                this._initRouteButton(ui.bubbleRouteButton, routeFrom);
            if (buttonFlags & Button.SEND_TO)
                this._initSendToButton(ui.bubbleSendToButton);
            if (buttonFlags & Button.FAVORITE)
                this._initFavoriteButton(ui.bubbleFavoriteButton, ui.bubbleFavoriteButtonImage);
            if (buttonFlags & Button.CHECK_IN)
                this._initCheckInButton(ui.bubbleCheckInButton, checkInMatchPlace);
            if (buttonFlags & Button.EDIT_ON_OSM)
                this._initEditButton(ui.bubbleEditButton);
        }

        this.add(this._mainStack);

        /* Set up contact avatar */
        if (this.place instanceof ContactPlace.ContactPlace) {
            this._contactAvatar.visible = true;
            Utils.load_icon(this.place.icon, 32, (pixbuf) => {
                this._contactAvatar.set_image_load_func(this._avatarImageLoadFunc.bind(this, pixbuf));
            });
        }

        this.get_style_context().add_class("map-bubble");

        this.updatePlaceDetails();
    }

    get place() {
        return this._place;
    }

    get content() {
        return this._content;
    }

    get thumbnail() {
        return this._thumbnail.pixbuf;
    }

    set thumbnail(val) {
        if (val) {
            this._thumbnail.pixbuf = val;
            this._thumbnail.visible = true;
            this._thumbnailSeparator.visible = true;
        }
    }

    get loading() {
        return this._spinner.active;
    }
    set loading(val) {
        this._mainStack.set_visible_child(val ? this._spinner : this._mainBox);
        this._spinner.active = val;
    }

    updatePlaceDetails() {
        let place = this.place;
        let formatter = new PlaceFormatter.PlaceFormatter(place);

        let address = formatter.rows.map((row) => {
            row = row.map(function(prop) {
                return GLib.markup_escape_text(place[prop], -1);
            });
            return row.join(', ');
        });
        if (address.length > 0) {
            this._addressLabel.label = address.join('\n');
            this._addressLabel.show();
        } else {
            this._addressLabel.hide();
        }

        this._title.label = formatter.title;
        this._contactAvatar.text = formatter.title;
    }

    _initFavoriteButton(button, image) {
        let placeStore = Application.placeStore;
        button.visible = true;

        if (placeStore.exists(this._place,
                              PlaceStore.PlaceType.FAVORITE)) {
            image.icon_name = 'starred-symbolic';
        } else {
            image.icon_name = 'non-starred-symbolic';
        }

        button.connect('clicked', () => {
            if (placeStore.exists(this._place,
                                  PlaceStore.PlaceType.FAVORITE)) {
                image.icon_name = 'non-starred-symbolic';
                placeStore.removePlace(this._place,
                                       PlaceStore.PlaceType.FAVORITE);
            } else {
                image.icon_name = 'starred-symbolic';
                placeStore.addPlace(this._place,
                                    PlaceStore.PlaceType.FAVORITE);
            }
        });
    }

    _initSendToButton(button) {
        button.visible = true;
        button.connect('clicked', () => {
            let dialog = new SendToDialog.SendToDialog({ transient_for: this.get_toplevel(),
                                                         modal: true,
                                                         mapView: this._mapView,
                                                         place: this._place });
            dialog.connect('response', () => dialog.destroy());
            dialog.show();
        });
    }

    _initRouteButton(button, routeFrom) {
        let query = Application.routeQuery;
        let from = query.points[0];
        let to = query.points[query.points.length - 1];

        button.visible = true;

        button.connect('clicked', () => {
            query.freeze_notify();
            query.reset();
            Application.routingDelegator.reset();
            if (routeFrom) {
                from.place = this._place;
            } else {
                if (Application.geoclue.place)
                    from.place = Application.geoclue.place;
                to.place = this._place;
            }
            this.destroy();
            query.thaw_notify();
        });
    }

    _initCheckInButton(button, matchPlace) {
        Application.checkInManager.bind_property('hasCheckIn',
                                                 button, 'visible',
                                                 GObject.BindingFlags.DEFAULT |
                                                 GObject.BindingFlags.SYNC_CREATE);

        button.connect('clicked', () => {
            Application.checkInManager.showCheckInDialog(this.get_toplevel(),
                                                         this.place,
                                                         matchPlace);
        });
    }

    _initEditButton(button) {
        button.visible = true;
        button.connect('clicked', this._onEditClicked.bind(this));
    }

    _onEditClicked() {
        let osmEdit = Application.osmEdit;
        /* if the user is not alread signed in, show the account dialog */
        if (!osmEdit.isSignedIn) {
            let dialog = osmEdit.createAccountDialog(this.get_toplevel(), true);

            dialog.show();
            dialog.connect('response', (dialog, response) => {
                dialog.destroy();
                if (response === OSMAccountDialog.Response.SIGNED_IN)
                    this._edit();
            });

            return;
        }

        this._edit();
    }

    _edit() {
        let osmEdit = Application.osmEdit;
        let dialog = osmEdit.createEditDialog(this.get_toplevel(), this._place);

        dialog.show();
        dialog.connect('response', (dialog, response) => {
            dialog.destroy();

            switch (response) {
            case OSMEditDialog.Response.UPLOADED:
                // update place
                let object = osmEdit.object;
                OSMUtils.updatePlaceFromOSMObject(this._place, object);
                // refresh place view
                this._clearView();
                this._populate(this._place);
                break;
            default:
                break;
            }
        });
    }

    // Loads the HdyAvatar image for contact places
    _avatarImageLoadFunc(pixbuf, size) {
        let width = pixbuf.get_width();
        let height = pixbuf.get_height();
        let croppedThumbnail;

        if (width > height) {
            let x = (width - height) / 2;
            croppedThumbnail = pixbuf.new_subpixbuf(x, 0, height, height);
        } else {
            let y = (height - width) / 2;
            croppedThumbnail = pixbuf.new_subpixbuf(0, y, width, width);
        }

        return croppedThumbnail.scale_simple(size, size, GdkPixbuf.InterpType.BILINEAR);
    }
});
