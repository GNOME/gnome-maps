/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2023 Marcus Lundblad.
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

import GObject from 'gi://GObject';
import Rest from 'gi://Rest';

export class OSMOAuthProxyCall extends Rest.OAuth2ProxyCall {

    constructor({ content, method, func, ...params }) {
        super(params);

        this._content = content;
        this.set_method(method);
        this.set_function(func);
        this.add_header('Authorization', 'Bearer ' + this.proxy.access_token);
    }

    vfunc_serialize_params() {
        return [true, 'text/xml', this._content, this._content.length];
    }
}

GObject.registerClass(OSMOAuthProxyCall);

