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
import Gdk from "gi://Gdk";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Graphene from "gi://Graphene";
import Gsk from "gi://Gsk";
import Gtk from "gi://Gtk";
import Shumate from "gi://Shumate";

import * as MapSource from "./mapSource.js";
import { Application } from "./application.js";
import { BoundingBox } from "./boundingBox.js";

/* ensure type registration */
Shumate.SimpleMap;

export class PreferencesDownloadNew extends Adw.NavigationPage {
    constructor() {
        super();

        const styleManager = Adw.StyleManager.get_default();

        const handlerId = styleManager.connect("notify::dark", () => {
            this.updateMap();
        });
        this.connect("destroy", () => {
            styleManager.disconnect(handlerId);
        });
        this.updateMap();

        const mainViewport = Application.application.mainWindow.mapView.map.viewport;
        this._map.viewport.zoom_level = Math.min(11, mainViewport.zoom_level);
        this._map.viewport.latitude = mainViewport.latitude;
        this._map.viewport.longitude = mainViewport.longitude;

        this._selectOverlay.viewport = this._map.viewport;

        /* Block swipe events on the map widget so you don't accidentally go back
           while trying to pan */
        const swipeGesture = new Gtk.GestureSwipe();
        swipeGesture.connect("begin", () => {
            swipeGesture.set_state(Gtk.EventSequenceState.CLAIMED);
        });
        this._map.add_controller(swipeGesture);

        /* Also block rotation */
        this._map.viewport.connect(
            "notify::rotation",
            () => (this._map.viewport.rotation = 0)
        );

        this._previousBounds = null;
        this._map.viewport.connect(
            "notify::zoom-level",
            this.onBoundsChanged.bind(this)
        );
        this._map.viewport.connect(
            "notify::latitude",
            this.onBoundsChanged.bind(this)
        );
        this._map.viewport.connect(
            "notify::longitude",
            this.onBoundsChanged.bind(this)
        );

        this._estimateCancellable = new Gio.Cancellable();
        this._estimateTimeout = null;
    }

    zoomIn() {
        this._map.zoom_in();
    }

    zoomOut() {
        this._map.zoom_out();
    }

    onBoundsChanged() {
        const bounds = this._selectOverlay.bounds;
        /* Avoid restarting the estimation if the bounds haven't changed */
        if (
            this._previousBounds &&
            this._previousBounds.top === bounds.top &&
            this._previousBounds.left === bounds.left &&
            this._previousBounds.bottom === bounds.bottom &&
            this._previousBounds.right === bounds.right
        ) {
            return;
        }
        this._previousBounds = bounds;

        this._estimationStack.visible_child = this._estimationSpinner;
        this._estimationSpinner.spinning = true;

        if (this._estimateTimeout) {
            GLib.source_remove(this._estimateTimeout);
            this._estimateTimeout = null;
        }
        if (this._estimateCancellable) {
            this._estimateCancellable.cancel();
        }

        if (Application.downloads.isTooBig(bounds)) {
            this._estimationStack.visible_child = this._estimationTooLarge;
            this._downloadButton.sensitive = false;
            return;
        }

        this._downloadButton.sensitive = true;

        const doEstimate = async () => {
            const cancellable = new Gio.Cancellable();
            this._estimateCancellable = cancellable;

            try {
                const size = await Application.downloads.getAreaSizeEstimate(
                    bounds,
                    ["vector"],
                    this._estimateCancellable
                );

                if (cancellable.is_cancelled()) return;

                this._estimationStack.visible_child = this._estimationLabel;
                this._estimationLabel.label = _("Estimated size: %s").format(
                    GLib.format_size(size)
                );
            } catch (e) {
                logError(e);
                this._estimationStack.visible_child = this._estimationLabel;
                this._estimationLabel.label = _("Failed to estimate size");
            }

            this._estimationSpinner.spinning = false;
        };

        this._estimateTimeout = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            1,
            () => {
                doEstimate().catch(logError);
                this._estimateTimeout = null;
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    denyRotation() {
        this._map.viewport.rotation = 0;
    }

    createDownload() {
        const area = Application.downloads.addArea(
            null,
            this._selectOverlay.bounds
        );
        this.get_ancestor(Adw.PreferencesDialog).pop_subpage();
    }

    updateMap() {
        if (this._mapLayer) {
            this._map.remove_layer(this._mapLayer);
            this._mapLayer = null;
            this._license.remove_map_source(this._mapSource);
            this._mapSource = null;
        }

        this._mapSource = MapSource.createVectorSource();
        this._license.prepend_map_source(this._mapSource);
        this._mapLayer = new Shumate.MapLayer({
            mapSource: this._mapSource,
            viewport: this._map.viewport,
        });
        this._map.viewport.reference_map_source = this._mapSource;
        this._map.add_layer(this._mapLayer);
    }
}

GObject.registerClass(
    {
        Template: "resource:///org/gnome/Maps/ui/preferences-download-new.ui",
        InternalChildren: [
            "map",
            "license",
            "selectOverlay",
            "estimationStack",
            "estimationLabel",
            "estimationSpinner",
            "estimationTooLarge",
            "downloadButton",
        ],
    },
    PreferencesDownloadNew
);

const HANDLE_SIZE = 18;
const BORDER_WIDTH = 2;
const DEFAULT_MARGIN = 18;
const MIN_MARGIN = 18;
const TOP_MARGIN = 42;

export class AreaSelectOverlay extends Gtk.Widget {
    constructor(params) {
        super(params);

        this._hMargin = DEFAULT_MARGIN;
        this._vMargin = DEFAULT_MARGIN;

        /** @type {AreaSelectDragHandle?} */
        this._dragTarget = null;

        const dragGesture = new Gtk.GestureDrag();
        dragGesture.connect("drag-begin", (gesture, x, y) => {
            const target = this.pick(x, y, Gtk.PickFlags.DEFAULT);
            if (target instanceof AreaSelectDragHandle) {
                gesture.set_state(Gtk.EventSequenceState.CLAIMED);
                this._dragTarget = target;
            }
        });
        dragGesture.connect("drag-update", (gesture, x, y) => {
            if (!this._dragTarget) return;

            const [_active, startX, startY] = gesture.get_start_point();

            if (this._dragTarget.xStart)
                this._hMargin = Math.max(MIN_MARGIN, startX + x);
            else
                this._hMargin = Math.max(
                    MIN_MARGIN,
                    this.get_width() - (startX + x)
                );

            if (this._dragTarget.yStart)
                this._vMargin = Math.max(MIN_MARGIN, startY + y - TOP_MARGIN);
            else
                this._vMargin = Math.max(
                    MIN_MARGIN,
                    this.get_height() - (startY + y)
                );

            this._updateBounds();
        });
        this.add_controller(dragGesture);

        this._handles = [
            [true, true],
            [false, true],
            [true, false],
            [false, false],
        ].map(([xStart, yStart]) => {
            const handle = new AreaSelectDragHandle(xStart, yStart);
            handle.set_parent(this);
            return handle;
        });
    }

    get viewport() {
        return this._viewport;
    }

    set viewport(viewport) {
        this._viewport = viewport;
    }

    _updateBounds() {
        const width = this.get_width();
        const height = this.get_height() - TOP_MARGIN;

        if (this._hMargin > width / 2) {
            this._hMargin = width - this._hMargin;
            for (const handle of this._handles) {
                handle.xStart = !handle.xStart;
            }
        }

        if (this._vMargin > height / 2) {
            this._vMargin = height - this._vMargin;
            for (const handle of this._handles) {
                handle.yStart = !handle.yStart;
            }
        }

        this.notify("bounds");

        this.queue_allocate();
    }

    vfunc_contains() {
        /* Pass events through to the map widget */
        return false;
    }

    vfunc_size_allocate(width, height, baseline) {
        for (const handle of this._handles) {
            const x = handle.xStart ? this._hMargin : width - this._hMargin;
            const y = handle.yStart
                ? this._vMargin + TOP_MARGIN
                : height - this._vMargin;
            handle.size_allocate(
                new Gdk.Rectangle({
                    x: x - HANDLE_SIZE / 2,
                    y: y - HANDLE_SIZE / 2,
                    width: HANDLE_SIZE,
                    height: HANDLE_SIZE,
                }),
                -1
            );
        }

        this.notify("bounds");
    }

    vfunc_snapshot(snapshot) {
        const width = this.get_width();
        const height = this.get_height() - TOP_MARGIN;

        const rect = new Graphene.Rect();

        /* Draw shading on the outside of the selection */
        const color = new Gdk.RGBA({ red: 0, green: 0, blue: 0, alpha: 0.25 });
        rect.init(0, 0, this._hMargin, height + TOP_MARGIN);
        snapshot.append_color(color, rect);
        rect.init(
            this._hMargin,
            0,
            width - this._hMargin * 2,
            this._vMargin + TOP_MARGIN
        );
        snapshot.append_color(color, rect);
        rect.init(
            this._hMargin,
            height - this._vMargin + TOP_MARGIN,
            width - this._hMargin * 2,
            this._vMargin
        );
        snapshot.append_color(color, rect);
        rect.init(width - this._hMargin, 0, this._hMargin, height + TOP_MARGIN);
        snapshot.append_color(color, rect);

        /* Draw a border around the selection */
        rect.init(
            this._hMargin - BORDER_WIDTH / 2,
            this._vMargin - BORDER_WIDTH / 2 + TOP_MARGIN,
            width - this._hMargin * 2 + BORDER_WIDTH,
            height - this._vMargin * 2 + BORDER_WIDTH
        );
        const roundRect = new Gsk.RoundedRect();
        roundRect.init_from_rect(rect, 0);
        const fgColor = this.get_color();
        snapshot.append_border(
            roundRect,
            [BORDER_WIDTH, BORDER_WIDTH, BORDER_WIDTH, BORDER_WIDTH],
            [fgColor, fgColor, fgColor, fgColor]
        );

        super.vfunc_snapshot(snapshot);
    }

    get bounds() {
        const [top, left] = this.viewport.widget_coords_to_location(
            this,
            this._hMargin,
            this._vMargin + TOP_MARGIN
        );
        const [bottom, right] = this.viewport.widget_coords_to_location(
            this,
            this.get_width() - this._hMargin,
            this.get_height() - this._vMargin
        );

        return new BoundingBox({
            top,
            left,
            bottom,
            right,
        });
    }
}

GObject.registerClass(
    {
        Properties: {
            bounds: GObject.ParamSpec.jsobject(
                "bounds",
                "",
                "",
                GObject.ParamFlags.READABLE
            ),
        },
    },
    AreaSelectOverlay
);

export class AreaSelectDragHandle extends Gtk.Widget {
    constructor(xStart, yStart) {
        super();
        this._xStart = xStart;
        this._yStart = yStart;
        this._updateCursor();
    }

    get xStart() {
        return this._xStart;
    }
    set xStart(xStart) {
        this._xStart = xStart;
        this._updateCursor();
    }

    get yStart() {
        return this._yStart;
    }
    set yStart(yStart) {
        this._yStart = yStart;
        this._updateCursor();
    }

    _updateCursor() {
        if (this.xStart && this.yStart) {
            this.cursor = Gdk.Cursor.new_from_name("nw-resize", null);
        } else if (this.xStart) {
            this.cursor = Gdk.Cursor.new_from_name("sw-resize", null);
        } else if (this.yStart) {
            this.cursor = Gdk.Cursor.new_from_name("ne-resize", null);
        } else {
            this.cursor = Gdk.Cursor.new_from_name("se-resize", null);
        }
    }

    vfunc_snapshot(snapshot) {
        const width = this.get_width();
        const height = this.get_height();

        const rect = new Graphene.Rect();
        rect.init(0, 0, width, height);

        const roundRect = new Gsk.RoundedRect();
        roundRect.init_from_rect(rect, width / 2);

        const fgColor = this.get_color();
        fgColor.alpha = 1;
        snapshot.push_rounded_clip(roundRect);
        snapshot.append_color(fgColor, rect);
        snapshot.pop();

        const shadowColor = new Gdk.RGBA({
            red: 0,
            green: 0,
            blue: 0,
            alpha: 0.5,
        });

        snapshot.append_outset_shadow(roundRect, shadowColor, 0, 0, 0, 4);
    }
}

GObject.registerClass(AreaSelectDragHandle);
