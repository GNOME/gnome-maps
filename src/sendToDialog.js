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

const Gdk = imports.gi.Gdk;
const Geocode = imports.gi.GeocodeGlib;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const GWeather = imports.gi.GWeather;
const Soup = imports.gi.Soup;

const Application = imports.application;
const PlaceFormatter = imports.placeFormatter;
const Utils = imports.utils;

const _WEATHER_APPID = 'org.gnome.Weather';
const _CLOCKS_APPID = 'org.gnome.clocks';

var Response = {
    SUCCESS: 0,
    CANCEL: 1
};

const _NUM_VISIBLE = 4;

var SendToDialog = GObject.registerClass({
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
                        'scrolledWindow' ]
}, class SendToDialog extends Gtk.Dialog {

    _init(params) {
        this._place = params.place;
        this._location = this._place.location;
        delete params.place;

        this._mapView = params.mapView;
        delete params.mapView;

        params.use_header_bar = true;
        super._init(params);

        this._scrolledWindow.min_content_height = 40 * _NUM_VISIBLE;
        this.get_header_bar().subtitle = this._place.name;

        this._cancelButton.connect('clicked',
                                   () => this.response(Response.CANCEL));

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

            let weatherInfo = Gio.DesktopAppInfo.new(_WEATHER_APPID + '.desktop');
            if (!weatherInfo) {
                this._list.remove(this._weatherRow);
            } else {
                this._weatherLabel.label = label.format(this._city.get_name(),
                                                        weatherInfo.get_name());
                this._weatherIcon.icon_name = weatherInfo.get_icon().to_string();
            }

            let clocksInfo = Gio.DesktopAppInfo.new(_CLOCKS_APPID + '.desktop');
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
        if (this._list.get_children().length == 0) {
            this._scrolledWindow.hide();
        }
    }

    _getSummary(markup) {
        /* Gets a summary of the place (usually name, address, and coordinates,
        whichever are available). Does not include OSM URL. */

        let place = this._place;
        let lines = [];

        let formatter = new PlaceFormatter.PlaceFormatter(place);

        if (!place.isCurrentLocation)
            lines.push(formatter.title);

        let details = formatter.getDetailsString();
        if (details) {
            lines.push(details);
        }

        lines.push('%f, %f'.format(this._location.latitude.toFixed(5),
                                   this._location.longitude.toFixed(5)));

        return lines.join('\n');
    }

    _getOSMURI() {
        let view = this._mapView.view;
        let place = this._place;

        let base = 'https://openstreetmap.org';
        if (this._place.osm_id && this._place.osm_type) {
            return '%s/%s/%s'.format(base,
                                     Utils.osmTypeToString(place.osm_type),
                                     place.osm_id);
        } else {
            return '%s?mlat=%f&mlon=%f&zoom=%d'.format(base,
                                                       this._location.latitude,
                                                       this._location.longitude,
                                                       view.zoom_level);
        }
    }

    _copySummary() {
        let summary = '%s\n%s'.format(this._getSummary(), this._getOSMURI());

        let display = Gdk.Display.get_default();
        let clipboard = Gtk.Clipboard.get_default(display);
        clipboard.set_text(summary, -1);
        this.response(Response.SUCCESS);
    }

    _emailSummary() {
        let title = new PlaceFormatter.PlaceFormatter(this._place).title;
        let summary = "%s\n%s".format(this._getSummary(), this._getOSMURI());
        let uri = 'mailto:?subject=%s&body=%s'.format(Soup.URI.encode(title, null),
                                                      Soup.URI.encode(summary, null));

        try {
          Gio.app_info_launch_default_for_uri(uri, this._getAppLaunchContext());
        } catch(e) {
          Utils.showDialog(_("Failed to open URI"), Gtk.MessageType.ERROR,
                           this.get_toplevel());
          Utils.debug('failed to open URI: %s'.format(e.message));
        }

        this.response(Response.SUCCESS);
    }

    _getAppLaunchContext() {
        let timestamp = Gtk.get_current_event_time();
        let display = Gdk.Display.get_default();
        let ctx = Gdk.Display.get_default().get_app_launch_context();
        let screen = display.get_default_screen();

        ctx.set_timestamp(timestamp);
        ctx.set_screen(screen);

        return ctx;
    }

    _activateRow(row) {
        if (row === this._weatherRow || row === this._clocksRow) {
            let timestamp = Gtk.get_current_event_time();

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
            let uri = this._location.to_uri(Geocode.LocationURIScheme.GEO);
            row.appinfo.launch_uris([ uri ], this._getAppLaunchContext());
        }
        this.response(Response.SUCCESS);
    }
});

var OpenWithRow = GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/open-with-row.ui',
    InternalChildren: [ 'label',
                        'icon' ],
}, class OpenWithRow extends Gtk.ListBoxRow {
    _init(params) {
        this.appinfo = params.appinfo;
        delete params.appinfo;

        super._init(params);

        this._label.label = _("Open with %s").format(this.appinfo.get_name());
        this._icon.gicon = this.appinfo.get_icon();
    }
});
