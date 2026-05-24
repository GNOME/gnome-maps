/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2023 James Westman
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
 * Author: James Westman <james@jwestman.net>
 */

import Adw from "gi://Adw";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk";
import Gdk from "gi://Gdk";
import Gsk from "gi://Gsk";
import Graphene from "gi://Graphene";
import Shumate from "gi://Shumate";

import { Application } from "./application.js";
import { DownloadManager, DownloadArea } from "./downloads.js";
import { PreferencesDownloadNew } from "./preferencesDownloadNew.js";
import * as MapSource from "./mapSource.js";

export class PreferencesDownloads extends Adw.PreferencesPage {
    constructor(params) {
        super(params);

        this._downloadsAreasBox.bind_model(
            this.downloads.areas,
            (downloadArea) =>
                new PreferencesDownloadRow({
                    downloadArea,
                })
        );

        this._pulseTimeout = null;

        this.downloads.connect("notify::progress", () => this.updateProgress());
        this.downloads.connect("error", (_downloads, message) => {
            /* show a toast on the parent PreferencesDialog */
            const toast = Adw.Toast.new(message);
            this.get_ancestor(Adw.PreferencesDialog).add_toast(toast);
        });
        this.updateProgress();

        const styleManager = Adw.StyleManager.get_default();

        const handlerId = styleManager.connect("notify::dark", () => {
            this._mapSource = null;
            let child = this._downloadsAreasBox.get_first_child();
            while (child !== null) {
                child.updateMap();
                child = child.get_next_sibling();
            }
        });
        this.connect("destroy", () => {
            styleManager.disconnect(handlerId);
        });

        this._mapSource = null;
    }

    get downloads() {
        return Application.downloads;
    }

    showAddPage() {
        this.get_ancestor(Adw.PreferencesDialog).push_subpage(
            new PreferencesDownloadNew()
        );
    }

    downloadAnyway() {
        this.downloads.ignorePause = true;
        this.downloads.processQueue();
    }

    visibleChild(_self, nItems) {
        return nItems > 0 ? "downloads" : "noDownloads";
    }

    pauseReasonsText(_self, pauseReasons) {
        const metered = pauseReasons.includes("metered-network");
        const power = pauseReasons.includes("power-saver");

        if (metered && power) {
            return _("Power Saver enabled and metered network \u2014 automatic downloads paused");
        } else if (metered) {
            return _("Metered network \u2014 automatic downloads paused");
        } else if (power) {
            return _("Power Saver enabled \u2014 automatic downloads paused");
        } else {
            return "";
        }
    }

    getMapSource() {
        if (!this._mapSource) {
            this._mapSource = MapSource.createVectorSource();
        }
        return this._mapSource;
    }

    /** @private */
    updateProgress() {
        const progress = this.downloads.progress;
        if (this._pulseTimeout !== null) {
            GLib.source_remove(this._pulseTimeout);
            this._pulseTimeout = null;
        }

        if (progress === null) {
            this._progress.hide();
        } else {
            this._progress.show();
            this._progressBar.text = progress.job;
            if (progress.remaining > 0) {
                this._progressBar.fraction =
                    progress.completed /
                    (progress.completed + progress.remaining);
            } else {
                if (this._pulseTimeout === null) {
                    this._progressBar.pulse();
                    this._pulseTimeout = GLib.timeout_add(
                        GLib.PRIORITY_DEFAULT,
                        100,
                        () => {
                            this._progressBar.pulse();
                            return GLib.SOURCE_CONTINUE;
                        }
                    );
                }
            }
        }
    }
}

GObject.registerClass(
    {
        Template: "resource:///org/gnome/Maps/ui/preferences-downloads.ui",
        InternalChildren: [
            "downloadsAreasBox",
            "noDownloads",
            "progress",
            "progressBar",
        ],
        Properties: {
            downloads: GObject.ParamSpec.object(
                "downloads",
                "",
                "",
                GObject.ParamFlags.READABLE,
                DownloadManager
            ),
        },
    },
    PreferencesDownloads
);

class PreferencesDownloadRow extends Adw.ExpanderRow {
    constructor(params) {
        super(params);
        this._nameEntry.text = this.downloadArea.name ?? "";
        this.downloadArea.bind_property_full(
            "name",
            this,
            "title",
            GObject.BindingFlags.SYNC_CREATE,
            (_bind, source) => [
                true,
                /* Translators: This is the default name of a downloaded area if the user does not provide a name. %s is a number. */
                source ? source : _("Map #%s").format(this.downloadArea.id.toLocaleString()),
            ],
            null
        );
        this.downloadArea.bind_property_full(
            "byte-size",
            this,
            "subtitle",
            GObject.BindingFlags.SYNC_CREATE,
            (_bind, source) => [true, source ? GLib.format_size(source) : ""],
            null
        );
    }

    /** @type {DownloadArea} */
    get downloadArea() {
        return this._downloadArea ?? null;
    }

    set downloadArea(downloadArea) {
        this._downloadArea = downloadArea;
    }

    delete() {
        const dialog = Adw.AlertDialog.new(_("Remove download?"), null);
        dialog.add_response("cancel", _("Cancel"));
        dialog.add_response("remove", _("Remove"));
        dialog.set_response_appearance(
            "remove",
            Adw.ResponseAppearance.DESTRUCTIVE
        );
        dialog.set_default_response("cancel");
        dialog.set_close_response("cancel");

        dialog
            .choose(this.root, null)
            .then((response) => {
                if (response === "remove") {
                    this.downloadArea.manager.removeArea(this.downloadArea);
                }
            })
            .catch(logError);
    }

    updateName() {
        this.downloadArea.name = this._nameEntry.text;
    }

    updateMap() {
        if (this._mapLayer) {
            this._map.remove_layer(this._mapLayer);
            this._mapLayer = null;
            this._license.remove_map_source(this._mapSource);
            this._mapSource = null;
        }

        if (this.expanded) {
            this._mapSource =
                this.get_ancestor(PreferencesDownloads).getMapSource();
            this._mapLayer = new Shumate.MapLayer({
                mapSource: this._mapSource,
                viewport: this._map.viewport,
            });
            this._map.viewport.reference_map_source = this._mapSource;
            this._map.add_layer(this._mapLayer);
            this._license.append_map_source(this._mapSource);
            [this._map.viewport.longitude, this._map.viewport.latitude] =
                this._downloadArea.bounds.getCenter();
        }
    }

    updateMapZoom() {
        if (!this._mapSource) return;

        const left = this._mapSource.get_x(0, this._downloadArea.bounds.left);
        const right = this._mapSource.get_x(0, this._downloadArea.bounds.right);
        const top = this._mapSource.get_y(0, this._downloadArea.bounds.top);
        const bottom = this._mapSource.get_y(
            0,
            this._downloadArea.bounds.bottom
        );
        this._map.viewport.zoom_level =
            Math.log2(
                Math.min(
                    this._map.get_width() / (right - left),
                    this._map.get_height() / (bottom - top)
                )
            ) - 0.5;
    }
}

GObject.registerClass(
    {
        Template: "resource:///org/gnome/Maps/ui/preferences-download-row.ui",
        InternalChildren: ["mapRow", "license", "overlay", "map", "nameEntry"],
        Properties: {
            "download-area": GObject.ParamSpec.object(
                "download-area",
                "",
                "",
                GObject.ParamFlags.READWRITE,
                DownloadArea
            ),
        },
    },
    PreferencesDownloadRow
);

const BORDER_WIDTH = 2;

class PreferencesDownloadRowMapWrapper extends Gtk.Widget {
    vfunc_measure(orientation, for_size) {
        const child = this.get_first_child();
        return child.measure(orientation, for_size);
    }

    vfunc_size_allocate(width, height, baseline) {
        this.get_first_child().size_allocate(
            new Gdk.Rectangle({
                x: 0,
                y: 0,
                width,
                height,
            }),
            -1
        );
        this.get_ancestor(PreferencesDownloadRow).updateMapZoom();
    }

    vfunc_snapshot(snapshot) {
        super.vfunc_snapshot(snapshot);

        const bounds = this.get_ancestor(PreferencesDownloadRow).downloadArea
            .bounds;
        const viewport = this.get_ancestor(PreferencesDownloadRow)._map
            .viewport;

        const [left, top] = viewport.location_to_widget_coords(
            this,
            bounds.top,
            bounds.left
        );
        const [right, bottom] = viewport.location_to_widget_coords(
            this,
            bounds.bottom,
            bounds.right
        );

        const width = this.get_width();
        const height = this.get_height();

        const rect = new Graphene.Rect();

        /* Draw shading on the outside of the selection */
        const color = new Gdk.RGBA({ red: 0, green: 0, blue: 0, alpha: 0.25 });
        rect.init(0, 0, left, height);
        snapshot.append_color(color, rect);
        rect.init(left, 0, right - left, top);
        snapshot.append_color(color, rect);
        rect.init(left, bottom, right - left, height - bottom);
        snapshot.append_color(color, rect);
        rect.init(right, 0, width - right, height);
        snapshot.append_color(color, rect);

        /* Draw a border around the selection */
        rect.init(
            left - BORDER_WIDTH / 2,
            top - BORDER_WIDTH / 2,
            right - left + BORDER_WIDTH,
            bottom - top + BORDER_WIDTH
        );
        const roundRect = new Gsk.RoundedRect();
        roundRect.init_from_rect(rect, 0);
        const fgColor = this.get_color();
        snapshot.append_border(
            roundRect,
            [BORDER_WIDTH, BORDER_WIDTH, BORDER_WIDTH, BORDER_WIDTH],
            [fgColor, fgColor, fgColor, fgColor]
        );
    }
}

GObject.registerClass(PreferencesDownloadRowMapWrapper);
