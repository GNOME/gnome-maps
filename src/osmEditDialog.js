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
const OSMConnection = imports.osmConnection;
const OSMUtils = imports.osmUtils;

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
    // selection of yes|no|limited|designated
    YES_NO_LIMITED_DESIGNATED: 2
};

let _osmWikipediaRewriteFunc = function(text) {
    let wikipediaArticleFormatted = OSMUtils.getWikipediaOSMArticleFormatFromUrl(text);

    /* if the entered text is a Wikipedia link,
       substitute it with the OSM-formatted Wikipedia article tag */
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
 */
const OSM_FIELDS = [{name: _("Name"), tag: 'name', type: EditFieldType.TEXT},
            {name: _("Website"), tag: 'website', type: EditFieldType.TEXT},
            {name: _("Phone"), tag: 'phone', type: EditFieldType.TEXT,
             rewriteFunc: this._osmPhoneRewriteFunc},
            {name: _("Wikipedia"), tag: 'wikipedia', type: EditFieldType.TEXT,
             rewriteFunc: this._osmWikipediaRewriteFunc},
            {name: _("Population"), tag: 'population',
             type: EditFieldType.INTEGER},
            {name: _("Wheelchair access"), tag: 'wheelchair',
             type: EditFieldType.YES_NO_LIMITED_DESIGNATED}];


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
                        'addFieldButton'],

    _init: function(params) {
        this._place = params.place;
        delete params.place;

        /* This is a construct-only property and cannot be set by GtkBuilder */
        params.use_header_bar = true;

        this.parent(params);

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

        Application.osmEdit.fetchObject(this._place,
                                        this._onObjectFetched.bind(this),
                                        this._cancellable);
    },

    _onNextClicked: function() {
        if (this._isEditing) {
            // switch to the upload view
            this._switchToUpload();
        } else {
            // turn on spinner
            this._stack.visible_child_name = 'loading';
            this._nextButton.sensitive = false;
            this._backButton.sensitive = false;
            // upload data to OSM
            let comment = this._commentTextView.buffer.text;
            Application.osmEdit.uploadObject(this._osmObject,
                                             this._place.osmType, comment,
                                             this._onObjectUploaded.bind(this));
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
           a generic error message for the HTTP status code */
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
        for (let row = 0;; row++) {
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

    _addOSMEditLabel: function(text) {
        let label = new Gtk.Label({label: text});
        label.halign = Gtk.Align.END;
        label.get_style_context().add_class('dim-label');
        this._editorGrid.attach(label, 0, this._currentRow, 1, 1);
        label.show();
    },

    _addOSMEditTextEntry: function(text, tag, value, rewriteFunc) {
        this._addOSMEditLabel(text);

        let entry = new Gtk.Entry();
        entry.text = value;
        entry.hexpand = true;

        entry.connect('changed', (function() {
            if (rewriteFunc)
                entry.text = rewriteFunc(entry.text);
            this._osmObject.set_tag(tag, entry.text);
            this._nextButton.sensitive = true;
        }).bind(this, tag, entry));

        this._editorGrid.attach(entry, 1, this._currentRow, 1, 1);
        entry.show();

        /* TODO: should we allow deleting the name field? */
        this._addOSMEditDeleteButton(tag);

        this._currentRow++;
    },

    _addOSMEditIntegerEntry: function(text, tag, value) {
        this._addOSMEditLabel(text);

        let spinbutton = Gtk.SpinButton.new_with_range(0, 1e9, 1);
        spinbutton.value = value;
        spinbutton.numeric = true;
        spinbutton.hexpand = true;
        spinbutton.connect('changed', (function() {
            this._osmObject.set_tag(tag, spinbutton.text);
            this._nextButton.sensitive = true;
        }).bind(this, tag, spinbutton));

        this._editorGrid.attach(spinbutton, 1, this._currentRow, 1, 1);
        spinbutton.show();

        this._addOSMEditDeleteButton(tag);
        this._currentRow++;
    },

    _addOSMEditYesNoLimitedDesignated: function(text, tag, value) {
        this._addOSMEditLabel(text);

        let combobox = new Gtk.ComboBoxText();

        combobox.append('yes', _("Yes"));
        combobox.append('no', _("No"));
        combobox.append('limited', _("Limited"));
        combobox.append('designated', _("Designated"));

        combobox.active_id = value;
        combobox.hexpand = true;
        combobox.connect('changed', (function() {
        this._osmObject.set_tag(tag, combobox.active_id);
            this._nextButton.sensitive = true;
        }).bind(this, tag, combobox));

        this._editorGrid.attach(combobox, 1, this._currentRow, 1, 1);
        combobox.show();

        this._addOSMEditDeleteButton(tag);
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
            let label = fieldSpec.name;
            let tag = fieldSpec.tag;
            let value = this._osmObject.get_tag(tag);
            let type = fieldSpec.type;
            let rewriteFunc = fieldSpec.rewriteFunc;

            if (value === null) {
                let button = new Gtk.Button({
                    visible: true, sensitive: true,
                    label: label
                });
                button.get_style_context().add_class('menuitem');
                button.get_style_context().add_class('button');
                button.get_style_context().add_class('flat');

                button.connect('clicked', (function() {
                    this._addFieldButton.active = false;
                    this._addOSMField(label, tag, '', type, rewriteFunc);
                    /* add a "placeholder" empty OSM tag to keep the add field
                       menu updated, these tags will be filtered out if nothing
                       is entered */
                    this._osmObject.set_tag(tag, '');
                    this._updateAddFieldMenu();
                }).bind(this, label, tag, type, rewriteFunc));

                hasAllFields = false;
                this._addFieldPopoverGrid.add(button);
            }
        }

        /* update sensitiveness of the add details button, set it as
           insensitive if all tags we support editing is already present */
        this._addFieldButton.sensitive = !hasAllFields;
    },

    _addOSMField: function(label, tag, value, type, rewriteFunc) {
        switch (type) {
        case EditFieldType.TEXT:
            this._addOSMEditTextEntry(label, tag, value, rewriteFunc);
            break;
        case EditFieldType.INTEGER:
            this._addOSMEditIntegerEntry(label, tag, value);
            break;
        case EditFieldType.YES_NO_LIMITED_DESIGNATED:
            this._addOSMEditYesNoLimitedDesignated(label, tag, value);
            break;
        }
    },

    _loadOSMData: function(osmObject, osmType) {
        this._osmObject = osmObject;
        this._osmType = osmType;

        /* keeps track of the current insertion row in the grid for editing
           widgets */
        this._currentRow = 0;

        /* create edit widgets */
        for (let i = 0; i < OSM_FIELDS.length; i++) {
            let fieldSpec = OSM_FIELDS[i];
            let name = fieldSpec.name;
            let tag = fieldSpec.tag;
            let type = fieldSpec.type;
            let rewriteFunc = fieldSpec.rewriteFunc;
            let value = osmObject.get_tag(tag);

            if (value != null)
                this._addOSMField(name, tag, value, type, rewriteFunc);
        }

        this._updateAddFieldMenu();
        this._stack.visible_child_name = 'editor';
    }
});
