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
const Pango = imports.gi.Pango;

const Format = imports.format;

const Application = imports.application;
const ContactPlace = imports.contactPlace;
const Overpass = imports.overpass;
const Place = imports.place;
const PlaceIcons = imports.placeIcons;
const PlaceViewImage = imports.placeViewImage;
const PlaceButtons = imports.placeButtons;
const PlaceFormatter = imports.placeFormatter;
const PlaceStore = imports.placeStore;
const Translations = imports.translations;
const Utils = imports.utils;
const Wikipedia = imports.wikipedia;

// maximum dimension of thumbnails to fetch from Wikipedia
const THUMBNAIL_FETCH_SIZE = 360;

// Unicode left-to-right marker
const LRM = '\u200E';

var PlaceView = GObject.registerClass({
    Properties: {
        'overpass-place': GObject.ParamSpec.object('overpass-place',
                                                   'Overpass Place',
                                                   'The place as filled in by Overpass',
                                                   GObject.ParamFlags.READABLE |
                                                   GObject.ParamFlags.WRITABLE,
                                                   Geocode.Place)
    }
}, class PlaceView extends Gtk.Box {

    _init(params) {
        this._place = params.place;
        delete params.place;

        let mapView = params.mapView;
        delete params.mapView;

        /* This mode is used in PlaceBar for inline current location details.
           It hides the title box and decreases the start margin on the rows. */
        this._inlineMode = !!params.inlineMode;
        delete params.inlineMode;

        super._init(params);

        let ui = Utils.getUIObject('place-view', [ 'bubble-main-box',
                                                   'bubble-spinner',
                                                   'bubble-thumbnail',
                                                   'thumbnail-separator',
                                                   'label-title',
                                                   'native-name',
                                                   'contact-avatar',
                                                   'address-label',
                                                   'bubble-main-stack',
                                                   'bubble-content-area',
                                                   'place-buttons',
                                                   'send-to-button-alt',
                                                   'title-box' ]);
        this._title = ui.labelTitle;
        this._nativeName = ui.nativeName;
        this._thumbnail = ui.bubbleThumbnail;
        this._thumbnailSeparator = ui.thumbnailSeparator;
        this._content = ui.bubbleContentArea;
        this._mainStack = ui.bubbleMainStack;
        this._spinner = ui.bubbleSpinner;
        this._mainBox = ui.bubbleMainBox;
        this._contactAvatar = ui.contactAvatar;
        this._addressLabel = ui.addressLabel;

        this.add(this._mainStack);

        let placeButtons = new PlaceButtons.PlaceButtons({ place: this._place,
                                                           mapView: mapView });
        placeButtons.connect('place-edited', this._onPlaceEdited.bind(this));
        ui.placeButtons.add(placeButtons);

        if (this.place.isCurrentLocation) {
            /* Current Location bubbles have a slightly different layout, to
               avoid awkward whitespace */

            /* hide the normal button area */
            ui.placeButtons.visible = false;

            /* show the top-end-corner share button instead */
            ui.sendToButtonAlt.visible = true;
            placeButtons.initSendToButton(ui.sendToButtonAlt);

            /* adjust some margins */
            ui.titleBox.margin = 12;
            ui.titleBox.marginStart = 18;
            ui.titleBox.spacing = 18;
        }

        /* Set up contact avatar */
        if (this.place instanceof ContactPlace.ContactPlace) {
            this._contactAvatar.visible = true;
            Utils.load_icon(this.place.icon, 32, (pixbuf) => {
                this._contactAvatar.set_image_load_func((size) => Utils.loadAvatar(pixbuf, size));
            });
        }

        this.loading = true;

        this._placeDetails = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL,
                                           visible: true,
                                           hexpand: true });
        this.content.attach(this._placeDetails, 0, 0, 1, 1);

        if (this.place.isCurrentLocation) {
            this._populate(this.place);
        } else {
            let overpass = new Overpass.Overpass();

            /* use a property binding from the Overpass instance to avoid
             * accessing this object after the underlying GObject has
             * been finalized */
            overpass.bind_property('place', this, 'overpass-place',
                                   GObject.BindingFlags.DEFAULT);
            this.connect('notify::overpass-place', () => this._onInfoAdded());

            if (Application.placeStore.exists(this.place, null)) {

                // If the place is stale, update from Overpass.
                if (Application.placeStore.isStale(this.place)) {
                    overpass.addInfo(this.place);
                } else {
                    this._place = Application.placeStore.get(this.place);
                    this._populate(this.place);
                }
            } else if (this.place.store && !this.place.prefilled) {
                overpass.addInfo(this.place);
            } else {
                this._populate(this.place);
            }
        }

        if (this._inlineMode) {
            ui.titleBox.hide();
        }

        this.updatePlaceDetails();

        this._place.connect('notify::location', () => this._updateLocation());
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

        /* hide native name by default, so that it is only shown when it
         * should, in case it changed when re-applying changes from Overpass.
         * This could happen if the locale changed since last run.
         */
        this._nativeName.visible = false;

        /* show native name unless it's equal to the localized name, or
         * if the localized name is a substring of the native name, as can
         * be the case in e.g. duo-lingual native names, such as is used in
         * Brussels of the form "French name - Dutch name"
         */
        if (place.nativeName && !place.nativeName.includes(place.name)) {
            this._nativeName.label = place.nativeName;

            /* only show native name if there's installed fonts capable of
             * showing it
             */
            if (this._nativeName.get_layout().get_unknown_glyphs_count() === 0)
                this._nativeName.visible = true;
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

        if (place.isCurrentLocation) {
            let coordinates = place.location.latitude.toFixed(5)
                              + ', '
                              + place.location.longitude.toFixed(5);
            let accuracyDescription = Utils.getAccuracyDescription(this.place.location.accuracy);

            content.push({ label: _("Coordinates"),
                           icon: 'map-marker-symbolic',
                           info: coordinates });

            content.push({ label: _("Accuracy"),
                           icon: 'find-location-symbolic',
                           /* Translators: %s can be "Unknown", "Exact" or "%f km" (or ft/mi/m) */
                           info: _("Accuracy: %s").format(accuracyDescription) });
        }

        if (place.website) {
            if (Utils.isValidWebsite(place.website)) {
                content.push({ label: _("Website"),
                               icon: 'web-browser-symbolic',
                               info: GLib.markup_escape_text(place.website, -1),
                               linkUrl: place.website });
            }
        }

        if (place.phone) {
            /* since the phone numbers are typically always rendered
             * left-to-right, insert an explicit LRM char to avoid issues
             * with phone numbers in international format starting with a +
             * which is considered a "weak" character to determine Unicode
             * text direction
             */
            let phone = { label: _("Phone number"),
                          icon: 'phone-oldschool-symbolic',
                          info: LRM + GLib.markup_escape_text(place.phone, -1) };

            if (Utils.uriSchemeSupported('tel')) {
                /* RFC3966 only allows "-", '.", "(", and ")" as visual
                 * separator characters in a global phone number, no space */
                phone.linkUrl = 'tel:%s'.format(place.phone.replace(/\s+/g, ''));
            }

            content.push(phone);
        }

        if (place.email && Utils.isValidEmail(place.email)) {
            content.push({ label: _("E-mail"),
                           icon: 'mail-unread-symbolic',
                           info: GLib.markup_escape_text(place.email, -1),
                           linkUrl: 'mailto:%s'.format(place.email) });
        }

        if (place.isEatingAndDrinking) {
            switch (place.takeaway) {
                case 'yes':
                    /* Translators:
                     * The establishment offers customers to purchase meals
                     * (or similar) to be consumed elsewhere
                     */
                    content.push({ info: _("Offers takeaway"),
                                   icon: PlaceIcons.getIconForPlace(place) });
                    break;
                case 'no':
                    /* Translators:
                     * The establishment only offers customers to purchase
                     * meals (or similar) to be consumed on-premise.
                     */
                    content.push({ info: _("Does not offer takeaway"),
                                   icon: PlaceIcons.getIconForPlace(place) });
                    break;
                case 'only':
                    /* Translators:
                     * The establishment only offers customers to purchase
                     * meals (or similar) to be consumed elsewhere. E.g.
                     * there is no seating on-premise for eating/drinking
                     */
                    content.push({ info: _("Only offers takeaway"),
                                   icon: PlaceIcons.getIconForPlace(place) });
                    break;
            }
        }

        if (place.openingHours) {
            content.push({ label: _("Opening hours"),
                           icon: 'emoji-recent-symbolic',
                           grid: Translations.translateOpeningHours(place.openingHours) });
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
                           info: Utils.prettyPopulation(parseInt(place.population)) });
        }

        /* The default value for a place's altitude is -G_MAXDOUBLE, so we can
         * compare to an impossibly low altitude to see if one is set */
        if (place.location.altitude > -1000000000.0) {
            let alt  = place.location.altitude;
            let info;

            if (alt > 0) {
                info = Utils.prettyDistance(alt, true);
            } else if (alt < 0) {
                /**
                 * Translators: this is a label indicating an altitude below
                 * sea level, where the %s placeholder is the altitude relative
                 * to mean sea level in the "negative direction"
                 */
                info = _("%s below sea level").
                            format(Utils.prettyDistance(-alt, true));
            } else {
                /**
                 * Translators: this indicates a place is located at (or very
                 * close to) mean sea level
                 */
                info = _("At sea level");
            }

            content.push({ label: _("Altitude"),
                           icon: 'mountain-symbolic',
                           info: info });
        }

        if (place.religion) {
            content.push({ label: _("Religion:"),
                           info: Translations.translateReligion(place.religion) });
        }

        if (place.wiki && Wikipedia.isValidWikipedia(place.wiki)) {
            content.push({ type: 'wikipedia', info: '' });
        }

        return content;
    }

    _attachContent(content) {
        content.forEach(({ type, label, icon, linkUrl, info, grid }) => {
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

            if (this._inlineMode) {
                box.marginStart = 6;
            }

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

            let widget;

            if (grid) {
                widget = new Gtk.Grid({ visible:        true,
                                        column_spacing: 8 });

                for (let i = 0; i < grid.length; i++) {
                    let row = grid[i];

                    for (let j = 0; j < row.length; j++) {
                        let label = new Gtk.Label({ label:   row[j],
                                                    visible: true,
                                                    xalign:  0,
                                                    hexpand: false,
                                                    wrap: true,
                                                    halign:  Gtk.Align.FILL });

                        if (j === 1) {
                            /* set tabular digits for the second column to get
                             * aligned times
                             */
                            let attrList = Pango.AttrList.new();
                            let tnum = Pango.AttrFontFeatures.new('tnum');

                            attrList.insert(tnum);
                            label.set_attributes(attrList);
                        }

                        widget.attach(label, j, i, 1, 1);
                    }
                }
            } else {
                widget = new Gtk.Label({ label: info,
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

        if (place.wiki && Wikipedia.isValidWikipedia(place.wiki)) {
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
            this._wikipediaLabel.label = `${text} <a href="${uri}" title="${tooltipText}">${ _("Wikipedia") }</a>`;
        }
    }

    // clear the view widgets to be able to re-populate an updated place
    _clearView() {
        this._placeDetails.get_children().forEach((child) => this._placeDetails.remove(child));
    }

    // called when the place's location changes (e.g. for the current location)
    _updateLocation() {
        this._populate(this.place);
    }

    /* called when the place is edited via the OSM edit dialog */
    _onPlaceEdited() {
        this._populate(this._place);
    }
});
