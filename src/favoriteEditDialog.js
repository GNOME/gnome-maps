/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
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
 */

const _ = imports.gettext.gettext;

const Geocode = imports.gi.GeocodeGlib;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Soup = imports.gi.Soup;

const Application = imports.application;
const Maps = imports.gi.GnomeMaps;
const Place = imports.place;
const PlaceStore = imports.placeStore;
const Location = imports.location;
const Utils = imports.utils;

var MIN_ADD_LOCATION_ZOOM_LEVEL = 16;

var Response = {
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
    COMBO: 2,
    ADDRESS: 3
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
        hint: _("Assign any nickname to your favorite place")
    }
];

var FavoriteEditDialog = GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/favorite-edit-dialog.ui',
    InternalChildren: ['cancelButton',
        'saveButton',
        'stack',
        'editorGrid',
        'commentTextView',
        'hintPopover',
        'hintLabel',
        'headerBar'],
}, class FavoriteEditDialog extends Gtk.Dialog {

        _init(params) {

            this._markLocation = params.markLocation;
            delete params.markLocation;

            this._latitude = params.latitude;
            delete params.latitude;

            this._longitude = params.longitude;
            delete params.longitude;

            this._location = new Location.Location({
                latitude: this._latitude,
                longitude: this._longitude,
                accuracy: 0
            });

            this._place = new Place.Place({ location: this._location });

            /* This is a construct-only property and cannot be set by GtkBuilder */
            params.use_header_bar = true;

            super._init(params);

            this._cancellable = new Gio.Cancellable();
            this._cancellable.connect(() => this.response(Response.CANCELLED));

            this.connect('delete-event', () => this._cancellable.cancel());

            this._isEditing = false;
            this._saveButton.connect('clicked', () => this._onSaveClicked());
            this._cancelButton.connect('clicked', () => this._onCancelClicked());

            if (this._markLocation) {
                this._headerBar.title = C_("dialog title", "Mark as favorite");

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
        }

        _onSaveClicked() {
            let placeStore = Application.placeStore;
            this._place.name = this._name;
            placeStore.addPlace(this._place, PlaceStore.PlaceType.FAVORITE);
            this.response(Response.CANCELLED);
        }

        _switchToUpload() {
            this._stack.set_visible_child_name('upload');
            this._nextButton.label = _("Done");
            this._cancelButton.visible = false;
            this._isEditing = false;
            this._commentTextView.grab_focus();
        }

        _onCancelClicked() {
            this.response(Response.CANCELLED);
        }

        _showError(status, error) {
            /* set error message from specific error if available, otherwise use
             * a generic error message for the HTTP status code */
            let statusMessage =
                error ? error.message : OSMConnection.getStatusMessage(status);
            let messageDialog =
                new Gtk.MessageDialog({
                    transient_for: this.get_toplevel(),
                    destroy_with_parent: true,
                    message_type: Gtk.MessageType.ERROR,
                    buttons: Gtk.ButtonsType.OK,
                    modal: true,
                    text: _("An error has occurred"),
                    secondary_text: statusMessage
                });

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
            let label = new Gtk.Label({
                label: text,
                use_markup: true
            });
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
                this._name = entry.text;
                this._saveButton.sensitive = true;
            });

            if (fieldSpec.hint) {
                entry.secondary_icon_name = 'dialog-information-symbolic';
                entry.connect('icon-press', (entry, iconPos, event) => {
                    this._showHintPopover(entry, fieldSpec.hint);
                });
            }

            this._editorGrid.attach(entry, 1, this._currentRow, 1, 1);
            entry.show();
            entry.grab_focus();


            this._currentRow++;
        }

        _addOSMEditIntegerEntry(fieldSpec, value) {
            this._addOSMEditLabel(fieldSpec);

            let spinbutton = Gtk.SpinButton.new_with_range(0, 1e9, 1);
            spinbutton.value = value;
            spinbutton.numeric = true;
            spinbutton.hexpand = true;
            spinbutton.connect('changed', () => {
                this._osmObject.set_tag(fieldSpec.tag, spinbutton.text);
                this._name = entry.text;
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

            fieldSpec.options.forEach(function (option) {
                combobox.append(option[0], option[1]);
            });
            combobox.active_id = value;
            combobox.hexpand = true;
            combobox.connect('changed', () => {
                this._osmObject.set_tag(fieldSpec.tag, combobox.active_id);
                this._name = entry.text;
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

            let addr = new OSMEditAddress({
                street: value[0],
                number: value[1],
                postCode: value[2],
                city: value[3]
            });
            let changedFunc = (function (entry, index) {
                this._osmObject.set_tag(fieldSpec.subtags[index], entry.text);
                this._name = entry.text;
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

        _addOSMField(fieldSpec, value) {
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
                case EditFieldType.ADDRESS:
                    this._addOSMEditAddressEntry(fieldSpec, value);
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
                    fieldSpec.subtags.forEach(function (tag) {
                        if (osmObject.get_tag(tag) != null)
                            hasAny = true;
                    });

                    if (hasAny) {
                        value = fieldSpec.subtags.map(function (tag) {
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
            this._stack.visible_child_name = 'editor';
        }
    });
