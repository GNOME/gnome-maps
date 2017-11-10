/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2017 Marcus Lundblad
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
 * Author: Marcus Lundblad <ml@update.uu.se>
 */

const GdkPixbuf = imports.gi.GdkPixbuf;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Soup = imports.gi.Soup;

const Format = imports.format;
const Utils = imports.utils;

let _soupSession = null;
function _getSoupSession() {
    if (_soupSession === null) {
        _soupSession = new Soup.Session ();
    }

    return _soupSession;
}

let _thumbnailCache = {};

function getLanguage(wiki) {
    return wiki.split(':')[0];
}

function getArticle(wiki) {
    return GLib.markup_escape_text(wiki.split(':').splice(1).join(':'), -1);
}

/*
 * Try to fetch the thumbnail given an article title and thumbnail size
 * Calls callback with the Gdk.PixBuf of the icon when successful, otherwise
 * undefined
 */
function fetchArticleThumbnail(wiki, size, callback) {
    let lang = getLanguage(wiki);
    let title = getArticle(wiki);
    let uri = Format.vprintf('https://%s.wikipedia.org/w/api.php', [ lang ]);
    let msg = Soup.form_request_new_from_hash('GET', uri, { action: 'query',
                                                            titles: title,
                                                            prop: 'pageimages',
                                                            format: 'json',
                                                            pithumbsize: size + ''});
    let session = _getSoupSession();
    let cachedThumbnail = _thumbnailCache[wiki + '/' + size];

    if (cachedThumbnail) {
        callback(cachedThumbnail);
        return;
    }

    session.queue_message(msg, (session, msg) => {
        if (msg.status_code !== Soup.KnownStatusCode.OK) {
            log("Failed to request thumbnail: " + msg.reason_phrase);
            callback(null);
            return;
        }

        let response = JSON.parse(msg.response_body.data);
        let pages = response.query.pages;

        if (pages) {
            /* we know there should be only one object instance in the "pages"
             * object, but the API specifies the sub-object as the page ID,
             * so we'll have to use this iteration approach here
             */
            for (let page in pages) {
                let thumbnail = pages[page].thumbnail;

                if (thumbnail) {
                    let source = pages[page].thumbnail.source;

                    _fetchThumbnailImage(wiki, size, source, callback);
                } else {
                    callback(null);
                }
                return;
            }
        } else {
            callback(null);
        }
    });
}

function _fetchThumbnailImage(wiki, size, source, callback) {
    let uri = new Soup.URI(source);
    let msg = new Soup.Message({ method: 'GET', uri: uri });
    let session = _getSoupSession();

    session.queue_message(msg, (session, msg) => {
        if (msg.status_code !== Soup.KnownStatusCode.OK) {
            log("Failed to download thumbnail: " + msg.reason_phrase);
            callback(null);
            return;
        }

        let contents = msg.response_body_data;
        let stream = Gio.MemoryInputStream.new_from_bytes(contents);

        try {
            let pixbuf = GdkPixbuf.Pixbuf.new_from_stream(stream, null);

            _thumbnailCache[wiki + '/' + size] = pixbuf;
            callback(pixbuf);
        } catch(e) {
            log("Failed to load pixbuf: " + e);
            callback(null);
        }

        stream.close(null);
    });
}
