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

/* Exports the map style to a JSON file for use in MapLibre GL. */

import Gio from "gi://Gio?version=2.0";

import { generateMapStyle } from "../src/mapStyle/mapStyle.js";

const configs = [{ colorScheme: "dark" }, { colorScheme: "light" }];

for (const config of configs) {
    const style = generateMapStyle({ renderer: "maplibre-gl-js", textScale: 1, ...config });
    const filename = `dist/gnome-maps-${config.colorScheme}.json`;

    try {
        Gio.File.new_for_path("dist").make_directory_with_parents(null);
    } catch (e) {
        if (e.code !== Gio.IOErrorEnum.EXISTS) {
            throw e;
        }
    }

    console.log(`Writing ${filename}`);
    const file = Gio.File.new_for_path(filename);
    const stream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
    stream.write(JSON.stringify(style, null, 2), null);
}

console.log(`Copying static files`);
const staticFiles = Gio.File.new_for_path("scripts/map-style-web");
for (const file of staticFiles.enumerate_children("standard::*", Gio.FileQueryInfoFlags.NONE, null)) {
    const source = staticFiles.get_child(file.get_name());
    const dest = Gio.File.new_for_path(`dist/${file.get_name()}`);
    source.copy(dest, Gio.FileCopyFlags.OVERWRITE, null, null);
}

console.log(`Copying icons`);
const iconDirs =
  [Gio.File.new_for_path("data/icons/private/hicolor/16x16/apps"),
   Gio.File.new_for_path("data/icons/stations/hicolor/16x16/apps")];
const iconList = [];
try {
    Gio.File.new_for_path("dist/icons").make_directory_with_parents(null);
} catch (e) {
    if (e.code !== Gio.IOErrorEnum.EXISTS) {
        throw e;
    }
}
for (const dir of iconDirs) {
    for (const file of dir.enumerate_children("standard::*", Gio.FileQueryInfoFlags.NONE, null)) {
        const source = dir.get_child(file.get_name());
        const dest = Gio.File.new_for_path(`dist/icons/${file.get_name()}`);
        source.copy(dest, Gio.FileCopyFlags.OVERWRITE, null, null);
        iconList.push(file.get_name());
    }
}

console.log(`Writing icon list`);
const iconListFile = Gio.File.new_for_path("dist/icons.json");
const iconListStream = iconListFile.replace(null, false, Gio.FileCreateFlags.NONE, null);
iconListStream.write(JSON.stringify(iconList), null);
