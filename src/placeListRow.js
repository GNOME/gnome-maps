/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
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
 * Author: Jonas Danielsson <jonas@threetimestwo.org>
 */

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {ContactPlace} from './contactPlace.js';
import {PlaceFormatter} from './placeFormatter.js';
import {PlaceStore} from './placeStore.js';
import * as Utils from './utils.js';

var ROW_HEIGHT = 55;

export class PlaceListRow extends Gtk.ListBoxRow {

    constructor(params) {
        let place = params.place;
        delete params.place;

        let searchString = params.searchString || '';
        delete params.searchString;

        let type = params.type;
        delete params.type;

        params.height_request = ROW_HEIGHT;
        super(params);
        this.update(place, type, searchString);
    }

    update(place, type, searchString) {
        this.place = place;
        let formatter = new PlaceFormatter(this.place);
        this.title = formatter.title;
        let markup = GLib.markup_escape_text(formatter.title, -1);

        this._name.label = this._boldMatch(markup, searchString);
        this._details.label = GLib.markup_escape_text(formatter.getDetailsString(),-1);

        if (place instanceof ContactPlace) {
            this._iconStack.set_visible_child(this._contactAvatar);

            this._contactAvatar.text = formatter.title;

            if (place.icon) {
                Utils.load_icon(place.icon, 32, (pixbuf) => {
                    this._contactAvatar.set_image_load_func((size) => Utils.loadAvatar(pixbuf, size));
                });
            } else {
                this._contactAvatar.set_image_load_func(null);
            }
        } else if (place.icon) {
            this._iconStack.set_visible_child(this._icon);
            this._icon.gicon = place.icon;
        }

        if (type === PlaceStore.PlaceType.RECENT ||
            type === PlaceStore.PlaceType.RECENT_ROUTE)
            this._typeIcon.icon_name = 'document-open-recent-symbolic';
        else if (type === PlaceStore.PlaceType.FAVORITE)
            this._typeIcon.icon_name = 'starred-symbolic';
        else if (type === PlaceStore.PlaceType.CONTACT)
            this._typeIcon.icon_name = 'avatar-default-symbolic';
        else
            this._typeIcon.icon_name = null;
    }

    _boldMatch(title, string) {
        let canonicalString = Utils.normalizeString(string).toLowerCase();
        let canonicalTitle = Utils.normalizeString(title).toLowerCase();

        let index = canonicalTitle.indexOf(canonicalString);

        if (index !== -1) {
            let substring = title.substring(index, index + string.length);
            title = title.replace(substring, substring.bold());
        }
        return title;
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/place-list-row.ui',
    InternalChildren: [ 'icon',
                        'iconStack',
                        'contactAvatar',
                        'name',
                        'details',
                        'typeIcon' ],
}, PlaceListRow);
