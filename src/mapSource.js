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

import Champlain from 'gi://Champlain';

import * as Service from './service.js';
import * as Utils from './utils.js';

const _FILE_CACHE_SIZE_LIMIT = (10 * 1024 * 1024); /* 10Mb */
const _MEMORY_CACHE_SIZE_LIMIT = 100; /* number of tiles */

function _createTileSource(source) {
    let tileSource = new Champlain.NetworkTileSource({
        id: source.id,
        name: source.name,
        license: source.license,
        license_uri: source.license_uri,
        min_zoom_level: source.min_zoom_level,
        max_zoom_level: source.max_zoom_level,
        tile_size: source.tile_size,
        renderer: new Champlain.ImageRenderer(),
        uri_format: source.uri_format
    });
    tileSource.max_conns = source.max_connections;
    return tileSource;
}

function _createCachedSource(source) {
    let tileSource = _createTileSource(source);

    let fileCache = new Champlain.FileCache({
        size_limit: _FILE_CACHE_SIZE_LIMIT,
        renderer: new Champlain.ImageRenderer()
    });

    let memoryCache = new Champlain.MemoryCache({
        size_limit: _MEMORY_CACHE_SIZE_LIMIT,
        renderer: new Champlain.ImageRenderer()
    });

    let errorSource = new Champlain.NullTileSource({
        renderer: new Champlain.ImageRenderer()
    });

    /*
     * When the a source in the chain fails to load a given tile
     * the next one in the chain tries instead. Until we get to the error
     * source.
     */
    let sourceChain = new Champlain.MapSourceChain();
    sourceChain.push(errorSource);
    sourceChain.push(tileSource);
    sourceChain.push(fileCache);
    sourceChain.push(memoryCache);

    return sourceChain;
}

export function createAerialSource() {
    return _createCachedSource(Service.getService().tiles.aerial);
}

export function createStreetSource() {
    return _createCachedSource(Service.getService().tiles.street);
}

export function createPrintSource() {
    return _createCachedSource(Service.getService().tiles.print);
}
