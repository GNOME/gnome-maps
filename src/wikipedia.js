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
        _soupSession = new Soup.Session({ user_agent : 'gnome-maps/' + pkg.version });
    }

    return _soupSession;
}

let _thumbnailCache = {};
let _metadataCache = {};

function getLanguage(wiki) {
    return wiki.split(':')[0];
}

function getArticle(wiki) {
    return Soup.uri_encode(wiki.replace(/ /g, '_').split(':').splice(1).join(':'),
                           '\'');
}

function getHtmlEntityEncodedArticle(wiki) {
    return GLib.markup_escape_text(wiki.split(':').splice(1).join(':'), -1);
}

/*
 * Fetch various metadata about a Wikipedia article, given the wiki language
 * and article title.
 *
 * @size is the maximum width of the thumbnail.
 *
 * Calls @metadataCb with an object containing information about the article.
 * For the keys/values of this object, see the relevant MediaWiki API
 * documentation.
 *
 * Calls @thumbnailCb with the Gdk.Pixbuf of the icon when successful, otherwise
 * null.
 */
function fetchArticleInfo(wiki, size, metadataCb, thumbnailCb) {
    let lang = getLanguage(wiki);
    let title = getHtmlEntityEncodedArticle(wiki);
    let uri = Format.vprintf('https://%s.wikipedia.org/w/api.php', [ lang ]);
    let msg = Soup.form_request_new_from_hash('GET', uri, { action: 'query',
                                                            titles: title,
                                                            prop: 'extracts|pageimages',
                                                            format: 'json',

                                                            /* Allow redirects, for example if an
                                                               article is renamed. */
                                                            redirects: '1',

                                                            /* don't go past first section header */
                                                            exintro: 'yes',
                                                            /* limit the length   */
                                                            exchars: '200',
                                                            /* for plain text rather than HTML */
                                                            explaintext: 'yes',

                                                            pithumbsize: size + ''});
    let session = _getSoupSession();
    let cachedMetadata = _metadataCache[wiki];
    let cachedThumbnail = _thumbnailCache[wiki + '/' + size];

    if (cachedMetadata && cachedThumbnail) {
        metadataCb(cachedMetadata);
        thumbnailCb(cachedThumbnail);
        return;
    }

    session.queue_message(msg, (session, msg) => {
        if (msg.status_code !== Soup.KnownStatusCode.OK) {
            log("Failed to request Wikipedia metadata: " + msg.reason_phrase);
            metadataCb({});
            thumbnailCb(null);
            return;
        }

        let response = JSON.parse(msg.response_body.data);
        let pages = response.query.pages;

        if (pages) {
            /* we know there should be only one object instance in the "pages"
             * object, but the API specifies the sub-object as the page ID,
             * so we'll have to use this iteration approach here
             */
            for (let pageId in pages) {
                let page = pages[pageId];

                _metadataCache[wiki] = page;
                metadataCb(page);

                let thumbnail = page.thumbnail;
                if (thumbnail) {
                    let source = page.thumbnail.source;

                    _fetchThumbnailImage(wiki, size, source, thumbnailCb);
                } else {
                    thumbnailCb(null);
                }
                return;
            }
        } else {
            metadataCb({});
            thumbnailCb(null);
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
