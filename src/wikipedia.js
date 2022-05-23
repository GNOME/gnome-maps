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

import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

import * as Utils from './utils.js';

/**
 * Regex matching editions of Wikipedia, e.g. "en", "arz", pt-BR", "simple".
 * See https://en.wikipedia.org/wiki/List_of_Wikipedias  "WP code".
 */
const WP_REGEX = /^[a-z][a-z][a-z]?(\-[a-z]+)?$|^simple$/;

let _soupSession = null;
function _getSoupSession() {
    if (_soupSession === null) {
        _soupSession = new Soup.Session({ user_agent : 'gnome-maps/' + pkg.version });
    }

    return _soupSession;
}

let _thumbnailCache = {};
let _metadataCache = {};

export function getLanguage(wiki) {
    return wiki.split(':')[0];
}

export function getArticle(wiki) {
    return Soup.uri_encode(wiki.replace(/ /g, '_').split(':').splice(1).join(':'),
                           '\'');
}

export function getHtmlEntityEncodedArticle(wiki) {
    return GLib.markup_escape_text(wiki.split(':').splice(1).join(':'), -1);
}

/**
 * Determine if a Wikipedia reference tag is valid
 * (of the form "lang:Article title")
 */
export function isValidWikipedia(wiki) {
    let parts = wiki.split(':');

    if (parts.length < 2)
        return false;

    let wpCode = parts[0];

    return wpCode.match(WP_REGEX) !== null;
}

/*
 * Fetch various metadata about a Wikipedia article, given the wiki language
 * and article title.
 *
 * @size is the maximum width of the thumbnail.
 *
 * Calls @metadataCb with the lang:title pair for the article and an object
 * containing information about the article. For the keys/values of this
 * object, see the relevant MediaWiki API documentation.
 *
 * Calls @thumbnailCb with the Gdk.Pixbuf of the icon when successful, otherwise
 * null.
 */
export function fetchArticleInfo(wiki, size, metadataCb, thumbnailCb) {
    let lang = getLanguage(wiki);
    let title = getHtmlEntityEncodedArticle(wiki);
    let uri = `https://${lang}.wikipedia.org/w/api.php`;
    let msg = Soup.form_request_new_from_hash('GET', uri, { action: 'query',
                                                            titles: title,
                                                            prop: 'extracts|pageimages|langlinks',
                                                            format: 'json',

                                                            /* Allow redirects, for example if an
                                                               article is renamed. */
                                                            redirects: '1',

                                                            /* Make sure we get all lang links */
                                                            lllimit: 'max',

                                                            /* don't go past first section header */
                                                            exintro: 'yes',
                                                            /* limit the length   */
                                                            exchars: '200',
                                                            /* for plain text rather than HTML */
                                                            explaintext: 'yes',

                                                            pithumbsize: size + ''});
    let session = _getSoupSession();
    let cachedMetadata = _metadataCache[wiki];

    if (cachedMetadata) {
        _onMetadataFetched(wiki, cachedMetadata, size, metadataCb, thumbnailCb);
        return;
    }

    session.queue_message(msg, (session, msg) => {
        if (msg.status_code !== Soup.KnownStatusCode.OK) {
            log("Failed to request Wikipedia metadata: " + msg.reason_phrase);
            metadataCb(null, {});
            if (thumbnailCb) {
                thumbnailCb(null);
            }
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
                _onMetadataFetched(wiki, page, size, metadataCb, thumbnailCb);
                return;
            }
        } else {
            metadataCb(null, {});
            if (thumbnailCb) {
                thumbnailCb(null);
            }
        }
    });
}

function _onMetadataFetched(wiki, page, size, metadataCb, thumbnailCb) {
    /* Try to get a thumbnail *before* following language links--the primary
       article probably has the best thumbnail image */
    if (thumbnailCb && page.thumbnail) {
        let source = page.thumbnail.source;

        _fetchThumbnailImage(wiki, size, source, thumbnailCb);
        thumbnailCb = null;
    }

    /* Follow language links if necessary */
    let langlink = _findLanguageLink(wiki, page);
    if (langlink) {
        fetchArticleInfo(langlink, size, metadataCb, thumbnailCb);
    } else {
        metadataCb(wiki, page);

        if (thumbnailCb) {
            thumbnailCb(null);
        }
    }
}

function _fetchThumbnailImage(wiki, size, source, callback) {
    let uri = new Soup.URI(source);
    let msg = new Soup.Message({ method: 'GET', uri: uri });
    let session = _getSoupSession();

    let cachedThumbnail = _thumbnailCache[wiki + '/' + size];
    if (cachedThumbnail) {
        callback(cachedThumbnail);
        return;
    }

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

/* Finds the best language to use, based on the language of the original
   article and the langlinks data from the Wikipedia API.

   Returns a lang:title string if that article should be used, or undefined if
   the original article should be used. */
function _findLanguageLink(wiki, page) {
    let originalLang = getLanguage(wiki);
    let languages = GLib.get_language_names().map((lang) => lang.split(/[\._\-]/)[0]);

    if (!languages.includes(originalLang)) {
        let langlinks = {};
        for (let langlink of (page.langlinks || [])) {
            langlinks[langlink.lang] = langlink["*"];
        }

        for (let language of languages) {
            if (language in langlinks) {
                return language + ":" + langlinks[language];
            }
        }
    }
}
