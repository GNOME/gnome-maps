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
 * Author: Jonas Danielson <jonas@threetimestwo.org>
 */

import gettext from 'gettext';

import Gdk from 'gi://Gdk';
import GeocodeGlib from 'gi://GeocodeGlib';
import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import GWeather from 'gi://GWeather';

import {Application} from './application.js';
import {PlaceFormatter} from './placeFormatter.js';
import * as Utils from './utils.js';

const _ = gettext.gettext;

const _WEATHER_APPID = 'org.gnome.Weather';
const _CLOCKS_APPID = 'org.gnome.clocks';

const _NUM_VISIBLE = 4;

export class SendToDialog extends Gtk.Dialog {

    static Response = {
        SUCCESS: 0,
        CANCEL: 1
    };

    constructor({place, mapView, ...params}) {
        super({...params, use_header_bar: true});

        this._place = place;
        this._location = this._place.location;
        this._mapView = mapView;

        this._scrolledWindow.min_content_height = 40 * _NUM_VISIBLE;
        this.get_header_bar().subtitle = this._place.name;

        this._cancelButton.connect('clicked',
                                   () => this.response(SendToDialog.Response.CANCEL));

        this._list.connect('row-activated', (list, row) => this._activateRow(row));

        this._list.set_header_func((row, before) => {
            let horizontal = Gtk.Orientation.HORIZONTAL;

            if (before)
                row.set_header(new Gtk.Separator({ orientation: horizontal }));
            else
                row.set_header(null);
        });

        this.connect('show', () => {
            this._summaryLabel.label = this._getSummary();
            let osmuri = GLib.markup_escape_text(this._getOSMURI(), -1);
            this._summaryUrl.label = '<a href="%s">%s</a>'.format(osmuri, osmuri);

            this._copyButton.connect('clicked', () => this._copySummary());
            this._emailButton.connect('clicked', () => this._emailSummary());
        });

        if (GWeather) {
            let world = GWeather.Location.get_world();
            let location = this._location;
            this._city = world.find_nearest_city(location.latitude,
                                                 location.longitude);
            /* Translators: The first string is the name of the city, the
            second string is the name of the app to add it to */
            let label = _("Add %s to %s");

            let weatherInfo = GioUnix.DesktopAppInfo.new(_WEATHER_APPID + '.desktop');
            if (!weatherInfo) {
                this._list.remove(this._weatherRow);
            } else {
                this._weatherLabel.label = label.format(this._city.get_name(),
                                                        weatherInfo.get_name());
                this._weatherIcon.icon_name = weatherInfo.get_icon().to_string();
            }

            let clocksInfo = GioUnix.DesktopAppInfo.new(_CLOCKS_APPID + '.desktop');
            if (!clocksInfo) {
                this._list.remove(this._clocksRow);
            } else {
                this._clocksLabel.label = label.format(this._city.get_name(),
                                                       clocksInfo.get_name());
                this._clocksIcon.icon_name = clocksInfo.get_icon().to_string();
            }
        }

        /* Other apps that can launch geo: URIs */
        let contentType = Gio.content_type_from_mime_type('x-scheme-handler/geo');
        let thisId = Application.application.application_id + '.desktop';
        let apps = Gio.app_info_get_all_for_type(contentType);
        apps.forEach((app) => {
            if (app.get_id() == thisId)
                return;
            if (!app.should_show())
                return;

            this._list.insert(new OpenWithRow({ appinfo: app }), -1);
        });

        /* Hide the list box if it is empty */
        if (!this._list.get_first_child()) {
            this._scrolledWindow.hide();
        }
    }

    _getSummary(markup) {
        /* Gets a summary of the place (usually name, address, and coordinates,
        whichever are available). Does not include OSM URL. */

        let place = this._place;
        let lines = [];

        let formatter = new PlaceFormatter(place);

        /* don't show title for current location, and also not for raw
         * coordinate places, as that would show the coordinate twice
         */
        if (!place.isRawCoordinates)
            lines.push(formatter.title);

        let details = formatter.getDetailsString();
        if (details) {
            lines.push(details);
        }

        lines.push(place.coordinatesDescription);

        return lines.join('\n');
    }

    _getOSMURI() {
        let viewport = this._mapView.map.viewport;
        let place = this._place;

        let base = 'https://openstreetmap.org';
        if (this._place.osmId && this._place.osmType) {
            return '%s/%s/%s'.format(base,
                                     Utils.osmTypeToString(place.osmType),
                                     place.osmId);
        } else {
            return '%s?mlat=%f&mlon=%f&zoom=%d'.format(base,
                                                       this._location.latitude,
                                                       this._location.longitude,
                                                       viewport.zoom_level);
        }
    }

    _copySummary() {
        let summary = '%s\n%s'.format(this._getSummary(), this._getOSMURI());
        let clipboard = this.get_clipboard();

        clipboard.set(summary);
        this.response(SendToDialog.Response.SUCCESS);
    }

    _emailSummary() {
        let title = new PlaceFormatter(this._place).title;
        let summary = "%s\n%s".format(this._getSummary(), this._getOSMURI());
        let uri = 'mailto:?subject=%s&body=%s'.format(GLib.uri_escape_string(title, null, false),
                                                      GLib.uri_escape_string(summary, null, false));

        try {
          Gio.app_info_launch_default_for_uri(uri, this._getAppLaunchContext());
        } catch(e) {
          Utils.showToastInOverlay(_("Failed to open URI"), this._overlay);
          Utils.debug('failed to open URI: %s'.format(e.message));
        }

        this.response(SendToDialog.Response.SUCCESS);
    }

    _getAppLaunchContext() {
        let ctx = Gdk.Display.get_default().get_app_launch_context();

        // GdkAppLaunchContext uses second-precision timestamps
        ctx.set_timestamp(GLib.get_real_time() / 1000000);

        return ctx;
    }

    _activateRow(row) {
        if (row === this._weatherRow || row === this._clocksRow) {
            let timestamp = GLib.get_real_time() / 1000000;

            let action;
            let appId;
            if (row === this._weatherRow) {
                action = 'show-location';
                appId = _WEATHER_APPID;
            } else {
                action = 'add-location';
                appId = _CLOCKS_APPID;
            }

            Utils.activateAction(appId,
                                 action,
                                 new GLib.Variant('v', this._city.serialize()),
                                 timestamp);
        } else if (row instanceof OpenWithRow) {
            let uri = this._location.to_uri(GeocodeGlib.LocationURIScheme.GEO);
            row.appinfo.launch_uris([ uri ], this._getAppLaunchContext());
        }
        this.response(SendToDialog.Response.SUCCESS);
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/send-to-dialog.ui',
    InternalChildren: [ 'list',
                        'weatherRow',
                        'weatherLabel',
                        'weatherIcon',
                        'clocksRow',
                        'clocksLabel',
                        'clocksIcon',
                        'cancelButton',
                        'summaryLabel',
                        'summaryUrl',
                        'copyButton',
                        'emailButton',
                        'scrolledWindow',
                        'overlay']
}, SendToDialog);

export class OpenWithRow extends Gtk.ListBoxRow {
    constructor({ appinfo, ...params }) {
        super(params);

        this.appinfo = appinfo;
        this._label.label = _("Open with %s").format(appinfo.get_name());
        this._icon.gicon = appinfo.get_icon();
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/open-with-row.ui',
    InternalChildren: [ 'label',
                        'icon' ],
}, OpenWithRow);
