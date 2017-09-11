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

const Lang = imports.lang;

const _ = imports.gettext.gettext;

const Gtk = imports.gi.Gtk;

const Application = imports.application;

var TransitMoreRow = new Lang.Class({
    Name: 'TransitMoreRow',
    Extends: Gtk.ListBoxRow,
    Template: 'resource:///org/gnome/Maps/ui/transit-more-row.ui',
    InternalChildren: ['stack',
                       'label'],

    _init: function(params) {
        this.parent(params);

        if (Application.routeQuery.arriveBy)
            this._label.label = _("Load earlier alternatives");
        else
            this._label.label = _("Load later alternatives");
    },

    startLoading: function() {
        this._stack.visible_child_name = 'spinner';
    }
});
