/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2015 Marcus Lundblad
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
 * with GNOME Maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Marcus Lundblad <ml@update.uu.se>
 */

import gettext from 'gettext';

const _ = gettext.gettext;

import GeocodeGlib from 'gi://GeocodeGlib';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import * as Address from './address.js';
import {Application} from './application.js';
import GnomeMaps from 'gi://GnomeMaps';
import {OSMConnection} from './osmConnection.js';
import * as OSMTypes from './osmTypes.js';
import * as OSMUtils from './osmUtils.js';
import * as Utils from './utils.js';
import * as Wikipedia from './wikipedia.js';
import {OSMDiscardDialog} from './osmDiscardDialog.js';

/*
 * enumeration representing
 * the different OSM editing
 * field types
 */
const EditFieldType = {
    TYPE:             0,
    TEXT:             1,
    INTEGER:          2,
    UNSIGNED_INTEGER: 3,
    COMBO:            4,
    ADDRESS:          5,
    WIKIPEDIA:        6,
};

const _WIKI_BASE = 'https://wiki.openstreetmap.org/wiki/Key:';

/* Reformat a phone number string if it looks like a tel: URI
 * strip off the leading tel: protocol string and trailing parameters,
 * following a ;
 * otherwise return the string unmodified */
var _osmPhoneRewriteFunc = function(text) {
    if (GLib.uri_parse_scheme(text) === 'tel') {
        let afterTel = text.replace('tel:', '');

        return GLib.uri_unescape_string(afterTel.split(';')[0], null);
    } else {
        return text;
    }
};

/* Reformat an e-mail address if it it looks like a mailto: URI
 * strip off the leading mailto: protocol string and trailing parameters,
 * following a ?
 * otherwise return the string unmodified
 */
var _osmEmailRewriteFunc = function(text) {
    if (GLib.uri_parse_scheme(text) === 'mailto') {
        let afterMailto = text.replace('mailto:', '');

        return GLib.uri_unescape_string(afterMailto.split('?')[0], null);
    } else {
        return text;
    }
}

/*
 * specification of OSM edit fields
 * name: the label for the edit field (translatable)
 * tag: the OSM tag key value
 * type: the field type (determines editing field type)
 * rewriteFunc: a rewrite function taking a string argument
 * (only used for TEXT fields)
 * placeHolder: set a text place holder to act as example input
 * (only used for TEXT fields)
 * includeHelp: when true turn the name label to a link to the
 * OSM wiki for tags.
 * options: The options for the combo box (only used for COMBO fields)
 * hint: a hint text to show in a popover displayed by a hint button
 * (for TEXT and INTEGER fields)
 * subtags: Used by a complex composite OSM tag.
 * rows: Number of rows needed if != 1 (Currently only for ADDRESS).
 */

const OSM_FIELDS = [
    {
        title: _("General"),
        fields: [
            {
                title: _("Name"),
                tag: 'name',
                type: EditFieldType.TEXT
            },
            {
                title: _("Type"),
                tag: 'type',
                type: EditFieldType.TYPE
            },
            {
                title: _("Address"),
                tag: 'addr',
                subtags: [
                    'addr:street',
                    'addr:housenumber',
                    'addr:postcode',
                    'addr:city'
                ],
                type: EditFieldType.ADDRESS
            }
        ]
    },
    {
        title: _("Contact"),
        fields: [
            {
                title: _("Opening Hours"),
                tag: 'opening_hours',
                type: EditFieldType.TEXT,
                placeHolder: 'Mo-Fr 08:00-20:00; Sa-Su 10:00-14:00'
            },
            {
                title: _("Phone"),
                tag: 'phone',
                type: EditFieldType.TEXT,
                rewriteFunc: _osmPhoneRewriteFunc
            },
            {
                title: _("Email"),
                tag: 'email',
                type: EditFieldType.TEXT,
                validate: Utils.isValidEmail,
                rewriteFunc: _osmEmailRewriteFunc
            },
            {
                title: _("Website"),
                tag: 'website',
                type: EditFieldType.TEXT,
                validate: Utils.isValidWebsite
            }
        ]
    },
    {
        title: _("Accessibility"),
        fields: [
            {
                title: _("Wheelchair Access"),
                tag: 'wheelchair',
                type: EditFieldType.COMBO,
                options: [['yes', _("Yes")],
                          ['no', _("No")],
                          ['limited', _("Limited")],
                          ['designated', _("Designated")]]
            },
            {
                title: _("Internet Access"),
                tag: 'internet_access',
                type: EditFieldType.COMBO,
                options: [['yes', _("Yes")],
                          ['no', _("No")],
                          ['wlan', _("Wi-Fi")],
                          ['wired', _("Wired")],
                          ['terminal', _("Terminal")],
                          ['service', _("Service")]]
            }
        ]
    },
    {
        /* Translators: This is the title for a section of POI fields not
         * belonging to the previous sections ("General", "Contact", "Accessibility").
         */
        title: _("Miscellaneous"),
        fields: [
            {
                title: _("Wikipedia"),
                tag: 'wiki',
                subtags: ['wikipedia',
                          'wikidata'],
                type: EditFieldType.WIKIPEDIA
            },
            {
                title: _("Population"),
                tag: 'population',
                type: EditFieldType.UNSIGNED_INTEGER
            },
            {
                title: _("Altitude"),
                subtitle: _("Elevation above sea level, in meters"),
                tag: 'ele',
                type: EditFieldType.INTEGER,
            },

            {
                title: _("Takeout"),
                tag:  'takeaway',
                type: EditFieldType.COMBO,
                options: [['yes', _("Yes")],
                          ['no', _("No")],
                          ['only', _("Only")]]
            },
            {
                title: _("Religion"),
                tag: 'religion',
                type: EditFieldType.COMBO,
                options: [['animist', _("Animism")],
                          ['bahai', _("Bahá’í")],
                          ['buddhist', _("Buddhism")],
                          ['caodaism', _("Caodaism")],
                          ['christian', _("Christianity")],
                          ['confucian', _("Confucianism")],
                          ['hindu', _("Hinduism")],
                          ['jain', _("Jainism")],
                          ['jewish', _("Judaism")],
                          ['muslim', _("Islam")],
                          ['multifaith', _("Multiple Religions")],
                          ['none', _("None")],
                          ['pagan', _("Paganism")],
                          ['pastafarian', _("Pastafarianism")],
                          ['scientologist', _("Scientology")],
                          ['shinto', _("Shinto")],
                          ['sikh', _("Sikhism")],
                          ['spiritualist', _("Spiritualism")],
                          ['taoist', _("Taoism")],
                          ['unitarian_universalist', _("Unitarian Universalism")],
                          ['voodoo', _("Voodoo")],
                          ['yazidi', _("Yazidism")],
                          ['zoroastrian', _("Zoroastrianism")]]
            },
            {
                title: _("Note"),
                tag: 'note',
                type: EditFieldType.TEXT,
            }
        ]
    }
];

export class OSMEditDialog extends Adw.Dialog {
    static Response = {
        NONE:      0,
        UPLOADED:  1,
        DELETED:   2,
        CANCELLED: 3,
        ERROR:     4
    };

    constructor({place, addLocation, latitude, longitude, ...params}) {
        super(params);

        this._latitude = latitude ?? place.location.latitude;
        this._longitude = longitude ?? place.location.longitude;

        this._cancellable = new Gio.Cancellable();

        this.connect('closed', () => this._cancellable.cancel());
        this.connect('close-attempt', () => {
            this._showDiscardDialog();
        });

        this._typeSearchEntry.connect('changed',
                                      () => { this._onTypeSearchChanged(); });

        [this._shopButton, this._placeButton, this._tourismButton,
         this._officeButton, this._amenityButton, this._leisureButton,
         this._aerowayButton].forEach((button) => {
            button.connect('toggled',
                           () =>this._loadAllTypes(this._getSelectedTags()));
         });

        this._continueButton.connect('clicked', () => {
            this._navigationView.push_by_tag('upload');
            this._uploadNotesTextview.grab_focus();
            this._isEditing = false;
        });

        this._submitButton.connect('clicked', () => this._submit());

        this._uploadNotesTextview.buffer.connect('changed', (buffer) => {
            if (buffer.text !== '') {
                this._submitButton.sensitive = true;
            } else {
                this._submitButton.sensitive = false;
            }
        });

        this._isEditing = false;

        this._recentTypeRows = [];

        if (addLocation) {
            /* the OSMObject ID, version, and changeset ID is unknown for now */
            let newNode = GnomeMaps.OSMNode.new(0, 0, 0, longitude, latitude);
            this._loadOSMData(newNode);
            this._isEditing = true;
            this._osmType = GeocodeGlib.PlaceOsmType.NODE;

            // set the title and description for adding a POI
            this._navigationPage.title = C_("dialog heading", "Add Location");
            this._preferencesPage.description = _("Add a new location to OpenStreetMap");
        } else {
            this._osmType = place.osmType;
            Application.osmEdit.fetchObject(place,
                                            this._onObjectFetched.bind(this),
                                            this._cancellable);
        }
    }

    _onTypeSearchChanged() {
        let text = this._typeSearchEntry.get_text();

        if (text.length === 0) {
            this._loadAllTypes(this._getSelectedTags());
        }

        if (text.length >= 1) {

            for (const tag of Object.getOwnPropertyNames(OSMTypes.TYPE_TAG_TITLES)) {
                if (text.localeCompare(gettext.gettext(OSMTypes.TYPE_TAG_TITLES[tag]),
                                       undefined, { sensitivity: 'base' }) === 0) {
                    this._typeList.add_css_class('boxed-list');
                    this._loadAllTypes([tag]);

                    return;
                }
            }

            const matches =
                OSMTypes.findMatches(text, 10, this._getSelectedTags());

            this._typeList.remove_all();
            this._recentTypesList.visible = false;

            if (matches.length > 0) {
                this._typeList.add_css_class('boxed-list');

                for (let m of matches) {
                    let row = this._addTypeRow(m.key, m.value, m.title);

                    this._typeList.append(row);
                }
            } else {
                this._typeList.remove_css_class('boxed-list');
            }
        }
    }

    _showDiscardDialog() {
        const dialog = new OSMDiscardDialog();

        dialog.present(this);
        dialog.connect('response', (dialog, response) => {
            if (response === 'discard') {
                this.response = OSMEditDialog.Response.CANCELLED;
                this._cancellable.cancel();

                this.can_close = true;
                this.close();
            }
        });
    }

    _submit() {
        if (this._isEditing) {
            return;
        }

        this._navigationView.push_by_tag('loading');


        let comment = this._uploadNotesTextview.buffer.text;
        Application.osmEdit.uploadObject(this._osmObject,
                                         this._osmType, comment,
                                         this._onObjectUploaded.bind(this));
    }

    _onObjectFetched(success, status, osmObject, osmType, error) {
        if (success) {
            this._isEditing = true;
            this._loadOSMData(osmObject);
        } else {
            this._showError(status, error);
            this.close();
        }
    }

    _onObjectUploaded(success, status) {
        if (success) {
            this.response = OSMEditDialog.Response.UPLOADED;
            // show changes submitted toast, unless it was a new object
            if (this._osmObject.id !== 0)
                Application.application.mainWindow.showToast(_("Changes successfully submitted"));
        } else {
            this._showError(status);
            this.response = OSMEditDialog.Response.ERROR;
        }

        this.can_close = true;
        this.close();
    }

    _showError(status, error) {
        /* set error message from specific error if available, otherwise use
         * a generic error message for the HTTP status code */
        let statusMessage =
            error ? error.message : OSMConnection.getStatusMessage(status);

        Application.application.mainWindow.showToast(statusMessage);
        this.response = OSMEditDialog.Response.ERROR;
    }

    _getSelectedTags() {
        const selected =
            [this._shopButton.active ? 'shop' : null,
             this._placeButton.active ? 'place' : null,
             this._tourismButton.active ? 'tourism' : null,
             this._officeButton.active ? 'office' : null,
             this._amenityButton.active ? 'amenity' : null,
             this._leisureButton.active ? 'leisure' : null,
             this._aerowayButton.active ? 'aeroway' : null].filter((e) => !!e);

        return selected.length > 0 ? selected : null;
    }

    _loadAllTypes(selectedTags) {
        const map = OSMTypes.getAllTypes();

        this._typeList.remove_all();
        this._typeList.append(this._noneRow);
        this._recentTypesList.visible = !selectedTags;

        if (selectedTags) {
            const types = [];

            for (const tag of selectedTags) {
                for (const item of map[tag]) {
                    types.push({ tag:             tag,
                                 value:           item.value,
                                 title:           item.title,
                                 normalizedTitle: item.normalizedTitle });
                }
            }

            types.sort((a, b) => a.normalizedTitle.localeCompare(b.normalizedTitle));

            for (const item of types) {
                const row = this._addTypeRow(item.tag, item.value, item.title);

                this._typeList.append(row);
            }
        } else {
            let currentTag = null;
            let currentValue = null;
            for (const tag of OSMTypes.OSM_TYPE_TAGS) {
                currentValue = this._osmObject.get_tag(tag);

                if (currentValue) {
                    currentTag = tag;
                    break;
                }
            }

            // insert row for the currently selected type, if found
            if (currentValue) {
                const currentTitle =
                    OSMTypes.lookupType(currentTag, currentValue);

                if (currentTitle) {
                    const row =
                        this._addTypeRow(currentTag, currentValue, currentTitle);

                    this._typeList.append(row);
                }
            }

            for (const row of this._recentTypeRows) {
                this._recentTypesList.remove(row);
            }

            this._recentTypeRows = [];

            // insert recently used types (excluding the currently used one)
            for (const item of OSMTypes.recentTypesStore.recentTypes) {
                if (item.key !== currentTag && item.value !== currentValue) {
                    const title = OSMTypes.lookupType(item.key, item.value);
                    const row =
                        this._addTypeRow(item.key, item.value, title);

                    this._recentTypeRows.push(row);
                    this._recentTypesList.add(row);
                }
            }
        }
    }

    _addTypeRow(tag, value, title) {
        let row = new Adw.ActionRow();
        row.set_use_markup(true);
        row.title = title ? GLib.markup_escape_text(title, -1) : '';
        row.subtitle = OSMTypes.getTitleForTag(tag);

        let toggle = new Gtk.CheckButton();
        toggle.set_valign(Gtk.Align.CENTER);

        toggle.set_group(this._noneCheckButton);

        row.add_prefix(toggle);
        row.set_activatable_widget(toggle);

        if (this._osmObject.get_tag(tag) === value)
            toggle.active = true;

        toggle.connect('toggled', () => {
            if (toggle.active) {
                /* clear out any previous type-related OSM tags */
                OSMTypes.OSM_TYPE_TAGS.forEach((tag) => this._osmObject.delete_tag(tag));

                this._osmObject.set_tag(tag, value);
                this._updateTypeRow(title);
                this.can_close = false;
                this._continueButton.sensitive = true;

                // store recently used type
                OSMTypes.recentTypesStore.pushType(tag, value);
            }
        });

        return row;
    }

    _getTypeTags() {
        return OSMTypes.OSM_TYPE_TAGS.filter(t => this._osmObject.get_tag(t));
    }

    _loadType() {
        const typeTags = this._getTypeTags();

        if (typeTags.length === 0) {
            return _("None");
        } else if (typeTags.length === 1) {
            const tag = typeTags[0];
            const value = this._osmObject.get_tag(tag);

            return OSMTypes.lookupType(tag, value);
        } else {
            return null;
        }
    }

    _addOSMTypeEntry(group, category, subtitle) {
        const row = new Adw.ActionRow();

        row.title = gettext.gettext(category.title);
        row.activatable = true;
        row.add_css_class('property');
        row.add_suffix(Gtk.Image.new_from_icon_name('go-next-symbolic'));
        row.accessible_role = 'button';

        row.connect('activated', () => {
            // clear type search entry and filters
            this._typeSearchEntry.text = '';

            for (const button of [this._shopButton,
                                  this._placeButton,
                                  this._tourismButton,
                                  this._officeButton,
                                  this._amenityButton,
                                  this._leisureButton,
                                  this._aerowayButton]) {
                button.freeze_notify();
                button.active = false;
                button.thaw_notify();
            }

            this._loadAllTypes();
            this._typeSearchEntry.grab_focus();
            this._navigationView.push_by_tag('type');
        });

        group.add(row);

        this._typeRow = row;
        this._updateTypeRow(subtitle);
    }

    _updateTypeRow(subtitle) {
        this._typeRow.subtitle = subtitle;
    }

    _validateTextEntry(category, entry) {
        if (category.validate) {
            /* also allow empty text without showing the validation warning,
             * since we want to allow clearing out the text to unset a value
             * (equivalent to using the delete button).
             */
            if (entry.text !== '' && !category.validate(entry.text)) {
                entry.get_style_context().add_class("warning");
                this._continueButton.sensitive = false;
            } else {
                entry.get_style_context().remove_class("warning");
                this._continueButton.sensitive = true;
            }
        } else {
            this._continueButton.sensitive = true;
        }
    }

    _addOSMEditTextEntry(group, category, value) {
        let row = new Adw.EntryRow();
        row.title = gettext.gettext(category.title);
        row.text = value;

        if (!this._isEditing && row.text !== '') {
            this._continueButton.sensitive = true;
        }

        row.connect('changed', () => {
            if (category.tag === 'name') {
                if (row.text !== '') {
                    this._continueButton.sensitive = true;
                } else {
                    this._continueButton.sensitive = false;
                }
            }

            if (category.rewriteFunc) {
                let rewrittenText = category.rewriteFunc(row.text);

                if (rewrittenText !== row.text)
                    row.text = rewrittenText;
            }

            this._osmObject.set_tag(category.tag, row.text);
            this._validateTextEntry(category, row);
            this.can_close = false;
        });

        group.add(row);
    }

    _addOSMEditIntegerEntry(group, category, value, min, max) {
        const row = new Adw.SpinRow();
        const subtitle =
            category.subtitle ? gettext.gettext(category.subtitle) : '';

        row.title = gettext.gettext(category.title);
        row.subtitle = subtitle;

        const adjustment = new Gtk.Adjustment();

        adjustment.lower = min;
        adjustment.upper = max;

        if (!value) {
            row.add_css_class('dim-spinbutton');
        }

        adjustment.value = value ?? 0;
        adjustment.step_increment = 1;
        adjustment.page_increment = 10;
        adjustment.numeric = true;
        row.adjustment = adjustment;

        group.add(row);

        row.connect('changed', (row) => {
            row.remove_css_class('dim-spinbutton');
            this._osmObject.set_tag(category.tag, row.text);
            this.can_close = false;
            this._continueButton.sensitive = true;
        });
    }

    _addOSMEditComboEntry(group, category, value) {
        let row = new Adw.ComboRow();
        row.title = gettext.gettext(category.title);

        group.add(row);

        let model = new Gtk.StringList();

        let selected = 0;

        /* Translators: This is the title for a combo box row selected when a
         * value is not assigned to one in a list of allowed values.
         */
        model.append(_("Unspecified value"));
        category.options.forEach((options, index) => {
            const [id, title] = options;

            model.append(gettext.gettext(title));

            if (id === value) {
                // off by one because this index doesn't account for the 'None' option.
                selected = index + 1;
            }
        });

        row.model = model;
        row.selected = selected;

        if (value === '') {
            row.selected = 0;
        }

        row.connect('notify::selected', (row) => {
            const selected = row.selected;
            const value = selected === 0 ? '' : category.options[selected - 1][0];

            this._osmObject.set_tag(category.tag, value);
            this.can_close = false;
        });
    }

    _addEntrySubrows(title, text) {
        let row = new Adw.EntryRow();
        row.title = title;
        row.text = text ?? '';

        return row;
    }

    _updateAddressSubtitle(row) {
        const houseNumber = this._osmObject.get_tag('addr:housenumber');
        const street = this._osmObject.get_tag('addr:street');
        const city = this._osmObject.get_tag('addr:city');
        const countryCode =
            this._osmObject.get_tag('addr:country') ??
            Utils.getCountryCodeForCoordinates(this._latitude, this._longitude);
        const streetAddress =
            houseNumber ?
            Address.streetAddressForCountryCode(street, houseNumber, countryCode) :
            street;

        if (streetAddress)
            row.subtitle = city ? `${streetAddress}, ${city}` : streetAddress;
        else
            row.subtitle = '';
    }

    _addOSMEditAddressEntry(group, category, value) {
        const [street, number, postCode, city] = value;
        const row = new Adw.ExpanderRow({ title: _("Address") });

        if (this._isEditing && street !== undefined) {
            row.add_css_class('property');
        }

        let streetRow = this._addEntrySubrows(_("Street Name"), street);
        let numberRow = this._addEntrySubrows(_("House Number"), number);
        let postcodeRow = this._addEntrySubrows(_("ZIP Code"), postCode);
        let cityRow = this._addEntrySubrows(_("City"), city);

        row.add_row(streetRow);
        row.add_row(numberRow);
        row.add_row(postcodeRow);
        row.add_row(cityRow);

        this._updateAddressSubtitle(row);

        group.add(row);

        let changedFunc = (function(subrow, index) {
            this._osmObject.set_tag(category.subtags[index], subrow.text);
            this._updateAddressSubtitle(row);
            this.can_close = false;
            this._continueButton.sensitive = true;
        }).bind(this);

        streetRow.connect('changed', changedFunc.bind(this, streetRow, 0));
        numberRow.connect('changed', changedFunc.bind(this, numberRow, 1));
        postcodeRow.connect('changed', changedFunc.bind(this, postcodeRow, 2));
        cityRow.connect('changed', changedFunc.bind(this, cityRow, 3));
    }

    _addOSMEditWikipediaEntry(group, category, value) {
        const article = value[0];
        const wikidataTag = value[1];

        const row = new Adw.ExpanderRow();
        row.title = _("Wikipedia");

        const articleRow = new Adw.EntryRow();
        articleRow.title = _("Wikipedia Article");
        articleRow.text = article ?? '';

        const dataRow = new Adw.EntryRow();
        dataRow.title = _("Wikidata Tag");
        dataRow.text = wikidataTag ?? '';

        const refreshButton = new Gtk.Button();
        refreshButton.icon_name = 'view-refresh-symbolic';
        refreshButton.tooltip_text = _("Load Wikidata tag from article name");
        refreshButton.valign = Gtk.Align.CENTER;
        refreshButton.add_css_class('flat');
        refreshButton.add_css_class('circular');

        dataRow.add_suffix(refreshButton);

        row.add_row(articleRow);
        row.add_row(dataRow);

        group.add(row);

        articleRow.connect('changed', (row) => {
            let rewrittenText =
                OSMUtils.getWikipediaOSMArticleFormatFromUrl(row.text);

            if (rewrittenText)
                row.text = rewrittenText;

            if (row.text !== '' &&
                !Wikipedia.isValidWikipedia(row.text)) {
                row.add_css_class('warning');
            } else {
                row.remove_css_class('warning');
                this._continueButton.sensitive = true;
            }

            this._osmObject.set_tag(category.subtags[0], row.text);
            refreshButton.sensitive = !!row.text;
            this.can_close = false;
        });

        dataRow.connect('changed', (row) => {
            let rewrittenText =
                OSMUtils.getWikidataFromUrl(row.text);

            if (rewrittenText)
                row.text = rewrittenText;

            if (row.text !== '' &&
                !Wikipedia.isValidWikidata(row.text)) {
                row.add_css_class('warning');
            } else {
                row.remove_css_class('warning');
                this._continueButton.sensitive = true;
            }

            this._osmObject.set_tag(category.subtags[1], row.text);
            this.can_close = false;
        });

        refreshButton.connect('clicked', () => {
            Wikipedia.fetchWikidataForArticle(articleRow.text,
                                              this._cancellable,
                                              (tag) => {
                if (!tag) {
                    Utils.showToastInOverlay(_("Couldn't find Wikidata tag for article"), this._overlay);
                    return;
                }

                dataRow.text = tag;
            });
        });
    }

    _addOSMField(group, category, value) {
        switch (category.type) {
        case EditFieldType.TEXT:
            this._addOSMEditTextEntry(group, category, value ?? '');
            break;
        case EditFieldType.INTEGER:
            this._addOSMEditIntegerEntry(group, category, value, -1e9, 1e9);
            break;
        case EditFieldType.UNSIGNED_INTEGER:
            this._addOSMEditIntegerEntry(group, category, value, 0, 1e9);
            break;
        case EditFieldType.COMBO:
            this._addOSMEditComboEntry(group, category, value ?? '');
            break;
        case EditFieldType.ADDRESS:
            this._addOSMEditAddressEntry(group, category, value ?? '');
            break;
        case EditFieldType.WIKIPEDIA:
            this._addOSMEditWikipediaEntry(group, category, value ?? '');
            break;
        case EditFieldType.TYPE:
            const subtitle = this._loadType();

            if (subtitle)
                this._addOSMTypeEntry(group, category, subtitle);

            break;
        }
    }

    _loadOSMData(osmObject) {
        this._osmObject = osmObject;
        this._loadType();

        for (const category of OSM_FIELDS) {
            const group = new Adw.PreferencesGroup();

            group.title = gettext.gettext(category.title);

            for (const field of category.fields) {
                let value;

                if (field.subtags) {
                    let hasAny = false;
                    field.subtags.forEach(function(tag) {
                        if (osmObject.get_tag(tag) != null)
                            hasAny = true;
                    });

                    if (hasAny) {
                        value = field.subtags.map(function(tag) {
                            return osmObject.get_tag(tag);
                        });
                    }

                    this._addOSMField(group, field, value);
                } else {
                    value = osmObject.get_tag(field.tag);
                    this._addOSMField(group, field, value);
                }
            }

            this._preferencesPage.add(group);
        }

        this._navigationView.replace_with_tags(['editor']);

        this._noneCheckButton.active = this._getTypeTags().length === 0;
        this._noneCheckButton.connect('toggled', () => {
            if (this._noneCheckButton.active) {
                /* clear out any previous type-related OSM tags */
                OSMTypes.OSM_TYPE_TAGS.forEach((tag) => this._osmObject.delete_tag(tag));

                if (this._typeRow)
                    this._updateTypeRow(_("None"));
                this.can_close = false;
                this._continueButton.sensitive = true;
            }
        });
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/osm-edit-dialog.ui',
    Properties: {
        'type_title': GObject.ParamSpec.string('type_title', '', '',
                                          GObject.ParamFlags.READABLE |
                                          GObject.ParamFlags.WRITABLE,
                                          ''),
        'response': GObject.ParamSpec.int('response', '', '',
                                          GObject.ParamFlags.READABLE |
                                          GObject.ParamFlags.WRITABLE,
                                          -1),
    },
    InternalChildren: ['navigationView',
                       'continueButton',
                       'preferencesPage',
                       'shopButton',
                       'placeButton',
                       'tourismButton',
                       'officeButton',
                       'amenityButton',
                       'leisureButton',
                       'aerowayButton',
                       'typeSearchEntry',
                       'typeList',
                       'noneCheckButton',
                       'submitButton',
                       'uploadNotesTextview',
                       'overlay',
                       'noneRow',
                       'recentTypesList',
                       'navigationPage'],
}, OSMEditDialog);

