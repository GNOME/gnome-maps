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

import gettext from 'gettext';

import GeocodeGlib from 'gi://GeocodeGlib';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Pango from 'gi://Pango';
import Xdp from 'gi://Xdp';

const Format = imports.format;

import {Application} from './application.js';
import * as Gfx from './gfx.js';
import {Overpass} from './overpass.js';
import { getTypeNameForPlace } from './osmTypes.js';
import {Place} from './place.js';
import * as PlaceIcons from './placeIcons.js';
import {PlaceViewImage} from './placeViewImage.js';
import {PlaceButtons} from './placeButtons.js';
import {PlaceFormatter} from './placeFormatter.js';
import {PlaceStore} from './placeStore.js';
import * as Translations from './translations.js';
import * as Utils from './utils.js';
import * as Wikipedia from './wikipedia.js';

const _ = gettext.gettext;
const ngettext = gettext.ngettext;

// maximum dimension of thumbnails to fetch from Wikipedia
const THUMBNAIL_FETCH_SIZE = 360;

// Unicode left-to-right marker
const LRM = '\u200E';

export class PlaceView extends Gtk.Box {

    constructor({place, mapView, inlineMode, ...params}) {
        /* inlineMode is used in PlaceBar for inline current location details.
           It hides the title box and decreases the start margin on the rows. */

        super(params);

        this._place = place;
        this._inlineMode = !!inlineMode;

        let ui = Utils.getUIObject('place-view', [ 'bubble-main-box',
                                                   'bubble-spinner',
                                                   'bubble-thumbnail',
                                                   'thumbnail-separator',
                                                   'label-title',
                                                   'label-icon',
                                                   'secondary-label-icon',
                                                   'native-name',
                                                   'source-icon',
                                                   'secondary-source-icon',
                                                   'source-label',
                                                   'source-box',
                                                   'address-label',
                                                   'bubble-main-stack',
                                                   'bubble-content-area',
                                                   'place-buttons',
                                                   'send-to-button-alt',
                                                   'title-box' ]);
        this._title = ui.labelTitle;
        this._icon = ui.labelIcon;
        this._secondaryIcon = ui.secondaryLabelIcon;
        this._nativeName = ui.nativeName;
        this._sourceIcon = ui.sourceIcon;
        this._secondarySourceIcon = ui.secondarySourceIcon;
        this._sourceLabel = ui.sourceLabel;
        this._sourceBox = ui.sourceBox;
        this._thumbnail = ui.bubbleThumbnail;
        this._thumbnailSeparator = ui.thumbnailSeparator;
        this._content = ui.bubbleContentArea;
        this._mainStack = ui.bubbleMainStack;
        this._spinner = ui.bubbleSpinner;
        this._mainBox = ui.bubbleMainBox;
        this._addressLabel = ui.addressLabel;

        this.append(this._mainStack);

        let placeButtons = new PlaceButtons({ place: this._place,
                                              mapView: mapView });
        placeButtons.connect('place-edited', this._onPlaceEdited.bind(this));
        ui.placeButtons.append(placeButtons);

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

        this.loading = true;

        this._placeDetails = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL,
                                           visible: true,
                                           hexpand: true });
        this.content.attach(this._placeDetails, 0, 0, 1, 1);

        if (this.place.isRawCoordinates) {
            this._populate(this.place);
        } else {
            let overpass = new Overpass();
            let placeItem = Application.placeStore.getPlaceItem(this.place);

            if (placeItem !== null) {

                // If the place is stale, update from Overpass.
                if (placeItem.isStale() &&
                    this.place.osmType !== GeocodeGlib.PlaceOsmType.UNKNOWN) {
                    overpass.populatePlace(this.place,
                                           this._onOverpass.bind(this));
                } else {
                    this._place = placeItem.place;
                    this._populate(this.place);
                }
            } else if (this.place.store) {
                /* if we got a place with already pre-filled data from
                 * Overpass, make sure it is stored in the place store
                 */
                if (this.place.prefilled) {
                    this._onOverpass(true);
                } else if (this.place.osmType !== GeocodeGlib.PlaceOsmType.UNKNOWN) {
                    overpass.populatePlace(this.place,
                                           this._onOverpass.bind(this));
                } else {
                    this._populate(this.place);
                }
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
        return this._thumbnail.paintable;
    }

    set thumbnail(val) {
        if (val) {
            this._thumbnail.paintable = val;
            this._thumbnail.visible = true;
            this._thumbnailSeparator.visible = true;
        }
    }

    get loading() {
        return this._mainStack.get_visible_child() === this._spinner;
    }
    set loading(val) {
        this._mainStack.set_visible_child(val ? this._spinner : this._mainBox);
    }

    /* get a suitable icon pixel size given a paintable and a maximum desired
     * pixel height
     */
    _calculatePixelSizeForShield(paintable, pixelHeight) {
        const intrinsicWidth = paintable.get_intrinsic_width();
        const intrinsicHeight = paintable.get_intrinsic_height();

        return intrinsicHeight < pixelHeight ?
               Math.max(intrinsicWidth, intrinsicHeight) :
               Math.max((intrinsicWidth / intrinsicHeight) * pixelHeight,
                        pixelHeight);
    }

    updatePlaceDetails() {
        let place = this.place;
        let formatter = new PlaceFormatter(place);

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

        const title = formatter.title;
        const typeName = getTypeNameForPlace(place);
        const shieldPaintables =
            Gfx.drawShieldsForPlace(place, 2, this.get_scale_factor());

        /* if the place has a title, show it, otherwise if there's a known
         * place type name, show that together with a place type icon
         */
        if (place.isRawCoordinates &&
            place.name === place.coordinatesDescription) {
            this._title.visible = true;
            this._title.label = _("Coordinates");
            this._icon.visible = false;
            this._secondaryIcon.visible = false;
        } else if (title) {
            this._title.visible = true;
            this._title.label = formatter.title;
            this._icon.visible = false;
            this._secondaryIcon.visible = false;
        } else if (typeName) {
            this._title.label = typeName;
            if (shieldPaintables.length > 0) {
                this._icon.paintable = shieldPaintables[0];
                this._icon.pixel_size =
                    this._calculatePixelSizeForShield(shieldPaintables[0], 24);
                if (shieldPaintables.length > 1) {
                    this._secondaryIcon.paintable = shieldPaintables[1];
                    this._secondaryIcon.pixel_size =
                        this._calculatePixelSizeForShield(shieldPaintables[1], 24);
                    this._secondaryIcon.visible = true;
                } else {
                    this._secondaryIcon.visible = false;
                }
            } else {
                this._icon.icon_name = PlaceIcons.getIconForPlace(place);
                this._icon.pixel_size = -1;
                this._secondaryIcon.visible = false;
            }
            this._title.visible = true;
            this._icon.visible = true;
        } else {
            this._title.visible = false;
            this._icon.visible = false;
        }

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
        } else if (place.name === place.nativeName && place.hiraganaName &&
                   place.name !== place.hiraganaName) {
            /* if the displayed name and the native name are identical, show
             * a Japanese Hiragana name form when available providing a
             * furigana-like pronounciation guide when displaying Japanese
             * native name in a Japanese locale.
             */
            this._nativeName.label = place.hiraganaName;
            this._nativeName.visible = true;
        }

        /* show the source (for shapelayer points), or if there has a known type
         * name, show it with the corresponding type icon, unless the place
         * has no title, as in this case the type name would be shown
         * in place of the title
         */
        if (place.source) {
            this._sourceLabel.label = place.source;
            this._sourceBox.visible = true;
        } else if (title && typeName && place.osmKey !== 'place') {
            if (shieldPaintables.length > 0) {
                this._sourceIcon.get_style_context().remove_class('dim-label');
                this._sourceIcon.paintable = shieldPaintables[0];
                this._sourceIcon.pixel_size =
                    this._calculatePixelSizeForShield(shieldPaintables[0], 18);

                if (shieldPaintables.length > 1) {
                    this._secondarySourceIcon.paintable = shieldPaintables[1];
                    this._secondarySourceIcon.pixel_size =
                        this._calculatePixelSizeForShield(shieldPaintables[1], 18);
                    this._secondarySourceIcon.visible = true;
                } else {
                    this._secondarySourceIcon.visible = false;
                }
            } else {
                const iconName = PlaceIcons.getIconForPlace(place);

                // don't dim the icon for non-symbolic (transit network) icons
                if (iconName.endsWith('-symbolic'))
                    this._sourceIcon.get_style_context().add_class('dim-label');
                else
                    this._sourceIcon.get_style_context().remove_class('dim-label');
                this._sourceIcon.icon_name = iconName;
                this._sourceIcon.pixel_size = -1;
                this._secondarySourceIcon.visible = false;
            }
            this._sourceLabel.label = typeName;
            this._sourceBox.visible = true;
        } else {
            this._sourceBox.visible = false;
        }
    }

    _onOverpass(success) {
        this._populate(this.place);

        Application.placeStore.addPlace(this.place);
    }

    _formatWikiLink(wiki) {
        let lang = Wikipedia.getLanguage(wiki);
        let article = Wikipedia.getArticle(wiki);

        return `https://${lang}.wikipedia.org/wiki/${article}`;
    }

    _createContent(place) {
        let content = [];

        if (place.isRawCoordinates) {
            let coordinates = place.coordinatesDescription;
            let accuracyDescription = Utils.getAccuracyDescription(this.place.location.accuracy);

            content.push({ label: _("Coordinates"),
                           icon: place.isCurrentLocation ?
                                 'map-marker-symbolic' : 'pin-location-symbolic',
                           info: coordinates });
            if (place.isCurrentLocation ||
                place.location.accuracy !== GeocodeGlib.LOCATION_ACCURACY_UNKNOWN)
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

            /* if we're running in a sandbox (Flatpak or Snap), assume
             * we have some app that can handle tel: URIs, as we can't
             * enumerate apps inside the sandbox
             */
            if (Xdp.Portal.running_under_sandbox() ||
                Utils.uriSchemeSupported('tel')) {
                /* RFC3966 only allows "-", '.", "(", and ")" as visual
                 * separator characters in a global phone number, no space */
                phone.linkUrl = `tel:${place.phone.replace(/\s+/g, '')}`;
            }

            content.push(phone);
        }

        if (place.email && Utils.isValidEmail(place.email)) {
            content.push({ label: _("Email"),
                           icon: 'mail-unread-symbolic',
                           info: GLib.markup_escape_text(place.email, -1),
                           linkUrl: `mailto:${place.email}` });
        }

        if (place.floor) {
            /* If a reference to a named floor (named or symbolic) exists
             * refer to it directly.
             */

            /* Translators:
             * This is a reference to named building floor, using a label
             * or a code, as "displayed in the elevator"
             */
            content.push({ label: _("Floor"),
                           icon:  'steps-symbolic',
                           info:  _("Floor %s").format(place.floor) });
        } else if (place.level) {
            /* Else if a floor level relative to ground level exists,
             * display it indicating the relation to ground, or when 0 that
             * it's ground level
             */
            const level = parseInt(place.level);

            if (!isNaN(level)) {
                let info;

                if (level === 0) {
                    info = _("At ground level");
                } else if (level > 0) {
                    const levelString = level.toLocaleString();

                    /* Translators:
                     * This is a reference to a number of floors above
                     * ground level.
                     * The %s placeholder is the integer relative number of floors
                     */
                    info = ngettext("%s floor above ground level",
                                    "%s floors above ground level", level)
                                    .format(levelString);
                } else {
                    const levelString = (-level).toLocaleString();

                    /* Translators:
                     * This is a reference to a number of floors below
                     * ground level.
                     * The %s placeholder is the integer relative number of floors
                     */
                    info = ngettext("%s floor below ground level",
                                    "%s floors below ground level", -level)
                                    .format(levelString);
                }

                content.push({ label: _("Floor"),
                               icon:  'steps-symbolic',
                               info:  info });
            }
        }

        if (place.isEatingAndDrinking) {
            switch (place.takeaway) {
                case 'yes':
                    /* Translators:
                     * The establishment offers customers to purchase meals
                     * (or similar) to be consumed elsewhere
                     */
                    content.push({ info: _("Offers takeout"),
                                   icon: PlaceIcons.getIconForPlace(place) });
                    break;
                case 'no':
                    /* Translators:
                     * The establishment only offers customers to purchase
                     * meals (or similar) to be consumed on-premise.
                     */
                    content.push({ info: _("Does not offer takeout"),
                                   icon: PlaceIcons.getIconForPlace(place) });
                    break;
                case 'only':
                    /* Translators:
                     * The establishment only offers customers to purchase
                     * meals (or similar) to be consumed elsewhere. E.g.
                     * there is no seating on-premise for eating/drinking
                     */
                    content.push({ info: _("Only offers takeout"),
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
            const religion = Translations.translateReligion(place.religion);

            if (religion)
                content.push({ label: _("Religion:"), info: religion });
        }

        if (place.isMotorwayJunction && place.ref) {
            // Translators: This refers to motorway junction exit (freeway exit)
            const exitRef = _("Exit %s").format(place.ref);
            const lht = Utils.isLefthandTrafficForCountry(place.countryCode);

            content.push({ icon: lht ? 'arrow2-top-left-symbolic' :
                                       'arrow2-top-right-symbolic',
                           info: exitRef });
        }

        return content;
    }

    _addBox() {
        let separator = new Gtk.Separator();

        separator.get_style_context().add_class('no-margin-separator');
        this._placeDetails.append(separator);

        let box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL,
                                marginStart: 12,
                                marginEnd: 12,
                                marginTop: 6,
                                marginBottom: 6,
                                spacing: 12 });

        if (this._inlineMode) {
            box.marginStart = 6;
        }

        this._placeDetails.append(box);

        return box;
    }

    _attachContent(content) {
        content.forEach(({ type, label, icon, linkUrl, info, grid }) => {
            let box = this._addBox();

            if (icon) {
                let widget = new Gtk.Image({ icon_name: icon,
                                             valign: Gtk.Align.START,
                                             halign: Gtk.Align.END });

                if (label) {
                    widget.tooltip_markup = label;
                }

                box.append(widget);
            } else if (label) {
                let widget = new Gtk.Label({ label: label.italics(),
                                             use_markup: true,
                                             yalign: 0,
                                             halign: Gtk.Align.END });
                box.append(widget);
            }

            if (linkUrl) {
                let uri = GLib.markup_escape_text(linkUrl, -1);
                /* double-escape the tooltip text, as GTK treats it as markup */
                let tooltipText = GLib.markup_escape_text(uri, -1);
                info = `<a href="${uri}" title="${tooltipText}">${info}</a>`;
            }

            let widget;

            if (grid) {
                widget = new Gtk.Grid({ column_spacing: 6,
                                        row_spacing:    6 });

                for (let i = 0; i < grid.length; i++) {
                    let row = grid[i];

                    for (let j = 0; j < row.length; j++) {
                        /* if there's only one component, e.g. in opening
                         * hours, allow more space
                         */
                        const maxChars = row.length === 1 ? 30 : 15;
                        const label = new Gtk.Label({ label:   row[j],
                                                      xalign:  0,
                                                      hexpand: true,
                                                      wrap: true,
                                                      max_width_chars: maxChars,
                                                      halign:  Gtk.Align.FILL,
                                                      valign:  Gtk.Align.START });

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
                                         use_markup: true,
                                         max_width_chars: 30,
                                         wrap: true,
                                         xalign: 0,
                                         hexpand: true,
                                         halign: Gtk.Align.FILL,
                                         wrap: true });
            }

            box.append(widget);
        });
    }

    _populate(place) {
        // refresh place view
        this._clearView();

        let content = this._createContent(place);
        this._attachContent(content);

        if (place.description) {
            const box = this._addBox();
            const descriptionLabel = new Gtk.Label({
                max_width_chars: 30,
                wrap: true,
                xalign: 0,
                hexpand: true,
                halign: Gtk.Align.FILL,
                label: place.description
            });
            box.marginTop = 12;
            box.marginBottom = 18;
            box.append(descriptionLabel);
        } else if (place.wikidata && Wikipedia.isValidWikidata(place.wikidata)) {
            let defaultArticle =
                place.wiki && Wikipedia.isValidWikipedia(place.wiki) ?
                place.wiki : null;

            this._requestWikidata(place.wikidata, defaultArticle);
        } else if (place.wiki && Wikipedia.isValidWikipedia(place.wiki)) {
            this._requestWikipedia(place.wiki);
        } else if (place.brandWikidata &&
                   Wikipedia.isValidWikidata(place.brandWikidata)) {
            this._requestWikidataLogo(place.brandWikidata);
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

    _requestWikidata(wikidata, defaultArticle) {
        Wikipedia.fetchArticleInfoForWikidata(
            wikidata, defaultArticle, THUMBNAIL_FETCH_SIZE,
            this._onWikiMetadataComplete.bind(this),
            this._onThumbnailComplete.bind(this));
    }

    _requestWikidataLogo(wikidata) {
        Wikipedia.fetchLogoImageForWikidata(wikidata, THUMBNAIL_FETCH_SIZE,
                                            this._onLogoImageComplete.bind(this));
    }

    _onLogoImageComplete(logoImage) {
        const aspectRatio =
            logoImage.get_intrinsic_height() / logoImage.get_intrinsic_width();

        // don't show logo images that would scaled
        if (aspectRatio <= PlaceViewImage.MAX_ASPECT_RATIO)
            this._onThumbnailComplete(logoImage, true);
    }

    _onThumbnailComplete(thumbnail, margin = false) {
        this._thumbnail.margin_start = margin ? 6 : 0;
        this._thumbnail.margin_end = margin ? 6 : 0;
        this._thumbnail.margin_top = margin ? 6 : 0;
        this._thumbnail.margin_bottom = margin ? 6 : 0;
        this.thumbnail = thumbnail;
    }

    _onWikiMetadataComplete(wiki, metadata) {
        if (metadata.extract) {
            let box = this._addBox();
            let wikipediaLabel = new Gtk.Label({ use_markup: true,
                                                 max_width_chars: 30,
                                                 wrap: true,
                                                 xalign: 0,
                                                 hexpand: true,
                                                 halign: Gtk.Align.FILL });

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
            let label = `${text} <a href="${uri}" title="${tooltipText}">${ _("Wikipedia") }</a>`;

            wikipediaLabel.label = label;
            box.marginTop = 12;
            box.marginBottom = 18;
            box.append(wikipediaLabel);
        }
    }

    // clear the view widgets to be able to re-populate an updated place
    _clearView() {
        let details = [];

        for (let detail of this._placeDetails) {
            details.push(detail);
        }

        for (let detail of details) {
            this._placeDetails.remove(detail);
        }
    }

    // called when the place's location changes (e.g. for the current location)
    _updateLocation() {
        this._populate(this.place);
    }

    /* called when the place is edited via the OSM edit dialog */
    _onPlaceEdited() {
        this._populate(this._place);
    }
}

GObject.registerClass(PlaceView);
