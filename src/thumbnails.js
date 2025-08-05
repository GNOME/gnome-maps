/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2025 Marcus Lundblad
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
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>.
 *
 * Author: Marcus Lundblad <ml@dfupdate.se>
 */

import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

let _soupSession = null;
function _getSoupSession() {
    if (_soupSession === null) {
        _soupSession = new Soup.Session({ user_agent : 'gnome-maps/' + pkg.version });
    }

    return _soupSession;
}

let _thumbnailCache = {};

export function fetch(url, cancellable, callback) {
    const msg = Soup.Message.new('GET', url);
    const session = _getSoupSession();

    const cachedThumbnail = _thumbnailCache[url];
    if (cachedThumbnail) {
        callback(cachedThumbnail);
        return;
    }

    session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, cancellable, (source, res) => {
        if (msg.get_status() !== Soup.Status.OK) {
            log("Failed to download thumbnail: " + msg.reason_phrase);
            callback(null);
            return;
        }

        const bytes = session.send_and_read_finish(res);

        try {
            const texture = Gdk.Texture.new_from_bytes(bytes);

            _thumbnailCache[url] = texture;
            callback(texture);
        } catch(e) {
            log("Failed to load image: " + e);
            callback(null);
        }
    });
}
