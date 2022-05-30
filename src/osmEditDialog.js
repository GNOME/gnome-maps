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
import Soup from 'gi://Soup';

import {Application} from './application.js';
import GnomeMaps from 'gi://GnomeMaps';
import {OSMConnection} from './osmConnection.js';
import * as OSMTypes from './osmTypes.js';
import {OSMTypeSearchEntry} from './osmTypeSearchEntry.js';
import * as OSMUtils from './osmUtils.js';
import * as Utils from './utils.js';
import * as Wikipedia from './wikipedia.js';

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
    ADDRESS:          4
};

const _WIKI_BASE = 'https://wiki.openstreetmap.org/wiki/Key:';

var _osmWikipediaRewriteFunc = function(text) {
    let wikipediaArticleFormatted = OSMUtils.getWikipediaOSMArticleFormatFromUrl(text);

    /* if the entered text is a Wikipedia link,
     * substitute it with the OSM-formatted Wikipedia article tag */
    if (wikipediaArticleFormatted)
        return wikipediaArticleFormatted;
    else
        return text;
};

/* Reformat a phone number string if it looks like a tel: URI
 * strip off the leading tel: protocol string and trailing parameters,
 * following a ;
 * otherwise return the string unmodified */
var _osmPhoneRewriteFunc = function(text) {
    if (GLib.uri_parse_scheme(text) === 'tel') {
        let afterTel = text.replace('tel:', '');

        return Soup.uri_decode(afterTel.split(';')[0]);
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

        return Soup.uri_decode(afterMailto.split('?')[0]);
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
        name: _("Name"),
        tag: 'name',
        type: EditFieldType.TEXT,
        hint: _("The official name. This is typically what appears on signs.")
    },
    {
        name: _("Address"),
        tag: 'addr',
        subtags: ['addr:street', 'addr:housenumber',
                  'addr:postcode', 'addr:city'],
        type: EditFieldType.ADDRESS,
        rows: 2
    },
    {
        name: _("Website"),
        tag: 'website',
        type: EditFieldType.TEXT,
        validate: Utils.isValidWebsite,
        validateError: _("This is not a valid URL. Make sure to include http:// or https://."),
        hint: _("The official website. Try to use the most basic form " +
                "of a URL i.e. http://example.com instead of " +
                "http://example.com/index.html.")
    },
    {
        name: _("Phone"),
        tag: 'phone',
        type: EditFieldType.TEXT,
        rewriteFunc: _osmPhoneRewriteFunc,
        hint: _("Phone number. Use the international format, " +
                "starting with a + sign. Beware of local privacy " +
                "laws, especially for private phone numbers.")
    },
    {
        name: _("E-mail"),
        tag: 'email',
        type: EditFieldType.TEXT,
        validate: Utils.isValidEmail,
        rewriteFunc: _osmEmailRewriteFunc,
        validateError: _("This is not a valid e-mail address. Make sure to not include the mailto: protocol prefix."),
        hint: _("Contact e-mail address for inquiries. " +
                "Add only email addresses that are intended to be publicly used.")
    },
    {
        name: _("Wikipedia"),
        tag: 'wikipedia',
        type: EditFieldType.TEXT,
        validate: Wikipedia.isValidWikipedia,
        rewriteFunc: _osmWikipediaRewriteFunc,
        hint: _("The format used should include the language code " +
                "and the article title like “en:Article title”.")
    },
    {
        name: _("Opening hours"),
        tag: 'opening_hours',
        type: EditFieldType.TEXT,
        placeHolder: 'Mo-Fr 08:00-20:00; Sa-Su 10:00-14:00',
        includeHelp: true,
        hint: _("See the link in the label for help on format.")
    },
    {
        name: _("Population"),
        tag: 'population',
        type: EditFieldType.UNSIGNED_INTEGER
    },
    {
        name: _("Altitude"),
        tag: 'ele',
        type: EditFieldType.INTEGER,
        hint: _("Elevation (height above sea level) of a point in metres.")
    },
    {
        name: _("Wheelchair access"),
        tag: 'wheelchair',
        type: EditFieldType.COMBO,
        options: [['yes', _("Yes")],
                  ['no', _("No")],
                  ['limited', _("Limited")],
                  ['designated', _("Designated")]]
    },
    {
        name: _("Internet access"),
        tag: 'internet_access',
        type: EditFieldType.COMBO,
        options: [['yes', _("Yes")],
                  ['no', _("No")],
                  ['wlan', _("Wi-Fi")],
                  ['wired', _("Wired")],
                  ['terminal', _("Terminal")],
                  ['service', _("Service")]]
    },
    {
        name: _("Takeaway"),
        tag:  'takeaway',
        type: EditFieldType.COMBO,
        options: [['yes', _("Yes")],
                  ['no', _("No")],
                  ['only', _("Only")]]
    },
    {
        name: _("Religion"),
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
        name: _("Toilets"),
        tag: 'toilets',
        type: EditFieldType.COMBO,
        options: [['yes', _("Yes")],
                  ['no', _("No")]]
    },
    {
        name: _("Note"),
        tag: 'note',
        type: EditFieldType.TEXT,
        hint: _("Information used to inform other mappers about non-obvious information about an element, the author’s intent when creating it, or hints for further improvement.")
    }];

export class OSMEditAddress extends Gtk.Grid {

    constructor(params) {
        let street = params.street;
        delete params.street;

        let number = params.number;
        delete params.number;

        let postCode = params.postCode;
        delete params.postCode;

        let city = params.city;
        delete params.city;

        super(params);

        if (street)
            this.street.text = street;

        if (number)
            this.number.text = number;

        if (postCode)
            this.post.text = postCode;

        if (city)
            this.city.text = city;
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/osm-edit-address.ui',
    Children: [ 'street',
                'number',
                'post',
                'city' ],
}, OSMEditAddress);

export class OSMEditDialog extends Gtk.Dialog {

    static Response = {
        UPLOADED: 0,
        DELETED: 1,
        CANCELLED: 2,
        ERROR: 3
    };

    constructor(params) {
        let place = params.place;
        delete params.place;

        let addLocation = params.addLocation;
        delete params.addLocation;

        let latitude = params.latitude;
        delete params.latitude;

        let longitude = params.longitude;
        delete params.longitude;

        /* This is a construct-only property and cannot be set by GtkBuilder */
        params.use_header_bar = true;

        super(params);

        /* I could not get this widget working from within the widget template
         * this results in a segfault. The widget definition is left in-place,
         * but commented-out in the template file */
        this._typeSearch = new OSMTypeSearchEntry();
        this._typeSearchGrid.attach(this._typeSearch, 0, 0, 1, 1);
        this._typeSearch.visible = true;
        this._typeSearch.can_focus = true;

        let typeSearchPopover = this._typeSearch.popover;
        typeSearchPopover.connect('selected', (o, k, v, t) => {
            this._onTypeSelected(o, k, v, t);
        });

        this._cancellable = new Gio.Cancellable();
        this._cancellable.connect(() => this.response(Response.CANCELLED));

        this.connect('delete-event', () => this._cancellable.cancel());

        this._isEditing = false;
        this._nextButton.connect('clicked', () => this._onNextClicked());
        this._cancelButton.connect('clicked', () => this._onCancelClicked());
        this._backButton.connect('clicked', () => this._onBackClicked());
        this._typeButton.connect('clicked', () => this._onTypeClicked());

        if (addLocation) {
            this._headerBar.title = C_("dialog title", "Add to OpenStreetMap");
            this._typeLabel.visible = true;
            this._typeButton.visible = true;

            /* the OSMObject ID, version, and changeset ID is unknown for now */
            let newNode =
                GnomeMaps.OSMNode.new(0, 0, 0, longitude, latitude);
            /* set a placeholder name tag to always get a name entry for new
             * locations */
            newNode.set_tag('name', '');
            this._loadOSMData(newNode);
            this._isEditing = true;
            this._osmType = GeocodeGlib.PlaceOsmType.NODE;
        } else {
            this._osmType = place.osmType;
            Application.osmEdit.fetchObject(place,
                                            this._onObjectFetched.bind(this),
                                            this._cancellable);
        }

        /* store original title of the dialog to be able to restore it when
         * coming back from type selection */
        this._originalTitle = this._headerBar.title;
        this._updateRecentTypesList();

        this._recentTypesListBox.set_header_func((row, previous) => {
            if (previous)
                row.set_header(new Gtk.Separator());
        });

        this._recentTypesListBox.connect('row-activated', (listbox, row) => {
            this._onTypeSelected(null, row._key, row._value, row._title);
        });
    }

    _onNextClicked() {
        if (this._isEditing) {
            this._switchToUpload();
        } else {
            this._stack.visible_child_name = 'loading';
            this._nextButton.sensitive = false;
            this._backButton.sensitive = false;

            let comment = this._commentTextView.buffer.text;
            Application.osmEdit.uploadObject(this._osmObject,
                                             this._osmType, comment,
                                             this._onObjectUploaded.bind(this));
        }
    }

    _onTypeClicked() {
        this._cancelButton.visible = false;
        this._backButton.visible = true;
        this._nextButton.visible = false;
        this._headerBar.title = _("Select Type");
        this._stack.visible_child_name = 'select-type';
    }

    _onTypeSelected(popover, key, value, title) {
        this._typeValueLabel.label = title;
        this._updateType(key, value);

        if (popover)
            popover.hide();

        /* clear out type search entry */
        this._typeSearch.text = '';

        /* go back to the editing stack page */
        this._backButton.visible = false;
        this._cancelButton.visible = true;
        this._nextButton.visible = true;
        this._stack.visible_child_name = 'editor';
        this._headerBar.title = this._originalTitle;

        /* update recent types store */
        OSMTypes.recentTypesStore.pushType(key, value);

        /* enable the Next button, so that it's possible to just change the type
         * of an object without changing anything else */
        this._nextButton.sensitive = true;

        this._updateRecentTypesList();
    }

    _updateType(key, value) {
        /* clear out any previous type-related OSM tags */
        OSMTypes.OSM_TYPE_TAGS.forEach((tag) => this._osmObject.delete_tag(tag));

        this._osmObject.set_tag(key, value);
    }

    /* update visibility and enable the type selection button if the object has
     * a well-known type (based on a known set of tags) */
    _updateTypeButton() {
        let numTypeTags = 0;
        let lastTypeTag = null;

        for (let i = 0; i < OSMTypes.OSM_TYPE_TAGS.length; i++) {
            let key = OSMTypes.OSM_TYPE_TAGS[i];
            let value = this._osmObject.get_tag(key);

            if (value != null) {
                numTypeTags++;
                lastTypeTag = key;
            }
        }

        /* if the object has none of tags set, enable the button and keep the
         * pre-set "None" label */
        if (numTypeTags === 0) {
            this._typeLabel.visible = true;
            this._typeButton.visible = true;
        } else if (numTypeTags === 1) {
            let value = this._osmObject.get_tag(lastTypeTag);
            let typeTitle = OSMTypes.lookupType(lastTypeTag, value);

            /* if the type tag has a value we know of, and possible has
             * translations for */
            if (typeTitle != null) {
                this._typeValueLabel.label = typeTitle;
                this._typeLabel.visible = true;
                this._typeButton.visible = true;
            }
        }
    }

    _updateRecentTypesList() {
        let recentTypes = OSMTypes.recentTypesStore.recentTypes;

        if (recentTypes.length > 0) {
            let children = this._recentTypesListBox.get_children();

            for (let i = 0; i < children.length; i++) {
                this._recentTypesListBox.remove(children[i]);
            }

            this._recentTypesLabel.visible = true;
            this._recentTypesListBox.visible = true;

            for (let i = 0; i < recentTypes.length; i++) {
                let key = recentTypes[i].key;
                let value = recentTypes[i].value;
                let title = OSMTypes.lookupType(key, value);

                let grid = new Gtk.Grid({visible: true,
                                         margin_top: 6, margin_bottom: 6,
                                         margin_start: 12, margin_end: 12});
                let label = new Gtk.Label({visible: true, halign: Gtk.Align.START,
                                           label: title});

                label.get_style_context().add_class('dim-label');

                grid.attach(label, 0, 0, 1, 1);

                this._recentTypesListBox.insert(grid, -1);

                let row = this._recentTypesListBox.get_row_at_index(i);

                row._title = title;
                row._key = key;
                row._value = value;
            }
        } else {
            this._recentTypesLabel.visible = false;
            this._recentTypesListBox.visible = false;
        }
    }

    _switchToUpload() {
        this._stack.set_visible_child_name('upload');
        this._nextButton.label = _("Done");
        this._cancelButton.visible = false;
        this._backButton.visible = true;
        this._cancelButton.visible = false;
        this._isEditing = false;
        this._commentTextView.grab_focus();
    }

    _onCancelClicked() {
        this.response(OSMEditDialog.Response.CANCELLED);
    }

    _onBackClicked() {
        this._backButton.visible = false;
        this._cancelButton.visible = true;
        this._nextButton.visible = true;
        this._nextButton.label = _("Next");
        this._stack.set_visible_child_name('editor');
        this._isEditing = true;
        this._commentTextView.buffer.text = '';
        this._typeSearch.text = '';
        this._headerBar.title = this._originalTitle;
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
        if (success) {
            this.response(OSMEditDialog.Response.UPLOADED);
        } else {
            this._showError(status);
            this.response(Response.ERROR);
        }
    }

    _showError(status, error) {
        /* set error message from specific error if available, otherwise use
         * a generic error message for the HTTP status code */
        let statusMessage =
            error ? error.message : OSMConnection.getStatusMessage(status);
        let messageDialog =
            new Gtk.MessageDialog({ transient_for: this.get_toplevel(),
                                    destroy_with_parent: true,
                                    message_type: Gtk.MessageType.ERROR,
                                    buttons: Gtk.ButtonsType.OK,
                                    modal: true,
                                    text: _("An error has occurred"),
                                    secondary_text: statusMessage });

        messageDialog.run();
        messageDialog.destroy();
        this.response(Response.ERROR);
    }

    /* GtkContainer.child_get_property doesn't seem to be usable from GJS */
    _getRowOfDeleteButton(button) {
        for (let row = 1; row < this._currentRow; row++) {
            let label = this._editorGrid.get_child_at(0, row);
            let deleteButton = this._editorGrid.get_child_at(2, row);

            if (deleteButton === button)
                return row;
        }

        return -1;
    }

    _addOSMEditDeleteButton(fieldSpec) {
        let deleteButton = Gtk.Button.new_from_icon_name('user-trash-symbolic',
                                                         Gtk.IconSize.BUTTON);
        let styleContext = deleteButton.get_style_context();
        let rows = fieldSpec.rows || 1;

        styleContext.add_class('flat');
        this._editorGrid.attach(deleteButton, 2, this._currentRow, 1, 1);

        deleteButton.connect('clicked', () => {
            if (fieldSpec.subtags) {
                fieldSpec.subtags.forEach((key) => this._osmObject.delete_tag(key));
            } else {
                this._osmObject.delete_tag(fieldSpec.tag);
            }

            let row = this._getRowOfDeleteButton(deleteButton);
            for (let i = 0; i < rows; i++) {
                this._editorGrid.remove_row(row);
                this._currentRow--;
            }
            this._nextButton.sensitive = true;
            this._updateAddFieldMenu();
        });

        deleteButton.show();
    }

    _addOSMEditLabel(fieldSpec) {
        let text = fieldSpec.name;
        if (fieldSpec.includeHelp) {
            let link = _WIKI_BASE + fieldSpec.tag;
            text = '<a href="%s" title="%s">%s</a>'.format(link, link, text);
        }
        let label = new Gtk.Label({ label: text,
                                    use_markup: true });
        label.halign = Gtk.Align.END;
        label.get_style_context().add_class('dim-label');
        this._editorGrid.attach(label, 0, this._currentRow, 1, 1);
        label.show();
    }

    _showHintPopover(entry, hint) {
        if (this._hintPopover.visible) {
            this._hintPopover.popdown();
        } else {
            this._hintPopover.relative_to = entry;
            this._hintLabel.label = hint;
            this._hintPopover.popup();
        }
    }

    _validateTextEntry(fieldSpec, entry) {
        if (fieldSpec.validate) {
            /* also allow empty text without showing the validation warning,
             * since we want to allow clearing out the text to unset a value
             * (equivalent to using the delete button).
             */
            if (entry.text !== '' && !fieldSpec.validate(entry.text)) {
                entry.get_style_context().add_class("warning");
            } else {
                entry.get_style_context().remove_class("warning");
            }
        }
    }

    _addOSMEditTextEntry(fieldSpec, value) {
        this._addOSMEditLabel(fieldSpec);

        let entry = new Gtk.Entry();
        entry.text = value;
        entry.hexpand = true;
        if (fieldSpec.placeHolder)
            entry.placeholder_text = fieldSpec.placeHolder;

        entry.connect('changed', () => {
            if (fieldSpec.rewriteFunc)
                entry.text = fieldSpec.rewriteFunc(entry.text);
            this._osmObject.set_tag(fieldSpec.tag, entry.text);

            this._validateTextEntry(fieldSpec, entry);

            this._nextButton.sensitive = true;
        });

        this._validateTextEntry(fieldSpec, entry);

        if (fieldSpec.hint) {
            entry.secondary_icon_name = 'dialog-information-symbolic';
            entry.connect('icon-press', (entry, iconPos, event) => {
                if (fieldSpec.validate && entry.text !== '' &&
                    !fieldSpec.validate(entry.text)) {
                    this._showHintPopover(entry, fieldSpec.validateError);
                } else {
                    this._showHintPopover(entry, fieldSpec.hint);
                }
            });
        }

        this._editorGrid.attach(entry, 1, this._currentRow, 1, 1);
        entry.show();
        entry.grab_focus();

        /* TODO: should we allow deleting the name field? */
        this._addOSMEditDeleteButton(fieldSpec);

        this._currentRow++;
    }

    _addOSMEditIntegerEntry(fieldSpec, value, min, max) {
        this._addOSMEditLabel(fieldSpec);

        let spinbutton = Gtk.SpinButton.new_with_range(min, max, 1);
        spinbutton.value = value;
        spinbutton.numeric = true;
        spinbutton.hexpand = true;
        spinbutton.connect('changed', () => {
            this._osmObject.set_tag(fieldSpec.tag, spinbutton.text);
            this._nextButton.sensitive = true;
        });

        if (fieldSpec.hint) {
            spinbutton.secondary_icon_name = 'dialog-information-symbolic';
            spinbutton.connect('icon-press', (iconPos, event) => {
                this._showHintPopover(spinbutton, fieldSpec.hint);
            });
        }

        this._editorGrid.attach(spinbutton, 1, this._currentRow, 1, 1);
        spinbutton.show();
        spinbutton.grab_focus();

        this._addOSMEditDeleteButton(fieldSpec);
        this._currentRow++;
    }

    _addOSMEditComboEntry(fieldSpec, value) {
        this._addOSMEditLabel(fieldSpec);

        let combobox = new Gtk.ComboBoxText();

        fieldSpec.options.forEach(function(option) {
            combobox.append(option[0], option[1]);
        });
        combobox.active_id = value;
        combobox.hexpand = true;
        combobox.connect('changed', () => {
            this._osmObject.set_tag(fieldSpec.tag, combobox.active_id);
            this._nextButton.sensitive = true;
        });

        this._editorGrid.attach(combobox, 1, this._currentRow, 1, 1);
        combobox.show();
        combobox.grab_focus();

        this._addOSMEditDeleteButton(fieldSpec);
        this._currentRow++;
    }

    _addOSMEditAddressEntry(fieldSpec, value) {
        this._addOSMEditLabel(fieldSpec);

        let addr = new OSMEditAddress({ street: value[0],
                                        number: value[1],
                                        postCode: value[2],
                                        city: value[3] });
        let changedFunc = (function(entry, index) {
            this._osmObject.set_tag(fieldSpec.subtags[index], entry.text);
            this._nextButton.sensitive = true;
        }).bind(this);

        addr.street.connect('changed', changedFunc.bind(this, addr.street, 0));
        addr.number.connect('changed', changedFunc.bind(this, addr.number, 1));
        addr.post.connect('changed', changedFunc.bind(this, addr.post, 2));
        addr.city.connect('changed', changedFunc.bind(this, addr.city, 3));

        let rows = fieldSpec.rows || 1;
        this._editorGrid.attach(addr, 1, this._currentRow, 1, rows);
        addr.street.grab_focus();
        this._addOSMEditDeleteButton(fieldSpec);
        this._currentRow += rows;
    }

    /* update visible items in the "Add Field" popover */
    _updateAddFieldMenu() {
        /* clear old items */
        let children = this._addFieldPopoverGrid.get_children();
        let hasAllFields = true;

        for (let i = 0; i < children.length; i++) {
            let button = children[i];
            button.destroy();
        }

        /* add selectable items */
        let row = 0;
        for (let i = 0; i < OSM_FIELDS.length; i++) {
            let fieldSpec = OSM_FIELDS[i];
            let hasValue = false;

            if (fieldSpec.subtags) {
                fieldSpec.subtags.forEach((tag) => {
                    if (this._osmObject.get_tag(tag) !== null)
                        hasValue = true;
                });
            } else {
                hasValue = this._osmObject.get_tag(fieldSpec.tag) !== null;
            }

            if (!hasValue) {
                let button = new Gtk.Button({
                    visible: true, sensitive: true,
                    label: fieldSpec.name
                });
                button.get_style_context().add_class('menuitem');
                button.get_style_context().add_class('button');
                button.get_style_context().add_class('flat');
                button.get_child().halign = Gtk.Align.START;

                button.connect('clicked', () => {
                    this._addFieldButton.active = false;
                    this._addOSMField(fieldSpec);
                    /* add a "placeholder" empty OSM tag to keep the add field
                     * menu updated, these tags will be filtered out if nothing
                     * is entered */
                    if (fieldSpec.subtags) {
                        fieldSpec.subtags.forEach((tag) => {
                            this._osmObject.set_tag(tag, '');
                        });
                    } else {
                        this._osmObject.set_tag(fieldSpec.tag, '');
                    }
                    this._updateAddFieldMenu();
                });

                hasAllFields = false;
                this._addFieldPopoverGrid.attach(button, 0, row, 1, 1);
                row++;
            }
        }

        this._addFieldButton.sensitive = !hasAllFields;
    }

    _addOSMField(fieldSpec, value) {
        switch (fieldSpec.type) {
        case EditFieldType.TEXT:
            this._addOSMEditTextEntry(fieldSpec, value || '');
            break;
        case EditFieldType.INTEGER:
            this._addOSMEditIntegerEntry(fieldSpec, value || 0, -1e9, 1e9);
            break;
        case EditFieldType.UNSIGNED_INTEGER:
            this._addOSMEditIntegerEntry(fieldSpec, value || 0, 0, 1e9);
            break;
        case EditFieldType.COMBO:
            this._addOSMEditComboEntry(fieldSpec, value || '');
            break;
        case EditFieldType.ADDRESS:
            this._addOSMEditAddressEntry(fieldSpec, value || '');
            break;
        }
    }

    _loadOSMData(osmObject) {
        this._osmObject = osmObject;

        /* keeps track of the current insertion row in the grid for editing
         * widgets */
        this._currentRow = 1;

        for (let i = 0; i < OSM_FIELDS.length; i++) {
            let fieldSpec = OSM_FIELDS[i];
            let value;

            if (fieldSpec.subtags) {
                let hasAny = false;
                fieldSpec.subtags.forEach(function(tag) {
                    if (osmObject.get_tag(tag) != null)
                        hasAny = true;
                });

                if (hasAny) {
                    value = fieldSpec.subtags.map(function(tag) {
                        return osmObject.get_tag(tag);
                    });
                    this._addOSMField(fieldSpec, value);
                }
            } else {
                value = osmObject.get_tag(fieldSpec.tag);
                if (value != null)
                    this._addOSMField(fieldSpec, value);
            }
        }

        this._updateAddFieldMenu();
        this._updateTypeButton();
        this._stack.visible_child_name = 'editor';
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/osm-edit-dialog.ui',
    InternalChildren: [ 'cancelButton',
                        'backButton',
                        'nextButton',
                        'stack',
                        'editorGrid',
                        'commentTextView',
                        'addFieldPopoverGrid',
                        'addFieldButton',
                        'typeSearchGrid',
                        'typeLabel',
                        'typeButton',
                        'typeValueLabel',
                        'recentTypesLabel',
                        'recentTypesListBox',
                        'hintPopover',
                        'hintLabel',
                        'headerBar'],
}, OSMEditDialog);
