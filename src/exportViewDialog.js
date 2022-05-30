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
import Gtk from 'gi://Gtk';

import * as Utils from './utils.js';

const _PREVIEW_WIDTH = 150;

export class ExportViewDialog extends Gtk.Dialog {

    static Response = {
        SUCCESS: 0,
        CANCEL: 1
    };

    constructor(params) {
        let surface = params.surface;
        delete params.surface;

        let latitude = params.latitude;
        delete params.latitude;

        let longitude = params.longitude;
        delete params.longitude;

        let mapView = params.mapView;
        delete params.mapView;

        params.use_header_bar = true;
        super(params);

        this._surface = surface;
        this._mapView = mapView;
        this._cancelButton.connect('clicked', () => this.response(ExportViewDialog.Response.CANCEL));
        this._exportButton.connect('clicked', () => this._exportView());
        this._filenameEntry.connect('changed', () => this._onFileNameChanged());
        this._fileChooserButton.connect('file-set', () => this._onFolderChanged());
        this._layersCheckButton.connect('toggled', () => this._includeLayersChanged());


        this._folder = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES);
        if (!this._folder)
            this._folder = GLib.get_user_data_dir();

        this._filenameEntry.text = this._fileName =
            this._getName(latitude, longitude);
        this._fileChooserButton.set_current_folder(this._folder);
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
        let [surfaceWidth, surfaceHeight] = this._mapView.view.get_size();

        let width = _PREVIEW_WIDTH;
        this._scaleFactor = width / surfaceWidth;
        let height = surfaceHeight * this._scaleFactor;

        this._previewArea.set_size_request(width, height);
        this._previewArea.connect('draw',
                                  (w, cr) => this._drawPreview(w, cr));
    }

    _drawPreview(widget, cr) {
        cr.setOperator(Cairo.Operator.CLEAR);
        cr.paint();
        cr.setOperator(Cairo.Operator.OVER);

        cr.scale(this._scaleFactor, this._scaleFactor);
        cr.setSourceSurface(this._surface, 0, 0);
        cr.paint();
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

    _onFolderChanged() {
        let folder = this._fileChooserButton.get_filename();

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
        let [width, height] = this._mapView.view.get_size();
        let pixbuf = Gdk.pixbuf_get_from_surface(this._surface, 0, 0, width, height);
        let path = GLib.build_filenamev([this._folder, this._fileName]);

        try {
            pixbuf.savev(path, "png", [], []);
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

    _includeLayersChanged() {
        let includeLayers = this._layersCheckButton.get_active();

        this._surface = this._mapView.view.to_surface(includeLayers);
        this._previewArea.queue_draw();
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/export-view-dialog.ui',
    InternalChildren: [ 'exportButton',
                        'cancelButton',
                        'filenameEntry',
                        'fileChooserButton',
                        'previewArea',
                        'layersCheckButton' ],
}, ExportViewDialog);
