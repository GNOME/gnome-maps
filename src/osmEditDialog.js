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
    TEXT:             0,
    INTEGER:          1,
    UNSIGNED_INTEGER: 2,
    COMBO:            3,
    ADDRESS:          4,
    WIKIPEDIA:        5,
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

const GENERAL_FIELDS = [
    { title: _("General"), },
    {
        title: _("Name"),
        tag: 'name',
        type: EditFieldType.TEXT,
    },
    {
        title: _("Type"),
        tag: 'type',
        type: -1,
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
        type: EditFieldType.ADDRESS,
    }
];

const CONTACT_FIELDS = [
    { title: _("Contact"), },
    {
        title: _("Opening Hours"),
        tag: 'opening_hours',
        type: EditFieldType.TEXT,
        placeHolder: 'Mo-Fr 08:00-20:00; Sa-Su 10:00-14:00',
    },
    {
        title: _("Phone"),
        tag: 'phone',
        type: EditFieldType.TEXT,
        rewriteFunc: _osmPhoneRewriteFunc,
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
        validate: Utils.isValidWebsite,
    },
];

const ACCESSIBILITY_FIELDS = [
    { title: _("Accessibility"), },
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
    },
]

const MISCELLANEOUS_FIELDS = [
    { title: _("Miscellaneous") },
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
        subtitle: _('Elevation above sea level, in meters'),
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
];

export class OSMEditDialog extends Adw.Window {
    static Response = {
        UPLOADED: 0,
        DELETED: 1,
        CANCELLED: 2,
        ERROR: 3
    };

    constructor({place, addLocation, latitude, longitude, ...params}) {
        super({...params});

        this._discard_changes = false;

        this._cancellable = new Gio.Cancellable();
        this._cancellable.connect(() => this.response = OSMEditDialog.Response.CANCELLED);

        this.connect('response', () => this._cancellable.cancel());
        this.connect('close-request', () => {
            this._show_discard_dialog();

            return !this._discard_changes;
        });

        this._typeSearchEntry.connect('changed', () => {
            let text = this._typeSearchEntry.get_text();

            if (text.length === 0) {
                this._loadAllTypes();
            }

            if (text.length >= 1) {
                let matches = OSMTypes.findMatches(text, 1000);

                this._typeList.remove_all();

                if (matches.length > 0) {
                    this._typeList.add_css_class('boxed-list');

                    for (let m of matches) {
                        let row = this._addTypeRow(m.key, m.title);

                        this._typeList.append(row);
                    }
                } else {
                    this._typeList.remove_css_class('boxed-list');
                }
            }
        });

        this._continueButton.connect('clicked', () => {
            this._navigationView.push_by_tag('upload');
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

        if (addLocation) {
            this._editorStatusPage.title = C_('dialog heading', 'Add Location');

            /* the OSMObject ID, version, and changeset ID is unknown for now */
            let newNode = GnomeMaps.OSMNode.new(0, 0, 0, longitude, latitude);
            this._loadOSMData(newNode);
            this._isEditing = true;
            this._osmType = GeocodeGlib.PlaceOsmType.NODE;
        } else {
            this._osmType = place.osmType;
            Application.osmEdit.fetchObject(place,
                                            this._onObjectFetched.bind(this),
                                            this._cancellable);
        }
    }

    _show_discard_dialog() {
        let dialog = new OSMDiscardDialog();

        dialog.set_transient_for(this);
        dialog.set_modal(true);

        dialog.present();

        dialog.connect('response', (dialog, response) => {
            if (response === 'cancel') {
                this._discard_changes = false;
            }

            if (response === 'discard') {
                this._discard_changes = true;

                this.response = OSMEditDialog.Response.CANCELLED;
                this._cancellable.cancel();

                this.destroy();
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
        }
    }

    _onObjectUploaded(success, status) {
        this.close();

        if (success) {
            this.response = OSMEditDialog.Response.UPLOADED;
            this.transient_for.showToast(_('Changes successfully submitted'));
        } else {
            this._showError(status);
            this.response = OSMEditDialog.Response.ERROR;
        }
    }

    _showError(status, error) {
        /* set error message from specific error if available, otherwise use
         * a generic error message for the HTTP status code */
        let statusMessage =
            error ? error.message : OSMConnection.getStatusMessage(status);

        this.transient_for.showToast(statusMessage);
        this.response = OSMEditDialog.Response.ERROR;
    }

    _loadAllTypes() {
        this._typeList.remove_all();

        this._typeList.append(this._noneRow);

        let map = OSMTypes.getAllTypes();

        for (let tag in map) {
            for (let i in tag) {
                if (map[tag][i] === undefined) {
                    continue;
                }

                let row = this._addTypeRow(tag, map[tag][i]);

                this._typeList.append(row);
            }
        }
    }

    _addTypeRow(tag, title) {
        let row = new Adw.ActionRow();
        row.set_use_markup(true);

        if (title.includes('&')) {
            title = title.replace('&', '&amp;');
        }

        row.title = title ?? '';
        // Capitalizing tag name e.g aeroway -> Aeroway
        row.subtitle = tag[0].toUpperCase() + tag.substr(1);

        let toggle = new Gtk.CheckButton();
        toggle.set_valign(Gtk.Align.CENTER);

        toggle.set_group(this._noneCheckButton);

        row.add_prefix(toggle);
        row.set_activatable_widget(toggle);

        return row;
    }

    _loadType() {
        let type_tags = 0;
        let tag = null;

        this._loadAllTypes();

        OSMTypes.OSM_TYPE_TAGS.forEach((key) => {
            let value = this._osmObject.get_tag(key);

            if (value !== null) {
                type_tags += 1;
                tag = key;
            }
        });

        if (type_tags === 1) {
            let value = this._osmObject.get_tag(tag);
            let type_title = OSMTypes.lookupType(tag, value);

            this.type_title = type_title;
        }
    }

    _addOSMTypeEntry(group, category) {
        let row = new Adw.ActionRow();
        row.title = category.title;

        row.subtitle = this.type_title;

        if (this.type_title === '') {
            row.subtitle = _('Unspecified');
        }

        row.activatable = true;
        row.add_css_class('property');
        row.add_suffix(Gtk.Image.new_from_icon_name('go-next-symbolic'));

        row.connect('activated', () => {
            this._navigationView.push_by_tag('type');
        });

        group.add(row);
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
        }
    }

    _addOSMEditTextEntry(group, category, value) {
        let row = new Adw.EntryRow();
        row.title = category.title;
        row.text = value;

        if (!this.isEditing && row.text !== '') {
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
        });

        group.add(row);
    }

    _addOSMEditIntegerEntry(group, category, value, min, max) {
        let row = new Adw.SpinRow();
        row.title = category.title;
        row.subtitle = category.subtitle ?? '';

        let adjustment = new Gtk.Adjustment();
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
        });
    }

    _addOSMEditComboEntry(group, category, value) {
        let row = new Adw.ComboRow();
        row.title = category.title;

        group.add(row);

        let model = new Gtk.StringList();

        let selected = 0;

        model.append(_('Unspecified'));
        category.options.forEach((options, index) => {
            let id;
            let title;

            [id, title] = options;

            model.append(title);

            if (id === value) {
                // off by one because this index doesn't account for the 'Unspecified' option.
                selected = index + 1;
            }
        });

        row.model = model;
        row.selected = selected;

        if (value === '') {
            row.selected = 0;
        }

        row.connect('notify::selected', (row) => {
            this._osmObject.set_tag(category.tag, row.selected_item.string.toLowerCase());
        });
    }

    _addEntrySubrows(title, text) {
        let row = new Adw.EntryRow();
        row.title = title;
        row.text = text ?? '';

        return row;
    }

    _addOSMEditAddressEntry(group, category, value) {
        let street = value[0];
        let number = value[1];
        let postCode = value[2];
        let city = value[3];

        let row = new Adw.ExpanderRow();
        row.title = _('Address');

        if (this._isEditing && street !== undefined) {
            row.add_css_class('property');
        }

        let streetRow = this._addEntrySubrows(_('Street Name'), street);
        let numberRow = this._addEntrySubrows(_('Number'), number);
        let postcodeRow = this._addEntrySubrows(_('Postal code'), postCode);
        let cityRow = this._addEntrySubrows(_('City'), city);

        row.add_row(streetRow);
        row.add_row(numberRow);
        row.add_row(postcodeRow);
        row.add_row(cityRow);

        row.subtitle = `${number ?? ''} ${street ?? ''}, ${city ?? ''}`;
        if (street === undefined) {
            row.subtitle = '';
        }

        group.add(row);

        let changedFunc = (function(row, index) {
            this._osmObject.set_tag(category.subtags[index], row.text);
        }).bind(this);

        streetRow.connect('changed', changedFunc.bind(this, streetRow, 0));
        numberRow.connect('changed', changedFunc.bind(this, numberRow, 1));
        postcodeRow.connect('changed', changedFunc.bind(this, postcodeRow, 2));
        cityRow.connect('changed', changedFunc.bind(this, cityRow, 3));
    }

    _addOSMEditWikipediaEntry(group, category, value) {
        let article = value[0];
        let wikidata_tag = value[1];

        let row = new Adw.ExpanderRow();
        row.title = _('Wikipedia');

        let article_row = new Adw.EntryRow();
        article_row.title = _('Wikipedia Article');
        article_row.text = article ?? '';

        let data_row = new Adw.EntryRow();
        data_row.title = _('Wikidata Tag');
        data_row.text = wikidata_tag ?? '';

        let refresh_button = new Gtk.Button();
        refresh_button.icon_name = 'view-refresh-symbolic';
        refresh_button.tooltip_text = _('Load Wikidata tag from article name');
        refresh_button.valign = Gtk.Align.CENTER;
        refresh_button.add_css_class('flat');
        refresh_button.add_css_class('circular');

        data_row.add_suffix(refresh_button);

        row.add_row(article_row);
        row.add_row(data_row);

        group.add(row);

        article_row.connect('changed', (row) => {
            let rewrittenText =
                OSMUtils.getWikipediaOSMArticleFormatFromUrl(row.text);

            if (rewrittenText)
                row.text = rewrittenText;

            if (row.text !== '' &&
                !Wikipedia.isValidWikipedia(row.text)) {
                row.add_css_class('warning');
            } else {
                row.remove_css_class('warning');
            }

            this._osmObject.set_tag(category.subtags[0], row.text);
            refresh_button.sensitive = !!row.text;
        });

        data_row.connect('changed', (row) => {
            let rewrittenText =
                OSMUtils.getWikidataFromUrl(row.text);

            if (rewrittenText)
                row.text = rewrittenText;

            if (row.text !== '' &&
                !Wikipedia.isValidWikidata(row.text)) {
                row.add_css_class('warning');
            } else {
                row.remove_css_class('warning');
            }

            this._osmObject.set_tag(category.subtags[1], row.text);
        });

        refresh_button.connect('clicked', () => {
            Wikipedia.fetchWikidataForArticle(article,
                                              this._cancellable,
                                              (tag) => {
                if (!tag) {
                    Utils.showToastInOverlay(_("Couldn't find Wikidata tag for article"), this._overlay);
                    return;
                }

                data_row.text = tag;
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
        default:
            this._addOSMTypeEntry(group, category);
            break;
        }
    }

    _loadOSMData(osmObject) {
        this._osmObject = osmObject;
        this._loadType();

        let categories = [GENERAL_FIELDS, CONTACT_FIELDS, ACCESSIBILITY_FIELDS, MISCELLANEOUS_FIELDS];

        categories.forEach((category, index) => {
            let group = new Adw.PreferencesGroup();

            category.forEach((field, index) => {
                if (index === 0) {
                    group.title = field.title;
                    return;
                }

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

                    return;
                }

                value = osmObject.get_tag(field.tag);
                this._addOSMField(group, field, value);
            });

            this._groupsContainer.append(group);
        });

        this._navigationView.replace_with_tags(['editor']);
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
    Signals: {
        'response': { param_types: [GObject.TYPE_INT] },
    },
    InternalChildren: ['navigationView',
                       'continueButton',
                       'editorStatusPage',
                       'groupsContainer',
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
                       'noneRow'],
}, OSMEditDialog);

