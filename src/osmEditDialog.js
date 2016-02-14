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

const _ = imports.gettext.gettext;

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Application = imports.application;
const Maps = imports.gi.GnomeMaps;
const OSMConnection = imports.osmConnection;
const OSMTypes = imports.osmTypes;
const OSMTypeSearchEntry = imports.osmTypeSearchEntry;
const OSMUtils = imports.osmUtils;
const Utils = imports.utils;

const Response = {
    UPLOADED: 0,
    DELETED: 1,
    CANCELLED: 2,
    ERROR: 3
};

/*
 * enumeration representing
 * the different OSM editing
 * field types
 */
const EditFieldType = {
    TEXT: 0,
    INTEGER: 1,
    COMBO: 2
};

const _WIKI_BASE = 'http://wiki.openstreetmap.org/wiki/Key:';

let _osmWikipediaRewriteFunc = function(text) {
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
let _osmPhoneRewriteFunc = function(text) {
    if (GLib.uri_parse_scheme(text) === 'tel') {
        let afterTel = text.replace('tel:', '');

        return afterTel.split(';')[0];
    } else {
        return text;
    }
};

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
 */
const OSM_FIELDS = [
    {
        name: _("Name"),
        tag: 'name',
        type: EditFieldType.TEXT
    },
    {
        name: _("Website"),
        tag: 'website',
        type: EditFieldType.TEXT
    },
    {
        name: _("Phone"),
        tag: 'phone',
        type: EditFieldType.TEXT,
        rewriteFunc: this._osmPhoneRewriteFunc
    },
    {
        name: _("Wikipedia"),
        tag: 'wikipedia',
        type: EditFieldType.TEXT,
        rewriteFunc: this._osmWikipediaRewriteFunc},
    {
        name: _("Opening hours"),
        tag: 'opening_hours',
        type: EditFieldType.TEXT,
        placeHolder: 'Mo-Fr 08:00-20:00; Sa-Su 10:00-14:00',
        includeHelp: true
    },
    {
        name: _("Population"),
        tag: 'population',
        type: EditFieldType.INTEGER
    },
    {
        name: _("Wheelchair access"),
        tag: 'wheelchair',
        type: EditFieldType.COMBO,
        combo: [['yes', _("Yes")],
                ['no', _("No")],
                ['limited', _("Limited")],
                ['designated', _("Designated")]]
    },
    {
        name: _("Internet access"),
        tag: 'internet_access',
        type: EditFieldType.COMBO,
        combo: [['yes', _("Yes")],
                ['no', _("No")],
                ['wlan', _("Wlan")],
                ['wired', _("Wired")],
                ['terminal', _("Terminal")],
                ['service', _("Service")]]
    }];


const OSMEditDialog = new Lang.Class({
    Name: 'OSMEditDialog',
    Extends: Gtk.Dialog,
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
                        'headerBar'],

    _init: function(params) {
        this._place = params.place;
        delete params.place;

        this._addLocation = params.addLocation;
        delete params.addLocation;

        this._latitude = params.latitude;
        delete params.latitude;

        this._longitude = params.longitude;
        delete params.longitude;

        /* This is a construct-only property and cannot be set by GtkBuilder */
        params.use_header_bar = true;

        this.parent(params);

        /* I could not get this widget working from within the widget template
         * this results in a segfault. The widget definition is left in-place,
         * but commented-out in the template file */
        this._typeSearch = new OSMTypeSearchEntry.OSMTypeSearchEntry();
        this._typeSearchGrid.attach(this._typeSearch, 0, 0, 1, 1);
        this._typeSearch.visible = true;
        this._typeSearch.can_focus = true;

        let typeSearchPopover = this._typeSearch.popover;
        typeSearchPopover.connect('selected', this._onTypeSelected.bind(this));

        this._cancellable = new Gio.Cancellable();
        this._cancellable.connect((function() {
            this.response(Response.CANCELLED);
        }).bind(this));

        this.connect('delete-event', (function() {
            this._cancellable.cancel();
        }).bind(this));

        this._isEditing = false;
        this._nextButton.connect('clicked', this._onNextClicked.bind(this));
        this._cancelButton.connect('clicked', this._onCancelClicked.bind(this));
        this._backButton.connect('clicked', this._onBackClicked.bind(this));
        this._typeButton.connect('clicked', this._onTypeClicked.bind(this));

        if (this._addLocation) {
            this._headerBar.title = _("Add to OpenStreetMap");
            this._typeLabel.visible = true;
            this._typeButton.visible = true;

            /* the OSMObject ID, version, and changeset ID is unknown for now */
            let newNode =
                Maps.OSMNode.new(0, 0, 0, this._longitude, this._latitude);
            /* set a placeholder name tag to always get a name entry for new
             * locations */
            newNode.set_tag('name', '');
            this._loadOSMData(newNode);
            this._isEditing = true;
        } else {
            this._osmType = this._place.osmType;
            Application.osmEdit.fetchObject(this._place,
                                            this._onObjectFetched.bind(this),
                                            this._cancellable);
        }

        /* store original title of the dialog to be able to restore it when
         * coming back from type selection */
        this._originalTitle = this._headerBar.title;
        this._updateRecentTypesList();

        this._recentTypesListBox.set_header_func(function (row, previous) {
            row.set_header(new Gtk.Separator());
        });

        this._recentTypesListBox.connect('row-activated', (function(listbox, row) {
            this._onTypeSelected(null, row._key, row._value, row._title);
        }).bind(this));
    },

    _onNextClicked: function() {
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
    },

    _onTypeClicked: function() {
        this._cancelButton.visible = false;
        this._backButton.visible = true;
        this._headerBar.title = _("Select Type");
        this._stack.visible_child_name = 'select-type';
    },

    _onTypeSelected: function(popover, key, value, title) {
        this._typeValueLabel.label = title;
        this._updateType(key, value);

        if (popover)
            popover.hide();

        /* clear out type search entry */
        this._typeSearch.text = '';

        /* go back to the editing stack page */
        this._backButton.visible = false;
        this._cancelButton.visible = true;
        this._stack.visible_child_name = 'editor';
        this._headerBar.title = this._originalTitle;

        /* update recent types store */
        OSMTypes.recentTypesStore.pushType(key, value);

        /* enable the Next button, so that it's possible to just change the type
         * of an object without changing anything else */
        this._nextButton.sensitive = true;

        this._updateRecentTypesList();
    },

    _updateType: function(key, value) {
        /* clear out any previous type-related OSM tags */
        OSMTypes.OSM_TYPE_TAGS.forEach((function (tag) {
            this._osmObject.delete_tag(tag);
        }).bind(this));

        this._osmObject.set_tag(key, value);
    },

    /* update visibility and enable the type selection button if the object has
     * a well-known type (based on a known set of tags) */
    _updateTypeButton: function() {
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
    },

    _updateRecentTypesList: function() {
        let recentTypes = OSMTypes.recentTypesStore.recentTypes;

        if (recentTypes.length > 0) {
            let children = this._recentTypesListBox.get_children();

            for (let i = 0; i < children.length; i++) {
                children[i].destroy();
            }

            this._recentTypesLabel.visible = true;
            this._recentTypesListBox.visible = true;

            for (let i = 0; i < recentTypes.length; i++) {
                let key = recentTypes[i].key;
                let value = recentTypes[i].value;
                let title = OSMTypes.lookupType(key, value);

                let row = new Gtk.ListBoxRow({visible: true, hexpand: true});
                let grid = new Gtk.Grid({visible: true,
                                         margin_top: 6, margin_bottom: 6,
                                         margin_start: 12, margin_end: 12});
                let label = new Gtk.Label({visible: true, halign: Gtk.Align.START,
                                           label: title});

                label.get_style_context().add_class('dim-label');

                row._title = title;
                row._key = key;
                row._value = value;

                row.add(grid);
                grid.add(label);

                this._recentTypesListBox.add(row);
            }
        } else {
            this._recentTypesLabel.visible = false;
            this._recentTypesListBox.visible = false;
        }
    },

    _switchToUpload: function() {
        this._stack.set_visible_child_name('upload');
        this._nextButton.label = _("Done");
        this._cancelButton.visible = false;
        this._backButton.visible = true;
        this._cancelButton.visible = false;
        this._isEditing = false;
    },

    _onCancelClicked: function() {
        this.response(Response.CANCELLED);
    },

    _onBackClicked: function() {
        this._backButton.visible = false;
        this._cancelButton.visible = true;
        this._nextButton.label = _("Next");
        this._stack.set_visible_child_name('editor');
        this._isEditing = true;
        this._commentTextView.buffer.text = '';
        this._typeSearch.text = '';
        this._headerBar.title = this._originalTitle;
    },

    _onObjectFetched: function(success, status, osmObject, osmType, error) {
        if (success) {
            this._isEditing = true;
            this._loadOSMData(osmObject);
        } else {
            this._showError(status, error);
        }
    },

    _onObjectUploaded: function(success, status) {
        if (success) {
            this.response(Response.UPLOADED);
        } else {
            this._showError(status);
            this.response(Response.ERROR);
        }
    },

    _showError: function(status, error) {
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
    },

    /* GtkContainer.child_get_property doesn't seem to be usable from GJS */
    _getRowOfDeleteButton: function(button) {
        for (let row = 1;; row++) {
            let label = this._editorGrid.get_child_at(0, row);
            let deleteButton = this._editorGrid.get_child_at(2, row);

            if (deleteButton === button)
                return row;

            /* if we reached the end of the table */
            if (label == null)
                return -1;
        }

        return -1;
    },

    _addOSMEditDeleteButton: function(tag) {
        let deleteButton = Gtk.Button.new_from_icon_name('user-trash-symbolic',
                                                         Gtk.IconSize.BUTTON);
        let styleContext = deleteButton.get_style_context();

        styleContext.add_class('flat');
        this._editorGrid.attach(deleteButton, 2, this._currentRow, 1, 1);

        deleteButton.connect('clicked', (function() {
            this._osmObject.delete_tag(tag);

            let row = this._getRowOfDeleteButton(deleteButton);
            this._editorGrid.remove_row(row);
            this._nextButton.sensitive = true;
            this._currentRow--;
            this._updateAddFieldMenu();
        }).bind(this, tag));

        deleteButton.show();
    },

    _addOSMEditLabel: function(fieldSpec) {
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
    },

    _addOSMEditTextEntry: function(fieldSpec, value) {
        this._addOSMEditLabel(fieldSpec);

        let entry = new Gtk.Entry();
        entry.text = value;
        entry.hexpand = true;
        if (fieldSpec.placeHolder)
            entry.placeholder_text = fieldSpec.placeHolder;

        entry.connect('changed', (function() {
            if (fieldSpec.rewriteFunc)
                entry.text = fieldSpec.rewriteFunc(entry.text);
            this._osmObject.set_tag(fieldSpec.tag, entry.text);
            this._nextButton.sensitive = true;
        }).bind(this));

        this._editorGrid.attach(entry, 1, this._currentRow, 1, 1);
        entry.show();

        /* TODO: should we allow deleting the name field? */
        this._addOSMEditDeleteButton(fieldSpec.tag);

        this._currentRow++;
    },

    _addOSMEditIntegerEntry: function(fieldSpec, value) {
        this._addOSMEditLabel(fieldSpec);

        let spinbutton = Gtk.SpinButton.new_with_range(0, 1e9, 1);
        spinbutton.value = value;
        spinbutton.numeric = true;
        spinbutton.hexpand = true;
        spinbutton.connect('changed', (function() {
            this._osmObject.set_tag(fieldSpec.tag, spinbutton.text);
            this._nextButton.sensitive = true;
        }).bind(this, fieldSpec.tag, spinbutton));

        this._editorGrid.attach(spinbutton, 1, this._currentRow, 1, 1);
        spinbutton.show();

        this._addOSMEditDeleteButton(fieldSpec.tag);
        this._currentRow++;
    },

    _addOSMEditComboEntry: function(fieldSpec, value) {
        this._addOSMEditLabel(fieldSpec);

        let combobox = new Gtk.ComboBoxText();

        fieldSpec.combo.forEach(function(comboField) {
            combobox.append(comboField[0], comboField[1]);
        });
        combobox.active_id = value;
        combobox.hexpand = true;
        combobox.connect('changed', (function() {
        this._osmObject.set_tag(fieldSpec.tag, combobox.active_id);
            this._nextButton.sensitive = true;
        }).bind(this, fieldSpec.tag, combobox));

        this._editorGrid.attach(combobox, 1, this._currentRow, 1, 1);
        combobox.show();

        this._addOSMEditDeleteButton(fieldSpec.tag);
        this._currentRow++;
    },

    /* update visible items in the "Add Field" popover */
    _updateAddFieldMenu: function() {
        /* clear old items */
        let children = this._addFieldPopoverGrid.get_children();
        let hasAllFields = true;

        for (let i = 0; i < children.length; i++) {
            let button = children[i];
            button.destroy();
        }

        /* add selectable items */
        for (let i = 0; i < OSM_FIELDS.length; i++) {
            let fieldSpec = OSM_FIELDS[i];
            let value = this._osmObject.get_tag(fieldSpec.tag);

            if (value === null) {
                let button = new Gtk.Button({
                    visible: true, sensitive: true,
                    label: fieldSpec.name
                });
                button.get_style_context().add_class('menuitem');
                button.get_style_context().add_class('button');
                button.get_style_context().add_class('flat');

                button.connect('clicked', (function() {
                    this._addFieldButton.active = false;
                    this._addOSMField(fieldSpec, '');
                    /* add a "placeholder" empty OSM tag to keep the add field
                     * menu updated, these tags will be filtered out if nothing
                     * is entered */
                    this._osmObject.set_tag(fieldSpec.tag, '');
                    this._updateAddFieldMenu();
                }).bind(this));

                hasAllFields = false;
                this._addFieldPopoverGrid.add(button);
            }
        }

        this._addFieldButton.sensitive = !hasAllFields;
    },

    _addOSMField: function(fieldSpec, value) {
        switch (fieldSpec.type) {
        case EditFieldType.TEXT:
            this._addOSMEditTextEntry(fieldSpec, value);
            break;
        case EditFieldType.INTEGER:
            this._addOSMEditIntegerEntry(fieldSpec, value);
            break;
        case EditFieldType.COMBO:
            this._addOSMEditComboEntry(fieldSpec, value);
            break;
        }
    },

    _loadOSMData: function(osmObject) {
        this._osmObject = osmObject;

        /* keeps track of the current insertion row in the grid for editing
         * widgets */
        this._currentRow = 1;

        for (let i = 0; i < OSM_FIELDS.length; i++) {
            let fieldSpec = OSM_FIELDS[i];
            let value = osmObject.get_tag(fieldSpec.tag);

            if (value != null)
                this._addOSMField(fieldSpec, value);
        }

        this._updateAddFieldMenu();
        this._updateTypeButton();
        this._stack.visible_child_name = 'editor';
    }
});
