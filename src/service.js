/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2017 Marcus Lundblad.
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
 *         Jonas Danielsson <jonas@threetimestwo.org>
 */

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

import * as Utils from './utils.js';

let _service = null;

const _SERVICE_URL = 'https://gis.gnome.org/services/v1/service.json';
const _DEFAULT_SERVICE_FILE = 'maps-service.json';

function _getServiceFromFile(filename) {
    let data = Utils.readFile(filename);
    if (!data) {
        log('Failed to open service file: ' + filename);
        System.exit(1);
    }
    _service = JSON.parse(Utils.getBufferText(data));
    return _service;
}

function _createDefaultService() {
    let filename = GLib.build_filenamev([pkg.pkgdatadir,
                                         _DEFAULT_SERVICE_FILE]);
    return _getServiceFromFile(filename);
}

export function getService() {
    if (_service)
        return _service;

    if (GLib.getenv('MAPS_DEFAULT_SERVICE'))
        return _createDefaultService();

    let serviceOverride = GLib.getenv('MAPS_SERVICE');
    if (serviceOverride)
        return _getServiceFromFile(serviceOverride);

    let user_agent = 'gnome-maps/' + pkg.version;
    let session = new Soup.Session({ user_agent : user_agent });
    let msg = Soup.Message.new('GET', _SERVICE_URL);
    try {
        let stream = Gio.DataInputStream.new(session.send(msg, null));

        let lines = "";
        while(true) {
            let [line, _] = stream.read_line_utf8(null);
            if (line === null)
                break;
            lines += line;
        }
        _service = JSON.parse(lines);
        return _service;
    } catch(e) {
        Utils.debug(e);
        return _createDefaultService();
    }
}
