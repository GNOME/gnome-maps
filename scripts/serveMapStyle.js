#!/usr/bin/env -S gjs -m
/*
 * Copyright (C) 2024 James Westman <james@jwestman.net>
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, see <https://www.gnu.org/licenses/>.
 */

/* Serve the map style using libsoup and MapLibre GL JS. */

import Soup from "gi://Soup?version=3.0";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import "gi://Gtk?version=4.0";

import * as Utils from "../src/utils.js";

const CONTENT_TYPES = {
    html: "text/html",
    js: "text/javascript",
    json: "application/json",
    svg: "image/svg+xml",
};

const LIVE_RELOAD_JS = `
const wsPath = (window.location.protocol === "https:" ? "wss://" : "ws://") + window.location.host + "/ws";
console.log("Setting up live reload at " + wsPath);
const websocket = new WebSocket(wsPath);
websocket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    switch (message.type) {
        case "reloadPage":
            console.log("Reloading page");
            window.location.reload();
            break;

        case "reloadStyle":
            console.log("Reloading map style");
            window.mapStyleReload();
            break;
    }
});
`;

const serve = (port) => {
    const connections = [];
    let fileCache = {};
    let iconsJson = null;
    let timeoutId = null;

    const server = new Soup.Server();
    server.add_handler("/", (server, message, path, query) => {
        if (path !== "/") {
            message.set_status(Soup.Status.NOT_FOUND, null);
            return;
        }

        message.set_redirect(Soup.Status.FOUND, "index.html");
    });

    const respondWithText = (message, text, contentType) => {
        message.set_status(Soup.Status.OK, null);
        message
            .get_response_headers()
            .set_content_type(contentType, { charset: "UTF-8" });
        message.get_response_headers().set_content_length(text.length);
        message.get_response_body().append(text);
    };

    const respondWithFile = (message, file) => {
        if (!fileCache[file]) {
            fileCache[file] = Utils.getBufferText(
                Utils.readFile(filePath(file))
            );
        }
        respondWithText(
            message,
            fileCache[file],
            CONTENT_TYPES[file.split(".").pop()] ?? "text/plain"
        );
    };

    const files = [
        "index.js",
        "tiny-sdf.js",
        "icons.json",
        "gnome-maps-dark.json",
        "gnome-maps-light.json",
    ];

    const filePath = (file) =>
        GLib.build_filenamev([GLib.get_current_dir(), "dist", file]);

    for (const file of files) {
        server.add_handler(`/${file}`, (server, message, path, query) => {
            respondWithFile(message, file);
        });
    }

    server.add_handler("/index.html", (server, message, path, query) => {
        const fileContent = Utils.getBufferText(
            Utils.readFile(filePath("index.html"))
        );
        const body = fileContent.replace(
            "<!-- @LIVE-RELOAD@ -->",
            `<script type="text/javascript">${LIVE_RELOAD_JS}</script>`
        );
        respondWithText(message, body, CONTENT_TYPES.html);
    });

    server.add_handler("/icons", (server, message, path, query) => {
        /* read icons.json and make sure the file is listed there */
        if (!iconsJson) {
            const iconsFile = filePath("icons.json");
            iconsJson = JSON.parse(
                Utils.getBufferText(Utils.readFile(iconsFile))
            );
        }
        const requestedIcon = path.split("/").pop();
        if (iconsJson.includes(requestedIcon)) {
            respondWithFile(message, `icons/${requestedIcon}`);
        } else {
            message.set_status(Soup.Status.NOT_FOUND, null);
        }
    });

    server.add_websocket_handler(
        "/ws",
        null,
        null,
        (server, message, path, conn) => {
            connections.push(conn);
            conn.connect("closed", () => {
                const index = connections.indexOf(conn);
                if (index > -1) {
                    connections.splice(index, 1);
                }
            });
        }
    );

    const regenerateMapStyle = () => {
        Gio.Subprocess.new(
            ["scripts/exportMapStyle.js"],
            Gio.SubprocessFlags.NONE
        ).wait(null);
    };

    let reloadHtml = false;
    const refresh = () => {
        if (timeoutId) {
            GLib.source_remove(timeoutId);
        }
        timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            console.log("Refresh requested");
            timeoutId = null;
            fileCache = {};
            iconsJson = null;

            regenerateMapStyle();
            log(
                `Map style exported, sending reload message to ${connections.length} clients`
            );

            for (const connection of connections) {
                connection.send_text(
                    JSON.stringify({
                        type: reloadHtml ? "reloadPage" : "reloadStyle",
                    })
                );
            }

            return GLib.SOURCE_REMOVE;
        });
    };

    const monitorRecursively = (directory, func) => {
        const file = Gio.File.new_for_path(directory);
        const monitor = file.monitor(0, null);
        const subMonitors = {};

        const deleteSubMonitor = (file) => {
            if (subMonitors[file.get_path()]) {
                subMonitors[file.get_path()].cancel();
                delete subMonitors[file.get_path()];
            }
        };

        monitor.connect("changed", (monitor, file, otherFile, eventType) => {
            log(`Path ${file.get_path()} changed`);

            switch (eventType) {
                case Gio.FileMonitorEvent.CREATED:
                    deleteSubMonitor(file);
                    subMonitors[file.get_path()] = monitorRecursively(
                        file.get_path(),
                        func
                    );
                    break;

                case Gio.FileMonitorEvent.DELETED:
                    deleteSubMonitor(file);
                    break;

                default:
                    break;
            }

            func();
        });

        if (
            file.query_file_type(Gio.FileQueryInfoFlags.NONE, null) ===
            Gio.FileType.DIRECTORY
        ) {
            for (const child of file.enumerate_children(
                "standard::*",
                Gio.FileQueryInfoFlags.NONE,
                null
            )) {
                const subFile = file.get_child(child.get_name());
                subMonitors[subFile.get_path()] = monitorRecursively(
                    subFile.get_path(),
                    func
                );
            }
        }

        return {
            cancel: () => {
                monitor.cancel();
                for (const subMonitor of Object.values(subMonitors)) {
                    subMonitor.cancel();
                }
            },
            isCancelled: () => monitor.is_cancelled(),
        };
    };

    log('Monitoring for changes to style files and scripts');
    const _doNotGc = [
        monitorRecursively("src/mapStyle", refresh),
        monitorRecursively("scripts/map-style-web", () => {
            reloadHtml = true;
            refresh();
        }),
    ];

    log('Generating map style on startup');
    regenerateMapStyle();

    log(`
==========================================
Serving map style on http://localhost:${port}
==========================================`);
    server.listen_local(port, 0);

    GLib.MainLoop.new(null, false).run();
};

serve(8000);
