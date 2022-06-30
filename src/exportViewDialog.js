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

import Cairo from 'cairo';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import Gsk from 'gi://Gsk';
import Gtk from 'gi://Gtk';

import * as Utils from './utils.js';

const _PREVIEW_WIDTH = 150;

export class ExportViewDialog extends Gtk.Dialog {

    static Response = {
        SUCCESS: 0,
        CANCEL: 1
    };

    constructor(params) {
        let paintable = params.paintable;
        delete params.paintable;

        let latitude = params.latitude;
        delete params.latitude;

        let longitude = params.longitude;
        delete params.longitude;

        let mapView = params.mapView;
        delete params.mapView;

        let width = params.width;
        delete params.width;

        let height = params.height;
        delete params.height;

        params.use_header_bar = true;
        super(params);

        this._paintable = paintable;
        this._mapView = mapView;
        this._width = width;
        this._height = height;
        this._cancelButton.connect('clicked', () => this.response(ExportViewDialog.Response.CANCEL));
        this._exportButton.connect('clicked', () => this._exportView());
        this._filenameEntry.connect('changed', () => this._onFileNameChanged());
        this._fileChooserButton.connect('clicked', () => this._onFileChooserClicked());

        this._folder = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES);
        if (!this._folder)
            this._folder = GLib.get_user_data_dir();

        this._filenameEntry.text = this._fileName =
            this._getName(latitude, longitude);
        this._setupPreviewArea();
    }

    _getName(latitude, longitude) {
        /* Translators: This is a format string for a PNG filename for an
         * exported image with coordinates. The .png extension should be kept
         * intact in the translated string.
         */
        return _("Maps at %f, %f.png").format(latitude.toFixed(2),
                                              longitude.toFixed(2));
    }

    _setupPreviewArea() {
        this._scaleFactor = _PREVIEW_WIDTH / this._width;
        let previewHeight = this._height * this._scaleFactor;

        this._previewArea.width_request = _PREVIEW_WIDTH;
        this._previewArea.height_request = previewHeight;
        this._previewArea.paintable = this._paintable;
    }

    _onFileChooserClicked() {
        let folderChooser = new Gtk.FileChooserNative();

        folderChooser.set_current_folder(Gio.File.new_for_path(this._folder));
        folderChooser.connect('response',
                              (widget, response) => {
            if (response === Gtk.ResponseType.ACCEPT)
                this._onFolderChanged(folderChooser.get_current_folder().get_path());

            folderChooser.destroy();
        });
        folderChooser.show();
    }

    _onFileNameChanged() {
        let name = GLib.filename_from_utf8(this._filenameEntry.text, -1)[0];
        name = name.toString();
        if (!name) {
            this._exportButton.sensitive= false;
            return;
        }

        try {
            GLib.build_filenamev([this._folder, name]);
            this._exportButton.sensitive = true;
            this._fileName = name;
        } catch(e) {
            this._exportButton.sensitive = false;
        }
    }

    _onFolderChanged(folder) {
        if (!GLib.file_test(folder, GLib.FileTest.IS_DIR)) {
            this._exportButton.sensitive= false;
            return;
        }
        if (!GLib.file_test(folder, GLib.FileTest.EXISTS)) {
            this._exportButton.sensitive = false;
            return;
        }

        this._exportButton.sensitive = true;
        this._folder = folder;
    }

    _exportView() {
        let rect = new Graphene.Rect();

        rect.init(0, 0, this._width, this._height);

        let snapshot = Gtk.Snapshot.new();

        this._paintable.snapshot(snapshot,
                                 this._paintable.get_intrinsic_width(),
                                 this._paintable.get_intrinsic_height());

        let node = snapshot.to_node();
        let renderer = this._mapView.get_native().get_renderer();
        let texture = renderer.render_texture(node, rect);
        let path = GLib.build_filenamev([this._folder, this._fileName]);

        try {
            texture.save_to_png(path);
            this.response(ExportViewDialog.Response.SUCCESS);
        } catch(e) {
            Utils.debug('failed to export view: ' + e.message);
            let details = null;

            if (e.matches(GLib.FileError, GLib.FileError.ROFS))
                details = _("Filesystem is read only");
            else if (e.matches(GLib.FileError, GLib.FileError.ACCES))
                details = _("You do not have permission to save there");
            else if (e.matches(GLib.FileError, GLib.FileError.NOENT))
                details = _("The directory does not exist");
            else if (e.matches(GLib.FileError, GLib.FileError.ISDIR))
                details = _("No filename specified");

            let dialog = new Gtk.MessageDialog({
                transient_for: this,
                destroy_with_parent: true,
                message_type: Gtk.MessageType.ERROR,
                buttons: Gtk.ButtonsType.OK,
                modal: true,
                text: _("Unable to export view"),
                secondary_text: details
            });

            dialog.connect('response', () => dialog.destroy());
            dialog.show_all();
        }
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/export-view-dialog.ui',
    InternalChildren: [ 'exportButton',
                        'cancelButton',
                        'filenameEntry',
                        'fileChooserButton',
                        'previewArea'],
}, ExportViewDialog);
