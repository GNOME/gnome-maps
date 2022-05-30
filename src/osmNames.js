/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2020 Marcus Lundblad
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

/**
 * Utility functions for getting localized names of OSM objects.
 * See https://wiki.openstreetmap.org/wiki/Multilingual_names
 */

import * as Utils from './utils.js';

/**
 * Mapping writing systems (scripts) to languages (most commonly
 * used scripts) and countries where given writing system is the predominant
 * one used.
 *
 * See:
 * https://en.wikipedia.org/wiki/List_of_writing_systems
 */
const WRITING_SYSTEMS = [
    // ARABIC
    {
        languages: new Set(['ar', 'bal', 'bft', 'bhd', 'brh', 'bsk', 'fa',
                            'khv', 'ks', 'ur', 'pa', 'ps', 'sd', 'skr', 'ug',
                            'ckb']),
        countries: new Set(['AE', 'AF', 'BH', 'DZ', 'EG', 'IQ', 'IR', 'JO', 'KW',
                            'LB', 'LY', 'MA', 'OM', 'PK', 'PS', 'QA', 'SA', 'SD',
                            'SY', 'TN', 'YE'])
    },
    // ARMENIAN
    {
        languages: new Set(['am']),
        countries: new Set(['AM'])
    },
    // BENGALI
    {
        languages: new Set(['as', 'bn', 'bpy', 'ctg', 'mni', 'rkt', 'syl']),
        countries: new Set(['BD'])
    },
    // BURMESE
    {
        languages: new Set(['mnv', 'my', 'rki', 'rmz', 'shn']),
        countries: new Set(['MM'])
    },
    // CHINESE
    {
        languages: new Set(['zh', 'yue']),
        countries: new Set(['CN', 'TW'])
    },
    // CYRILLIC
    {
        languages: new Set(['ab', 'abq', 'ady', 'alt', 'alr', 'aqc', 'av', 'ba',
                            'be', 'bg', 'bgx', 'ce', 'chm', 'ckt', 'cnr', 'crh',
                            'cv', 'dar', 'dlg', 'dng', 'eve', 'evn', 'gld',
                            'inh', 'itl', 'jdt', 'kbd', 'kjh', 'koi', 'kpy',
                            'krc', 'kum', 'ky', 'lbe', 'lez', 'mn', 'mk', 'nog',
                            'oaa', 'os', 'ru', 'rue', 'sah', 'sgh', 'sjd', 'sr',
                            'sty', 'tab', 'tg', 'tt', 'ttt', 'tyv', 'uby', 'uk',
                            'ulc', 'uum', 'yah', 'yai']),
        countries: new Set(['BY', 'KG', 'MN', 'TJ', 'RS', 'RU', 'UA'])
    },
    // DEVANAGARI
    {
        languages: new Set(['awa', 'anp', 'bgc', 'bhb', 'bho', 'brx', 'doi',
                            'hi', 'hne', 'kok', 'mag', 'mai', 'mr', 'ne', 'new',
                            'raj', 'sa', 'sgj'])
    },
    // GEORIGIAN
    {
        languages: new Set(['ka']),
        countries: new Set(['GE'])
    },
    // GEEZ
    {
        languages: new Set(['am', 'gez', 'har', 'ti', 'tig']),
        countries: new Set(['ET', 'ER'])
    },
    // GREEK
    {
        languages: new Set(['gr']),
        countries: new Set(['GR'])
    },
    // GUJARATI
    {
        languages: new Set(['gbl', 'gu', 'kfr', 'vas', 'vav'])
    },
    // HEBREW
    {
        languages: new Set(['he', 'yi']),
        countries: new Set(['IL'])
    },
    // JAPANESE
    {
        languages: new Set(['ja']),
        countries: new Set(['JP'])
    },
    // KHMER
    {
        languages: new Set(['km']),
        countries: new Set(['KH'])
    },
    // KOREAN
    {
        languages: new Set(['ko']),
        countries: new Set(['KR', 'NK'])
    },
    // LAO
    {
        languages: new Set(['lo']),
        countries: new Set(['LA'])
    },
    // THAANA
    {
        languages: new Set(['dv']),
        countries: new Set(['MV'])
    },
    // THAI
    {
        languages: new Set(['nod', 'sou', 'th', 'tts']),
        countries: new Set(['TH'])
    }
];

export function getNameForLanguageAndCountry(tags, language, country) {
    let localizedName = _getNameInLanguage(tags, language);

    /* for names in Norwegian, the best practice in OSM is to use the
     * general code 'no' for translated names, unless the translation
     * differs between Bokmål (nb) and Nynorsk (nn), in which case the standard
     * ISO 639-2 codes are used, e.g. the default case from above will be used
     */
    if (!localizedName && (language === 'nb' || language === 'nn'))
        localizedName = _getNameInLanguage(tags, 'no');

    return localizedName ? localizedName :
                           _getFallbackNameForLanguageAndCountry(tags, language,
                                                                 country);
}

export function _getFallbackNameForLanguageAndCountry(tags, language, country) {
    let intName;

    if (_predominantWritingSystemMatchesLanguage(country, language) && tags.name)
        return tags.name;

    let nameInSameScript = _getNameMatchingWritingSystem(language, tags);

    if (nameInSameScript)
        return nameInSameScript;

    switch (country) {
        case 'CN':
            intName = _getNameInLanguage(tags, 'zh_pinyin');
            break;
        case 'JP':
            intName = _getNameInLanguage(tags, 'ja-Latn');
            if (!intName)
                intName = _getNameInLanguage(tags, 'ja_rm');
            break;
        case 'KO':
        case 'NK':
            intName = _getNameInLanguage(tags, 'ko-Latn');
            break;
        case 'RS':
            intName = _getNameInLanguage(tags, 'sr-Latn');
            break;

    }

    let enName = _getNameInLanguage(tags, 'en');

    if (intName)
        return intName;
    else if (tags.int_name)
        return tags.int_name;
    else if (enName)
        return enName;
    else
        return tags.name;
}

function _getNameInLanguage(tags, language) {
    return language === 'C' ? tags.name : tags['name:' + language];
}

function _predominantWritingSystemMatchesLanguage(country, language) {
    let writingSystemOfCountry;
    let writingSystemOfLanguage;

    WRITING_SYSTEMS.forEach(w => {
        if (w.languages.has(language))
            writingSystemOfLanguage = w;

        if (w.countries && w.countries.has(country))
            writingSystemOfCountry = w;
    });

    return writingSystemOfCountry === writingSystemOfLanguage;
}

function _getNameMatchingWritingSystem(language, tags) {
    let writingSystem;
    let name;

    WRITING_SYSTEMS.forEach(w => {
        if (w.languages.has(language))
            writingSystem = w;
    });

    if (writingSystem) {
        writingSystem.languages.forEach(lang => {
            if (tags['name:' + lang])
                name = tags['name:' + lang];
        });
    }

    return name;
}
