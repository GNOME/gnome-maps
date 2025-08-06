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

import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

import * as Thumbnails from './thumbnails.js';
import * as Utils from './utils.js';

/**
 * Regex matching editions of Wikipedia, e.g. "en", "arz", pt-BR", "simple".
 * See https://en.wikipedia.org/wiki/List_of_Wikipedias  "WP code".
 */
const WP_REGEX = /^[a-z][a-z][a-z]?(\-[a-z]+)?$|^simple$/;

/**
 * Regex matching Wikidata tags
 */
const WIKIDATA_REGEX = /Q\d+/;

/**
 * Wikidata properties
 */
const WIKIDATA_PROPERTY_IMAGE = 'P18';
const WIKIDATA_PROPERTY_LOGO_IMAGE = 'P154';

let _soupSession = null;
function _getSoupSession() {
    if (_soupSession === null) {
        _soupSession = new Soup.Session({ user_agent : 'gnome-maps/' + pkg.version });
    }

    return _soupSession;
}

let _metadataCache = {};
let _wikidataCache = {};
let _wikidataImageSourceCache = {};

export function getLanguage(wiki) {
    return wiki.split(':')[0];
}

export function getArticle(wiki) {
    return GLib.uri_escape_string(wiki.replace(/ /g, '_').split(':').splice(1).join(':'),
                                  '\'', false);
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

/**
 * Determine if a Wikidata reference tag is valid (of the form Qnnn)
 */
export function isValidWikidata(wikidata) {
    return wikidata.match(WIKIDATA_REGEX) !== null;
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
 * Calls @thumbnailCb with the Gdk.Texture of the icon when successful, otherwise
 * null.
 */
export function fetchArticleInfo(wiki, size, metadataCb, thumbnailCb) {
    let lang = getLanguage(wiki);
    let title = getHtmlEntityEncodedArticle(wiki);
    let uri = `https://${lang}.wikipedia.org/w/api.php`;
    let encodedForm =
        Soup.form_encode_hash({ action: 'query',
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

                                pithumbsize: size + '' });
    let msg = Soup.Message.new_from_encoded_form('GET', uri, encodedForm);
    let session = _getSoupSession();
    let cachedMetadata = _metadataCache[wiki];

    if (cachedMetadata) {
        _onMetadataFetched(wiki, cachedMetadata, size, metadataCb, thumbnailCb);
        return;
    }

    session.send_and_read_async(msg, GLib.PRIORIRY_DEFAULT, null,
                                     (source, res) => {
        if (msg.get_status() !== Soup.Status.OK) {
            log("Failed to request Wikipedia metadata: " + msg.reason_phrase);
            metadataCb(null, {});
            if (thumbnailCb) {
                thumbnailCb(null);
            }
            return;
        }

        let buffer = session.send_and_read_finish(res).get_data();
        let response = JSON.parse(Utils.getBufferText(buffer));
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

/*
 * Fetch various metadata about a Wikidata reference.
 *
 * @defaultArticle is the native Wikipedia article, if set, for the object
 *                 when present, it used as a fallback if none of the references
 *                 of the Wikidate tag matches a user's language
 * @size is the maximum width of the thumbnail.
 *
 * Calls @metadataCb with the lang:title pair for the article and an object
 * containing information about the article. For the keys/values of this
 * object, see the relevant MediaWiki API documentation.
 *
 * Calls @thumbnailCb with the Gdk.Texture of the icon when successful, otherwise
 * null.
 */
export function fetchArticleInfoForWikidata(wikidata, defaultArticle,
                                            size, metadataCb, thumbnailCb,
                                            imageProperty = WIKIDATA_PROPERTY_IMAGE) {
    let cachedWikidata = _wikidataCache[wikidata];

    if (cachedWikidata) {
        _onWikidataFetched(wikidata, defaultArticle, cachedWikidata, size,
                           metadataCb, thumbnailCb, imageProperty);
        return;
    }

    let uri = 'https://www.wikidata.org/w/api.php';
    let encodedForm = Soup.form_encode_hash({ action: 'wbgetentities',
                                              ids:    wikidata,
                                              format: 'json' });
    let msg = Soup.Message.new_from_encoded_form('GET', uri, encodedForm);
    let session = _getSoupSession();

    session.send_and_read_async(msg, GLib.PRIORIRY_DEFAULT, null,
                                     (source, res) => {
        if (msg.get_status() !== Soup.Status.OK) {
            log('Failed to request Wikidata entities: ' + msg.reason_phrase);
            if (metadataCb)
                metadataCb(null, {});

            thumbnailCb(null);
            return;
        }

        let buffer = session.send_and_read_finish(res).get_data();
        let response = JSON.parse(Utils.getBufferText(buffer));

        _wikidataCache[wikidata] = response;
        _onWikidataFetched(wikidata, defaultArticle, response, size,
                           metadataCb, thumbnailCb, imageProperty);
    });
}

export function fetchLogoImageForWikidata(wikidata, size, thumbnailCb) {
    fetchArticleInfoForWikidata(wikidata, null, size, null, thumbnailCb,
                                WIKIDATA_PROPERTY_LOGO_IMAGE);
}

export function fetchWikidataForArticle(wiki, cancellable, callback) {
    let lang = getLanguage(wiki);
    let title = getHtmlEntityEncodedArticle(wiki);
    let uri = 'https://www.wikidata.org/w/api.php';
    let encodedForm = Soup.form_encode_hash({ action: 'wbgetentities',
                                              sites:  lang + 'wiki',
                                              titles:  title,
                                              format: 'json' });
    let msg = Soup.Message.new_from_encoded_form('GET', uri, encodedForm);
    let session = _getSoupSession();

    session.send_and_read_async(msg, GLib.PRIORIRY_DEFAULT, cancellable,
                                     (source, res) => {
        if (msg.get_status() !== Soup.Status.OK) {
            log(`Failed to request Wikidata entities: ${msg.reason_phrase}`);
            callback(null);
            return;
        }

        let buffer = session.send_and_read_finish(res).get_data();
        let response = JSON.parse(Utils.getBufferText(buffer));
        let id = Object.values(response.entities ?? [])?.[0]?.id;

        callback(id);
    });
}

function _onWikidataFetched(wikidata, defaultArticle, response, size,
                            metadataCb, thumbnailCb,
                            imageProperty = WIKIDATA_PROPERTY_IMAGE) {
    const property = response?.entities?.[wikidata]?.claims?.[imageProperty];

    if (property) {
        let index = 0;

        /* pick an image with rank "preferred", if available, otherwise
         * the first one listed
         */
        for (let i = 0; i < property.length; i++) {
            if (property[i].rank === 'preferred') {
                index = i;
                break;
            }
        }

        const imageName = property[index]?.mainsnak?.datavalue?.value;

        /* if the Wikidata metadata links to a title image, use that to fetch
         * the thumbnail image
         */
        if (imageName) {
            _fetchWikidataThumbnail(imageName, size, thumbnailCb);
            thumbnailCb = null;
        }
    }

    // if we're not requesting metadata, skip the trying to find an article
    if (!metadataCb)
        return;

    let sitelinks = response?.entities?.[wikidata]?.sitelinks;

    if (!sitelinks) {
        Utils.debug('No sitelinks element in response');
        if (metadataCb)
            metadataCb(null, {});
        if (thumbnailCb)
            thumbnailCb(null);
        return;
    }

    /* try to find articles in the order of the user's preferred
     * languages
     */
    for (let language of _getLanguages()) {
        /* sitelinks appear under "sitelinks" in the form:
         * langwiki, e.g. "enwiki"
         */
        if (sitelinks[language + 'wiki']) {
            let article = `${language}:${sitelinks[language + 'wiki'].title}`;

            // if there's a default article, fetch image from that
            if (defaultArticle) {
                fetchArticleInfo(defaultArticle, size, null, thumbnailCb);
                thumbnailCb = null;
            }

            fetchArticleInfo(article, size, metadataCb, thumbnailCb);
            return;
        }
    }

    // if no article reference matches a preferred language
    if (defaultArticle) {
        // if there's a default article from the "wikipedia" tag, use it
        fetchArticleInfo(defaultArticle, size, metadataCb, thumbnailCb);
    } else {
        /* if there's exactly one *wiki sitelink, use it, since it's
         * probably the default (native) article
         */
        let foundSitelink;
        let numFoundSitelinks = 0;

        for (let sitelink in sitelinks) {
            if (sitelink.endsWith('wiki') && sitelink !== 'commonswiki') {
                foundSitelink = sitelink;
                numFoundSitelinks++;
            }
        }

        if (numFoundSitelinks === 1) {
            let language = foundSitelink.substring(0, foundSitelink.length - 4);
            let article = `${language}:${sitelinks[foundSitelink].title}`;

            fetchArticleInfo(article, size, metadataCb, thumbnailCb);
        }
    }
}

function _fetchWikidataThumbnail(imageName, size, thumbnailCb) {
    let cachedImageUrl = _wikidataImageSourceCache[imageName + '/' + size];

    if (cachedImageUrl) {
        Thumbnails.fetch(cachedImageUrl, null, thumbnailCb);
        return;
    }

    let uri = 'https://wikipedia.org/w/api.php';
    let encodedForm = Soup.form_encode_hash({ action:     'query',
                                              prop:       'imageinfo',
                                              iiprop:     'url',
                                              iiurlwidth: size + '',
                                              titles:     'Image:' + imageName,
                                              format:     'json' });
    let msg = Soup.Message.new_from_encoded_form('GET', uri, encodedForm);
    let session = _getSoupSession();

    session.send_and_read_async(msg, GLib.PRIORIRY_DEFAULT, null,
                                     (source, res) => {
        if (msg.get_status() !== Soup.Status.OK) {
            log('Failed to request Wikidata image thumbnail URL: ' +
                msg.reason_phrase);
            thumbnailCb(null);
            return;
        }

        let buffer = session.send_and_read_finish(res).get_data();
        let response = JSON.parse(Utils.getBufferText(buffer));
        let thumburl = response?.query?.pages?.[-1]?.imageinfo?.[0]?.thumburl;

        if (thumburl) {
            Thumbnails.fetch(thumburl, null, thumbnailCb);
            _wikidataImageSourceCache[imageName + '/' + size] = thumburl;
        }
    });
}

function _onMetadataFetched(wiki, page, size, metadataCb, thumbnailCb) {
    /* Try to get a thumbnail *before* following language links--the primary
       article probably has the best thumbnail image */
    if (thumbnailCb && page.thumbnail) {
        let source = page.thumbnail.source;

        Thumbnails.fetch(source, null, thumbnailCb);
        thumbnailCb = null;
    }

    /* Follow language links if necessary */
    let langlink = _findLanguageLink(wiki, page);
    if (langlink) {
        fetchArticleInfo(langlink, size, metadataCb, thumbnailCb);
    } else {
        if (metadataCb)
            metadataCb(wiki, page);

        if (thumbnailCb) {
            thumbnailCb(null);
        }
    }
}

/* Finds the best language to use, based on the language of the original
   article and the langlinks data from the Wikipedia API.

   Returns a lang:title string if that article should be used, or undefined if
   the original article should be used. */
function _findLanguageLink(wiki, page) {
    let originalLang = getLanguage(wiki);
    let languages = _getLanguages();

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

function _getLanguages() {
    return GLib.get_language_names().map((lang) => lang.split(/[\._\-]/)[0]);
}
