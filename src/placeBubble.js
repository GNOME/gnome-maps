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

const Gtk = imports.gi.Gtk;
const Format = imports.format;
const Lang = imports.lang;

const Application = imports.application;
const ContactPlace = imports.contactPlace;
const MapBubble = imports.mapBubble;
const OSMAccountDialog = imports.osmAccountDialog;
const OSMEditDialog = imports.osmEditDialog;
const OSMUtils = imports.osmUtils;
const Overpass = imports.overpass;
const Place = imports.place;
const PlaceFormatter = imports.placeFormatter;
const PlaceStore = imports.placeStore;
const Utils = imports.utils;

const PlaceBubble = new Lang.Class({
    Name: 'PlaceBubble',
    Extends: MapBubble.MapBubble,

    _init: function(params) {
        let ui = Utils.getUIObject('place-bubble', [ 'stack',
                                                     'box-content',
                                                     'grid-content',
                                                     'label-title',
                                                     'edit-button']);
        params.buttons = (MapBubble.Button.ROUTE |
                          MapBubble.Button.SEND_TO);

        if (params.place.store)
            params.buttons |= MapBubble.Button.FAVORITE;

        this.parent(params);

        Utils.load_icon(this.place.icon, 48, (function(pixbuf) {
            this.image.pixbuf = pixbuf;
        }).bind(this));

        this._stack = ui.stack;
        this._title = ui.labelTitle;
        this._boxContent = ui.boxContent;
        this._gridContent = ui.gridContent;
        this._editButton = ui.editButton;

        let overpass = new Overpass.Overpass();
        if (Application.placeStore.exists(this.place, null)) {

            // If the place is stale, update from Overpass.
            if (Application.placeStore.isStale(this.place)) {
                overpass.addInfo(this.place, (function(status, code) {
                    this._populate(this.place);
                    Application.placeStore.updatePlace(this.place);
                }).bind(this));
            } else {
                let place = Application.placeStore.get(this.place);
                this._populate(place);
            }
        } else if (this.place.store) {
            overpass.addInfo(this.place, (function(status, code) {
                this._populate(this.place);
                Application.placeStore.addPlace(this.place,
                                                PlaceStore.PlaceType.RECENT);
            }).bind(this));
        } else {
            this._populate(this.place);
        }
        this.content.add(this._stack);

        this._initEditButton(this._editButton);
    },

    _formatWikiLink: function(wiki) {
        let tokens = wiki.split(':');

        return Format.vprintf('https://%s.wikipedia.org/wiki/%s', [ tokens[0],
                                                                    tokens[1] ]);
    },

    _populate: function(place) {
        let infos = [];
        let formatter = new PlaceFormatter.PlaceFormatter(place);

        this._title.label = formatter.title;

        infos = formatter.rows.map(function(row) {
            row = row.map(function(prop) {
                switch (prop) {
                case 'postal_code':
                    return _("Postal code: %s").format(place[prop]);
                case 'country_code':
                    return _("Country code: %s").format(place[prop]);
                default:
                    return place[prop];
                }
            });
            return row.join(', ');
        });

        if (place.population)
            infos.push(_("Population: %s").format(place.population));

        if (place.openingHours)
            infos.push(_("Opening hours: %s").format(place.openingHoursTranslated));

        if (place.wiki) {
            let link = this._formatWikiLink(place.wiki);
            let href = Format.vprintf('<a href="%s">%s</a>',
                                      [link, _("Wikipedia")]);
            infos.push(href);
        }

        if (place.wheelchair) {
            infos.push(_("Wheelchair access: %s").format(place.wheelchairTranslated));
        }

        infos.forEach((function(info) {
            let label = new Gtk.Label({ label: info,
                                        visible: true,
                                        use_markup: true,
                                        halign: Gtk.Align.START });
            this._boxContent.pack_start(label, false, true, 0);
        }).bind(this));

        this._stack.visible_child = this._gridContent;
    },

    // clear the view widgets to be able to re-populate an updated place
    _clearView: function() {
        let widgets = this._boxContent.get_children();

        /* remove the dynamically added content, the title label
           has position 0 in the box */
        for (let i = 1; i < widgets.length; i++) {
            this._boxContent.remove(widgets[i]);
        }
    },

    _initEditButton: function(button) {
        button.visible = true;
        button.connect('clicked', this._onEditClicked.bind(this));
    },

    _onEditClicked: function() {
        /* if the user is not alread signed in, show the account dialog */
        if (!Application.osmEdit.isSignedIn) {
            let response =
                Application.osmEdit.showAccountDialog(this.get_toplevel(),
                                                      true);
            if (!response === OSMAccountDialog.Response.SIGNED_IN)
                return;
        }

        let response =
            Application.osmEdit.showEditDialog(this.get_toplevel(), this._place);

        switch (response) {
        case OSMEditDialog.Response.UPLOADED:
            // update place
            let object = Application.osmEdit.object;
            OSMUtils.updatePlaceFromOSMObject(this._place, object);
            // refresh place view
            this._clearView();
            this._populate(this._place);
            break;
        default:
            break;
        }
    }
});
