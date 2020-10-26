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
const Clutter = imports.gi.Clutter;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const GtkClutter = imports.gi.GtkClutter;
const System = imports.system;

const Service = imports.service;
const Utils = imports.utils;

let _attributionImage = null;

const _FILE_CACHE_SIZE_LIMIT = (10 * 1024 * 1024); /* 10Mb */
const _MEMORY_CACHE_SIZE_LIMIT = 100; /* number of tiles */

const _LOGO_PADDING_X = 10;
const _LOGO_PADDING_Y = 25;
// extra padding below logo in RTL, where scale will be on the right side
const _LOGO_PADDING_Y_RTL = 35;

var AttributionLogo = GObject.registerClass({},
class AttributionLogo extends GtkClutter.Actor {

    _init(view) {
        super._init();

        if (_attributionImage)
            this.contents = _attributionImage;
        else
            return;

        this._rtl = Gtk.get_locale_direction() === Gtk.TextDirection.RTL;
        view.connect('notify::width', () => this._updatePosition(view));
        view.connect('notify::height', () => this._updatePosition(view));

        this._updatePosition(view);
    }

    _updatePosition(view) {
        let width = _attributionImage.pixbuf.width;
        let height = _attributionImage.pixbuf.height;
        let x = view.width  - width  - _LOGO_PADDING_X;
        /* TODO: ideally the attribution logo should be aligned to the left
         * side in RTL locales, but I couldn't get that working with Clutter
         * actor positioning, so adjust the padding to fit above the scale
         * for now
         */
        let y = view.height - height -
                (this._rtl ? _LOGO_PADDING_Y_RTL : _LOGO_PADDING_Y);

        this.set_position(x, y);
    }
});

function _updateAttributionImage(source) {
    if (!source.attribution_logo || source.attribution_logo === "")
        return;

    if (!_attributionImage)
        _attributionImage = new Gtk.Image();

    let data = GLib.base64_decode(source.attribution_logo);
    let stream = Gio.MemoryInputStream.new_from_bytes(GLib.Bytes.new(data));
    _attributionImage.pixbuf = GdkPixbuf.Pixbuf.new_from_stream(stream, null);
}

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
    _updateAttributionImage(source);

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
    return _createCachedSource(Service.getService().tiles.aerial);
}

function createHybridAerialSource() {
    return _createCachedSource(Service.getService().tiles.hybridAerial);
}

function createStreetSource() {
    return _createCachedSource(Service.getService().tiles.street);
}

function createStreetDarkSource() {
    return _createCachedSource(Service.getService().tiles.streetDark)
}

function createPrintSource() {
    return _createCachedSource(Service.getService().tiles.print);
}
