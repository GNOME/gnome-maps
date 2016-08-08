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

const Champlain = imports.gi.Champlain;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Utils = imports.utils;

/*
 * These URIs are used by the libchamplain network tile source.
 * The #X#, #Y#, #Z# coords will get replaced with actual tile numbers.
 */
const _AERIAL_URI = "https://gis.gnome.org/tiles/satellite/v1/#Z#/#X#/#Y#";
const _STREET_URI = "https://gis.gnome.org/tiles/street/v1/#Z#/#X#/#Y#";

/* unique names are needed for file caching */
const _AERIAL_NAME = "mapbox-satellite-v1";
const _STREET_NAME = "mapbox-street-v1";

const _TILE_SIZE = 256;
const _MIN_ZOOM = 0;
const _MAX_ZOOM = 19;

const _FILE_CACHE_SIZE_LIMIT = (10 * 1024 * 1024); /* 10Mb */
const _MEMORY_CACHE_SIZE_LIMIT = 100; /* number of tiles */

const AttributionLogo = new Lang.Class({
    Name: 'AttributionLogo',
    Extends: Gtk.Bin,

    _init: function() {
        this.parent({ halign: Gtk.Align.END,
                      valign: Gtk.Align.END,
                      margin_bottom: 6,
                      margin_right: 6 });

        let ui = Utils.getUIObject('attribution-logo', ['logo']);
        this.add(ui.logo);
    }
});

function _createTileSource(uri, name) {
    return new Champlain.NetworkTileSource(
        { id: name,
          name: name,
          license: null,
          license_uri: null,
          min_zoom_level: _MIN_ZOOM,
          max_zoom_level: _MAX_ZOOM,
          tile_size: _TILE_SIZE,
          renderer: new Champlain.ImageRenderer(),
          uri_format: uri
        });
}

function _createCachedSource(uri, name) {
    let tileSource = _createTileSource(uri, name);

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

function createAerialSource() {
    return _createCachedSource(_AERIAL_URI, _AERIAL_NAME);
};

function createStreetSource() {
    return _createCachedSource(_STREET_URI, _STREET_NAME);
};
