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
 * with GNOME Maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: James Westman <james@jwestman.net>
 */

import GObject from "gi://GObject";
import Shumate from "gi://Shumate";

import { DownloadManager } from "./downloads.js";

export class OfflineDataSource extends Shumate.DataSource {
    constructor(downloads, nextSource) {
        super();

        /** @private @type {DownloadManager} */
        this.downloads = downloads;
        /** @private @type {Shumate.DataSource} */
        this.nextSource = nextSource;

        nextSource.bind_property(
            "min-zoom-level",
            this,
            "min-zoom-level",
            GObject.BindingFlags.SYNC_CREATE
        );
        nextSource.bind_property(
            "max-zoom-level",
            this,
            "max-zoom-level",
            GObject.BindingFlags.SYNC_CREATE
        );
    }

    vfunc_start_request(x, y, zoom_level, cancellable) {
        const request = Shumate.DataSourceRequest.new(x, y, zoom_level);

        const func = async () => {
            const chunk = await this.downloads.getFile(
                "vector",
                `${zoom_level}/${x}/${y}`
            );

            if (cancellable && cancellable.is_cancelled()) return;

            if (chunk) {
                request.emit_data(chunk, true);
            } else {
                const nextRequest = this.nextSource.start_request(
                    x,
                    y,
                    zoom_level,
                    cancellable
                );
                nextRequest.connect("notify::data", () => {
                    request.emit_data(nextRequest.data, false);
                });
                nextRequest.connect("notify::error", () => {
                    request.emit_error(nextRequest.error);
                });
                nextRequest.connect("notify::completed", () => {
                    if (!request.completed) request.complete();
                });
            }
        };

        func().catch((e) => {
            logError(e);
            request.emit_error(e);
        });

        return request;
    }
}

GObject.registerClass(OfflineDataSource);
