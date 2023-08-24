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
 * Author: Jonas Danielsson <jonas@threetimestwo.org>
 */

import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk';
import Shumate from 'gi://Shumate';
import GnomeMaps from 'gi://GnomeMaps';

import * as Service from './service.js';
import * as Utils from './utils.js';

/* Converts a tile URI format from Champlain style to Shumate style.
 * e.g. from
 * https://tile.openstreetmap.org/#Z#/#X#/#Y#.png
 * to
 * https://tile.openstreetmap.org/{Z}/{X}/{Y}.png
 */
function convertUriFormatFromChamplain(uriFormat) {
     return uriFormat.replace('#Z#', '{z}').replace('#X#', '{x}').replace('#Y#', '{y}');
}

function createTileDownloader(source) {
    let template = convertUriFormatFromChamplain(source.uri_format);

    return new Shumate.TileDownloader({ url_template: template });
}

function createRasterRenderer(source) {
    return new Shumate.RasterRenderer({
        id:             source.id,
        name:           source.name,
        license:        source.license,
        license_uri:    source.license_uri,
        min_zoom_level: source.min_zoom_level,
        max_zoom_level: source.max_zoom_level,
        tile_size:      source.tile_size,
        projection:     Shumate.MapProjection.MERCATOR,
        data_source:    createTileDownloader(source)
    });
}

export function createAerialSource() {
    return createRasterRenderer(Service.getService().tiles.aerial);
}

export function createStreetSource() {
    return createRasterRenderer(Service.getService().tiles.street);
}

export function createPrintSource() {
    return createRasterRenderer(Service.getService().tiles.print);
}

export function createVectorSource() {
    const [_status, styleFile] = Gio.file_new_for_uri('resource://org/gnome/Maps/styles/osm-liberty/style.json').load_contents(null);
    const style = Utils.getBufferText(styleFile);

    const source = Shumate.VectorRenderer.new("vector-tiles", style);
    source.set_license("© OpenMapTiles © OpenStreetMap contributors");
    source.set_license_uri("https://www.openstreetmap.org/copyright");

    const sprites = Shumate.VectorSpriteSheet.new();
    const [_status2, spritesJsonFile] = Gio.file_new_for_uri('resource://org/gnome/Maps/styles/osm-liberty/sprites.json').load_contents(null);
    const spritesJson = Utils.getBufferText(spritesJsonFile);
    sprites.add_page(
        Gdk.Texture.new_from_resource('/org/gnome/Maps/styles/osm-liberty/sprites.png'),
        spritesJson,
        1
    );
    const [_status3, sprites2xJsonFile] = Gio.file_new_for_uri('resource://org/gnome/Maps/styles/osm-liberty/sprites@2x.json').load_contents(null);
    const sprites2xJson = Utils.getBufferText(sprites2xJsonFile);
    sprites.add_page(
        Gdk.Texture.new_from_resource('/org/gnome/Maps/styles/osm-liberty/sprites@2x.png'),
        sprites2xJson,
        2
    );
    source.set_sprite_sheet(sprites);

    const spriteSource = new GnomeMaps.SpriteSource();
    spriteSource.set_fallback(sprites);

    return source;
}
