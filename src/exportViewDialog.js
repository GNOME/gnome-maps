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

    constructor({
        paintable,
        latitude,
        longitude,
        mapView,
        width,
        height,
        ...params
    }) {
        super({...params, use_header_bar: true});

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
        let initialFolder = Gio.File.new_for_path(this._folder)
        let folderChooser =
            new Gtk.FileDialog({ title: _("Select Folder"),
                                 initial_folder: initialFolder });

        folderChooser.select_folder(this, null, (chooser, result) => {
            try {
                const folder = folderChooser.select_folder_finish(result);

                if (folder)
                    this._onFolderChanged(folder.get_path());
            } catch (e) {
                // if dialog is cancelled, use the default folder
            }
        });
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

        let success = texture.save_to_png(path);

        if (success) {
            this.response(ExportViewDialog.Response.SUCCESS);
        } else {
            this.transient_for.showToast(_("Unable to export view"));
            this.response(ExportViewDialog.Response.CANCEL);
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
