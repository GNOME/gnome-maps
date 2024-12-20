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

import gettext from 'gettext';

import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {Application} from './application.js';
import {PlaceEntry} from './placeEntry.js';
import {RouteQuery} from './routeQuery.js';

const _ = gettext.gettext;

export class RouteEntry extends Gtk.Grid {

    static Type = {
        FROM: 0,
        TO: 1,
        VIA: 2
    }

    constructor({type, point, mapView, ...params}) {
        super(params);

        this._type = type;
        this._point = point ?? null;
        this._mapView = mapView ?? null;
        this.entry = this._createEntry(type);
        this._entryGrid.attach(this.entry, 0, 0, 1, 1);

        // There is no GdkWindow on the widget until it is realized
        this.icon.connect('realize', (icon) => {
            icon.set_cursor(Gdk.Cursor.new_from_name('grab', null));
        });

        switch (this._type) {
        case RouteEntry.Type.FROM:
            let query = Application.routeQuery;
            this._button.icon_name = 'list-add-symbolic';
            this.icon.icon_name = 'maps-point-start-symbolic';
            /* Translators: this is add via location tooltip */
            this._button.tooltip_text = _("Add via location");
            this.entry.placeholder_text = _("From");
            query.connect('notify::points', () => {
                this._button.sensitive = query.points.length < RouteQuery.MAX_QUERY_POINTS;
            });

            break;
        case RouteEntry.Type.VIA:
            this._button.icon_name = 'list-remove-symbolic';
            this.icon.icon_name = 'maps-point-end-symbolic';
            /* Translators: this is remove via location tooltip */
            this._button.tooltip_text = _("Remove via location");
            this.entry.placeholder_text = _("Via")
            break;
        case RouteEntry.Type.TO:
            this._button.icon_name = 'route-reverse-symbolic';
            this.icon.icon_name = 'maps-point-end-symbolic';
            /* Translators: this is reverse route tooltip */
            this._button.tooltip_text = _("Reverse route");
            this.entry.placeholder_text = _("To");
            break;
        }
    }

    get button() {
        return this._button;
    }

    get point() {
        return this._point;
    }

    _createEntry() {
        const controllerKey = new Gtk.EventControllerKey();
        const entry = new PlaceEntry({ can_focus: true,
                                       hexpand: true,
                                       receives_default: true,
                                       mapView: this._mapView,
                                       maxChars: 15 });

        controllerKey.connect('key-pressed', (controller, kv, kc) =>
                                             this._onKeyPressed(entry, kv));
        entry.add_controller(controllerKey);

        if (this._point) {
            entry.bind_property('place',
                                this._point, 'place',
                                GObject.BindingFlags.BIDIRECTIONAL);
        }

        return entry;
    }

    _onKeyPressed(entry, keyval) {
        /* Hide the sidebar when escape is pressed, unless the search result
         * popover is already shown. In that case let the default keyhandler
         * of the entry handle the event.
         */
        if (!entry.popover.visible && keyval === Gdk.KEY_Escape) {
            const action =
                Application.application.mainWindow.lookup_action('toggle-sidebar');

            action.activate(null);

            return true;
        }

        return false;
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/route-entry.ui',
    Children: [ 'icon' ],
    InternalChildren: [ 'entryGrid',
                        'button' ]
}, RouteEntry);
