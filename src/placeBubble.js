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

const Geocode = imports.gi.GeocodeGlib;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Format = imports.format;

const Application = imports.application;
const ContactPlace = imports.contactPlace;
const MapBubble = imports.mapBubble;
const Overpass = imports.overpass;
const Place = imports.place;
const PlaceBubbleImage = imports.placeBubbleImage;
const PlaceStore = imports.placeStore;
const Translations = imports.translations;
const Utils = imports.utils;
const Wikipedia = imports.wikipedia;

// maximum dimension of thumbnails to fetch from Wikipedia
const THUMBNAIL_FETCH_SIZE = 360;

var PlaceBubble = GObject.registerClass({
    Properties: {
        'overpass-place': GObject.ParamSpec.object('overpass-place',
                                                   'Overpass Place',
                                                   'The place as filled in by Overpass',
                                                   GObject.ParamFlags.READABLE |
                                                   GObject.ParamFlags.WRITABLE,
                                                   Geocode.Place)
    }
}, class PlaceBubble extends MapBubble.MapBubble {

    _init(params) {
        params.buttons = (MapBubble.Button.ROUTE |
                          MapBubble.Button.SEND_TO);

        if (params.place.store)
            params.buttons |= MapBubble.Button.FAVORITE;

        if (!(params.place instanceof ContactPlace.ContactPlace) && params.place.osm_id)
            params.buttons |= MapBubble.Button.EDIT_ON_OSM;

        super._init(params);

        this.loading = true;

        this._placeDetails = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL,
                                           visible: true});
        this.content.add(this._placeDetails);

        let overpass = new Overpass.Overpass();

        /* use a property binding from the Overpass instance to avoid
         * accessing accessing this object after the underlying GObject has
         * been finalized */
        overpass.bind_property('place', this, 'overpass-place',
                               GObject.BindingFlags.DEFAULT);
        this.connect('notify::overpass-place', () => this._onInfoAdded());

        if (Application.placeStore.exists(this.place, null)) {

            // If the place is stale, update from Overpass.
            if (Application.placeStore.isStale(this.place)) {
                overpass.addInfo(this.place);
            } else {
                let place = Application.placeStore.get(this.place);
                this._populate(place);
            }
        } else if (this.place.store && !this.place.prefilled) {
            overpass.addInfo(this.place);
        } else {
            this._populate(this.place);
        }
    }

    _onInfoAdded() {
        this._populate(this.place);
        if (Application.placeStore.exists(this.place, null))
            Application.placeStore.updatePlace(this.place);
        else
            Application.placeStore.addPlace(this.place, PlaceStore.PlaceType.RECENT);
    }

    _formatWikiLink(wiki) {
        let lang = Wikipedia.getLanguage(wiki);
        let article = Wikipedia.getArticle(wiki);

        return Format.vprintf('https://%s.wikipedia.org/wiki/%s', [ lang, article ]);
    }

    _createContent(place) {
        let content = [];

        if (place.website) {
            content.push({ label: _("Website"),
                           icon: 'web-browser-symbolic',
                           info: GLib.markup_escape_text(place.website, -1),
                           linkUrl: place.website });
        }

        if (place.phone) {
            let phone = { label: _("Phone number"),
                          icon: 'phone-oldschool-symbolic',
                          info: GLib.markup_escape_text(place.phone, -1) };

            if (Utils.uriSchemeSupported('tel')) {
                phone.linkUrl = 'tel:%s'.format(place.phone);
            }

            content.push(phone);
        }

        if (place.openingHours) {
            content.push({ label: _("Opening hours"),
                           icon: 'emoji-recent-symbolic',
                           info: Translations.translateOpeningHours(place.openingHours) });
        }

        switch(place.internetAccess) {
            case 'yes':
                /* Translators:
                 * There is public internet access but the particular kind is unknown.
                 */
                content.push({ info: _("Public internet access"),
                               icon: 'network-wireless-signal-excellent-symbolic' });
                break;

            case 'no':
                /* Translators:
                 * no internet access is offered in a place where
                 * someone might expect it.
                 */
                content.push({ info: _("No internet access"),
                               icon: 'network-wireless-offline-symbolic' });
                break;

            case 'wlan':
                /* Translators:
                 * This means a WLAN Hotspot, also known as wireless, wifi or Wi-Fi.
                 */
                content.push({ info: _("Public Wi-Fi"),
                               icon: 'network-wireless-signal-excellent-symbolic' });
                break;

            case 'wired':
                /* Translators:
                 * This means a a place where you can plug in your laptop with ethernet.
                 */
                content.push({ info: _("Wired internet access"),
                               icon: 'network-wired-symbolic' });
                break;

            case 'terminal':
                /* Translators:
                 * Like internet cafe or library where the computer is given.
                 */
                content.push({ info: _("Computers available for use"),
                               icon: 'computer-symbolic' });
                break;

            case 'service':
                /* Translators:
                 * This means there is personnel which helps you in case of problems.
                 */
                content.push({ info: _("Internet assistance available"),
                               icon: 'computer-symbolic' });
                break;
        }

        if (place.toilets === 'no') {
            content.push({ info: _("No toilets available"),
                           icon: 'no-toilets-symbolic' });
        } else if (place.toilets === 'yes') {
            content.push({ info: _("Toilets available"),
                           icon: 'toilets-symbolic' });
        }

        switch(place.wheelchair) {
            case 'yes':
                /* Translators:
                 * This means wheelchairs have full unrestricted access.
                 */
                content.push({ info: _("Wheelchair accessible"),
                               icon: 'wheelchair-symbolic' });
                break;

            case 'limited':
                /* Translators:
                 * This means wheelchairs have partial access (e.g some areas
                 * can be accessed and others not, areas requiring assistance
                 * by someone pushing up a steep gradient).
                 */
                content.push({ info: _("Limited wheelchair accessibility"),
                               icon: 'wheelchair-limited-symbolic'  });
                break;

            case 'no':
                /* Translators:
                 * This means wheelchairs have no unrestricted access
                 * (e.g. stair only access).
                 */
                content.push({ info: _("Not wheelchair accessible"),
                               icon: 'no-wheelchair-symbolic'  });
                break;

            case 'designated':
                /* Translators:
                 * This means that the way or area is designated or purpose built
                 * for wheelchairs (e.g. elevators designed for wheelchair access
                 * only). This is rarely used.
                 */
                content.push({ info: _("Designated for wheelchair users"),
                               icon: 'wheelchair-symbolic'  });
                break;
        }

        if (place.population) {
            /* TODO: this is a bit of a work-around to re-interpret the population,
             * stored as a string into an integer to convert back to a locale-
             * formatted string. Ideally it should be kept as an integer value
             * in the Place class. But this will also need to be handled by the
             * PlaceStore, possible in a backwards-compatible way
             */
            content.push({ label: _("Population"),
                           icon: 'system-users-symbolic',
                           info: parseInt(place.population).toLocaleString() });
        }

        /* The default value for a place's altitude is -G_MAXDOUBLE, so we can
         * compare to an impossibly low altitude to see if one is set */
        if (place.location.altitude > -1000000000.0) {
            let alt  = place.location.altitude;
            content.push({ label: _("Altitude"),
                           icon: 'mountain-symbolic',
                           info: Utils.prettyDistance(alt, true) });
        }

        if (place.religion) {
            content.push({ label: _("Religion:"),
                           info: Translations.translateReligion(place.religion) });
        }

        if (place.wiki) {
            content.push({ type: 'wikipedia', info: '' });
        }

        return content;
    }

    _attachContent(content) {
        content.forEach(({ type, label, icon, linkUrl, info }) => {
            let separator = new Gtk.Separator({ visible: true });
            separator.get_style_context().add_class('no-margin-separator');
            this._placeDetails.add(separator);

            let box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL,
                                    visible: true,
                                    marginStart: 18,
                                    marginEnd: 18,
                                    marginTop: 6,
                                    marginBottom: 6,
                                    spacing: 12 });

            if (icon) {
                let widget = new Gtk.Image({ icon_name: icon,
                                             visible: true,
                                             xalign: 1,
                                             valign: Gtk.Align.START,
                                             halign: Gtk.Align.END });

                if (label) {
                    widget.tooltip_markup = label;
                }

                box.add(widget);
            } else if (label) {
                let widget = new Gtk.Label({ label: label.italics(),
                                             visible: true,
                                             use_markup: true,
                                             yalign: 0,
                                             halign: Gtk.Align.END });
                box.add(widget);
            }

            if (linkUrl) {
                let uri = GLib.markup_escape_text(linkUrl, -1);
                /* double-escape the tooltip text, as GTK treats it as markup */
                let tooltipText = GLib.markup_escape_text(uri, -1);
                info = '<a href="%s" title="%s">%s</a>'.format(uri,
                                                               tooltipText,
                                                               info);
            }

            let widget = new Gtk.Label({ label: info,
                                         visible: true,
                                         use_markup: true,
                                         max_width_chars: 30,
                                         wrap: true,
                                         xalign: 0,
                                         hexpand: true,
                                         halign: Gtk.Align.FILL });

            if (type === 'wikipedia') {
                box.marginTop = 14;
                box.marginBottom = 18;
                this._wikipediaLabel = widget;
            }

            box.add(widget);
            this._placeDetails.add(box);
        });
    }

    _populate(place) {
        // refresh place view
        this._clearView();

        let content = this._createContent(place);
        this._attachContent(content);

        if (place.wiki) {
            this._requestWikipedia(place.wiki);
        }

        this.updatePlaceDetails();
        this.loading = false;
    }

    _requestWikipedia(wiki) {
        Wikipedia.fetchArticleInfo(wiki,
                                   THUMBNAIL_FETCH_SIZE,
                                   this._onWikiMetadataComplete.bind(this),
                                   this._onThumbnailComplete.bind(this));
    }

    _onThumbnailComplete(thumbnail) {
        this.thumbnail = thumbnail;
    }

    _onWikiMetadataComplete(wiki, metadata) {
        if (metadata.extract) {
            let text = GLib.markup_escape_text(metadata.extract, -1);
            let link = this._formatWikiLink(wiki);

            /* If the text goes past some number of characters (see
             * wikipedia.js), it is ellipsized with '...'
             * GNOME HIG says to use U+2026 HORIZONTAL ELLIPSIS instead.
             * Also, trim whitespace. */
            text = text.replace(/\s*\.\.\.\s*$/, '…');

            let uri = GLib.markup_escape_text(link, -1);
            /* double-escape the tooltip text, as GTK treats it as markup */
            let tooltipText = GLib.markup_escape_text(uri, -1);

            /* Translators: This is the text for the "Wikipedia" link at the end
               of summaries */
            this._wikipediaLabel.label = `${text} <a href="${link}" title="${tooltipText}">${ _("Wikipedia") }</a>`;
        }
    }

    // clear the view widgets to be able to re-populate an updated place
    _clearView() {
        this._placeDetails.get_children().forEach((child) => child.destroy());
    }
});
