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
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const GWeather = imports.gi.GWeather;
const Soup = imports.gi.Soup;

const PlaceFormatter = imports.placeFormatter;
const Utils = imports.utils;

const _WEATHER_APPID = 'org.gnome.Weather.Application';
const _CLOCKS_APPID = 'org.gnome.clocks';

var Response = {
    SUCCESS: 0,
    CANCEL: 1
};

const _NUM_VISIBLE = 6;

var SendToDialog = GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/send-to-dialog.ui',
    InternalChildren: [ 'list',
                        'weatherRow',
                        'weatherLabel',
                        'weatherIcon',
                        'clocksRow',
                        'clocksLabel',
                        'clocksIcon',
                        'headerBar',
                        'cancelButton',
                        'chooseButton',
                        'summaryLabel',
                        'summaryUrl',
                        'copyButton',
                        'emailButton',
                        'scrolledWindow' ]
}, class SendToDialog extends Gtk.Dialog {

    _init(params) {
        this._place = params.place;
        delete params.place;

        this._mapView = params.mapView;
        delete params.mapView;

        params.use_header_bar = true;
        super._init(params);

        this._scrolledWindow.min_content_height = 40 * _NUM_VISIBLE;
        this._headerBar.subtitle = this._place.name;

        this._cancelButton.connect('clicked',
                                   () => this.response(Response.CANCEL));

        this._chooseButton.connect('clicked', () => {
            let row = this._list.get_selected_row();
            this._activateRow(row);
        });

        this._list.connect('row-activated', (list, row) => this._activateRow(row));

        this._list.set_header_func((row, before) => {
            let horizontal = Gtk.Orientation.HORIZONTAL;

            if (before)
                row.set_header(new Gtk.Separator({ orientation: horizontal }));
            else
                row.set_header(null);
        });

        this._summaryLabel.label = this._getSummary();
        let osmuri = GLib.markup_escape_text(this._getOSMURI(), -1);
        this._summaryUrl.label = "<a href='%s'>%s</a>".format(osmuri, osmuri);

        this._copyButton.connect('clicked', () => this._copySummary());
        this._emailButton.connect('clicked', () => this._emailSummary());
    }

    ensureApplications() {
        let weatherInfo = Gio.DesktopAppInfo.new(_WEATHER_APPID + '.desktop');
        let clocksInfo = Gio.DesktopAppInfo.new(_CLOCKS_APPID + '.desktop');
        let appWeather = this._checkWeather(weatherInfo);
        let appClocks = this._checkClocks(clocksInfo);

        if (!appWeather) {
            this._weatherRow.hide();
        } else {
            this._weatherLabel.label = weatherInfo.get_name();
            this._weatherIcon.icon_name = weatherInfo.get_icon().to_string();
        }

        if (!appClocks) {
            this._clocksRow.hide();
        } else {
            this._clocksLabel.label = clocksInfo.get_name();
            this._clocksIcon.icon_name = clocksInfo.get_icon().to_string();
        }

        return appWeather || appClocks;
    }

    _getSummary(markup) {
        /* Gets a summary of the place (usually name, address, and coordinates,
        whichever are available). Does not include OSM URL. */

        let place = this._place;
        let lines = [];

        let formatter = new PlaceFormatter.PlaceFormatter(place);

        lines.push(formatter.title);

        let details = formatter.getDetailsString();
        if (details) {
            lines.push(details);
        }

        lines.push('%f, %f'.format(place.location.latitude,
                                   place.location.longitude));

        return lines.join("\n");
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
                                                       place.location.latitude,
                                                       place.location.longitude,
                                                       view.zoom_level);
        }
    }

    _copySummary() {
        let summary = "%s\n%s".format(this._getSummary(), this._getOSMURI());

        let display = Gdk.Display.get_default();
        let clipboard = Gtk.Clipboard.get_default(display);
        clipboard.set_text(summary, -1);
        this.response(Response.SUCCESS);
    }
    _emailSummary() {
        let title = new PlaceFormatter.PlaceFormatter(this._place).title;
        let summary = "%s\n%s".format(this._getSummary(), this._getOSMURI());
        let uri = "mailto:?subject=%s&body=%s".format(Soup.URI.encode(title, null),
                                                      Soup.URI.encode(summary, null));

        try {
          let timestamp = Gtk.get_current_event_time();
          let display = Gdk.Display.get_default();
          let ctx = Gdk.Display.get_default().get_app_launch_context();
          let screen = display.get_default_screen();

          ctx.set_timestamp(timestamp);
          ctx.set_screen(screen);
          Gio.app_info_launch_default_for_uri(uri, ctx);
        } catch(e) {
          Utils.showDialog(_("Failed to open URI"), Gtk.MessageType.ERROR,
                           this.get_toplevel());
          Utils.debug('failed to open URI: %s'.format(e.message));
        }

        this.response(Response.SUCCESS);
    }

    _activateRow(row) {
        if (row === this._weatherRow || row === this._clocksRow) {
            let timestamp = Gtk.get_current_event_time();
            let location = this._place.location;
            let city = GWeather.Location.new_detached(this._place.name,
                                                      null,
                                                      location.latitude,
                                                      location.longitude);
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
                                 new GLib.Variant('v', city.serialize()),
                                 timestamp);
        }
        this.response(Response.SUCCESS);
    }

    _checkWeather(appInfo) {
        return (GWeather !== null && appInfo !== null);
    }

    _checkClocks(appInfo) {
        return (GWeather !== null && appInfo !== null);
    }
});
