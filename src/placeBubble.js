/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2014 Damián Nohales
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
 * Author: Damián Nohales <damiannohales@gmail.com>
 */

const GdkPixbuf = imports.gi.GdkPixbuf;
const Geocode = imports.gi.GeocodeGlib;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Format = imports.format;

const Application = imports.application;
const ContactPlace = imports.contactPlace;
const MapBubble = imports.mapBubble;
const OSMAccountDialog = imports.osmAccountDialog;
const OSMEditDialog = imports.osmEditDialog;
const OSMUtils = imports.osmUtils;
const Overpass = imports.overpass;
const Place = imports.place;
const PlaceFormatter = imports.placeFormatter;
const PlaceStore = imports.placeStore;
const Utils = imports.utils;
const Wikipedia = imports.wikipedia;

// maximum dimension of thumbnails to fetch from Wikipedia
const THUMBNAIL_FETCH_SIZE = 128;
// final scaled size of cropped thumnail
const THUMBNAIL_FINAL_SIZE = 70;

var PlaceBubble = GObject.registerClass({
    Properties: {
        'overpass-place': GObject.ParamSpec.object('overpass-place',
                                                   'Overpass Place',
                                                   'The place as filled in by Overpass',
                                                   GObject.ParamFlags.READABLE |
                                                   GObject.ParamFlags.WRITABLE,
                                                   Geocode.Place)
    }
}, class PlaceBubble extends MapBubble.MapBubble {

    _init(params) {
        let ui = Utils.getUIObject('place-bubble', [ 'stack',
                                                     'box-content',
                                                     'grid-content',
                                                     'label-title',
                                                     'edit-button',
                                                     'expand-button',
                                                     'expanded-content',
                                                     'content-revealer']);
        params.buttons = (MapBubble.Button.ROUTE |
                          MapBubble.Button.SEND_TO);

        if (params.place.store)
            params.buttons |= MapBubble.Button.FAVORITE;

        super._init(params);

        Utils.load_icon(this.place.icon, 48, (pixbuf) => this.image.pixbuf = pixbuf);

        this._stack = ui.stack;
        this._title = ui.labelTitle;
        this._boxContent = ui.boxContent;
        this._gridContent = ui.gridContent;
        this._editButton = ui.editButton;
        this._expandButton = ui.expandButton;
        this._expandedContent = ui.expandedContent;
        this._revealer = ui.contentRevealer;

        let overpass = new Overpass.Overpass();

        /* use a property binding from the Overpass instance to avoid
         * accessing accessing this object after the underlying GObject has
         * been finalized */
        overpass.bind_property('place', this, 'overpass-place',
                               GObject.BindingFlags.DEFAULT);
        this.connect('notify::overpass-place', () => this._onInfoAdded());

        if (Application.placeStore.exists(this.place, null)) {

            // If the place is stale, update from Overpass.
            if (Application.placeStore.isStale(this.place)) {
                overpass.addInfo(this.place);
            } else {
                this._place = Application.placeStore.get(this.place);
                this._populate(this.place);
            }
        } else if (this.place.store && !this.place.prefilled) {
            overpass.addInfo(this.place);
        } else {
            this._populate(this.place);
        }
        this.content.add(this._stack);

        let osm_id = this.place.osm_id;
        if (this.place instanceof ContactPlace.ContactPlace || !osm_id)
            this._editButton.visible = false;
        else
            this._initEditButton();

        this._initExpandButton();
    }

    _onInfoAdded() {
        this._populate(this.place);
        if (Application.placeStore.exists(this.place, null))
            Application.placeStore.updatePlace(this.place);
        else
            Application.placeStore.addPlace(this.place, PlaceStore.PlaceType.RECENT);
    }

    _formatWikiLink(wiki) {
        let lang = Wikipedia.getLanguage(wiki);
        let article = Wikipedia.getArticle(wiki);

        return Format.vprintf('https://%s.wikipedia.org/wiki/%s', [ lang, article ]);
    }

    /*
     * Create an array of all content to be showed when expanding the place
     * bubble
     */
    _createExpandedContent(place) {
        let expandedContent = [];

        if (place.population) {
            /* TODO: this is a bit of a work-around to re-interpret the population,
             * stored as a string into an integer to convert back to a locale-
             * formatted string. Ideally it should be kept as an integer value
             * in the Place class. But this will also need to be handled by the
             * PlaceStore, possible in a backwards-compatible way
             */
            expandedContent.push({ label: _("Population:"),
                                   info: parseInt(place.population).toLocaleString() });
        }

        if (place.location.altitude > 0) {
            let alt  = place.location.altitude;
            expandedContent.push({ label: _("Altitude:"),
                                   info: Utils.prettyDistance(alt, true) });
        }

        if (place.openingHours) {
            expandedContent.push({ label: _("Opening hours:"),
                                   info: place.openingHoursTranslated });
        }

        if (place.internetAccess) {
            expandedContent.push({ label: _("Internet access:"),
                                   info: place.internetAccessTranslated });
        }

        if (place.religion) {
            expandedContent.push({ label: _("Religion:"),
                                   info: place.religionTranslated });
        }

        if (place.toilets) {
            expandedContent.push({ label: _("Toilets:"),
                                   info: place.toiletsTranslated });
        }

        if (place.wheelchair) {
            expandedContent.push({ label: _("Wheelchair access:"),
                                   info: place.wheelchairTranslated });
        }

        if (place.phone) {
            if (Utils.uriSchemeSupported('tel')) {
                expandedContent.push({ label: _("Phone:"),
                                       linkText: place.phone,
                                       linkUrl: 'tel:%s'.format(place.phone) });
            } else {
                expandedContent.push({ label: _("Phone:"),
                                       info: place.phone });
            }
        }

        if (place.wiki) {
            let link = this._formatWikiLink(place.wiki);
            expandedContent.push({ linkText: _("Wikipedia"),
                                   linkUrl: link});
        }

        return expandedContent;
    }

    _attachContent(content, expandedContent) {
        content.forEach((info) => {
            let label = new Gtk.Label({ label: info,
                                        visible: true,
                                        use_markup: true,
                                        halign: Gtk.Align.START });
            this._boxContent.pack_start(label, false, true, 0);
        });

        expandedContent.forEach(({ label, linkUrl, linkText, info }, row) => {
            let widget;

            if (label) {
                widget = new Gtk.Label({ label: label.italics(),
                                         visible: true,
                                         use_markup: true,
                                         yalign: 0,
                                         halign: Gtk.Align.START });
                this._expandedContent.attach(widget, 0, row, 1, 1);
            }

            if (linkUrl) {
                let uri = GLib.markup_escape_text(linkUrl, -1);
                /* double-escape the tooltip text, as GTK+ treats it as markup */
                let tooltipText = GLib.markup_escape_text(uri, -1);
                info = '<a href="%s" title="%s">%s</a>'.format(uri,
                                                               tooltipText,
                                                               linkText);
            }

            widget = new Gtk.Label({ label: info,
                                     visible: true,
                                     use_markup: true,
                                     max_width_chars: 25,
                                     wrap: true,
                                     halign: Gtk.Align.START });

            if(label)
                this._expandedContent.attach(widget, 1, row, 1, 1);
            else
                // Expand over both columns if this row has no label
                this._expandedContent.attach(widget, 0, row, 2, 1);
        });
    }

    _populate(place) {
        let formatter = new PlaceFormatter.PlaceFormatter(place);

        // refresh place view
        this._clearView();

        let content = formatter.rows.map((row) => {
            row = row.map(function(prop) {
                return GLib.markup_escape_text(place[prop], -1);
            });
            return row.join(', ');
        });
        let expandedContent = this._createExpandedContent(place);

        this._attachContent(content, expandedContent);

        let title = GLib.markup_escape_text(formatter.title, -1);
        if (place.website) {
            let uri = GLib.markup_escape_text(place.website, -1);
            this._title.label = '<a href="%s">%s</a>'.format(uri, title);
        } else {
            this._title.label = title;
        }
        this._expandButton.visible = expandedContent.length > 0;
        this._stack.visible_child = this._gridContent;

        if (place.wiki)
            this._requestWikipediaThumbnail(place.wiki);
    }

    _requestWikipediaThumbnail(wiki) {
        Wikipedia.fetchArticleThumbnail(wiki, THUMBNAIL_FETCH_SIZE,
                                        this._onThumbnailComplete.bind(this));
    }

    _onThumbnailComplete(thumbnail) {
        if (thumbnail) {
            this.thumbnail.pixbuf = this._cropAndScaleThumbnail(thumbnail);
            this.iconStack.visible_child_name = 'thumbnail';
        }
    }

    // returns a cropped square-shaped thumbnail
    _cropAndScaleThumbnail(thumbnail) {
        let width = thumbnail.get_width();
        let height = thumbnail.get_height();
        let croppedThumbnail;

        if (width > height) {
            let x = (width - height) / 2;
            croppedThumbnail = thumbnail.new_subpixbuf(x, 0, height, height);
        } else {
            let y = (height - width) / 2;
            croppedThumbnail = thumbnail.new_subpixbuf(0, y, width, width);
        }

        return croppedThumbnail.scale_simple(THUMBNAIL_FINAL_SIZE,
                                             THUMBNAIL_FINAL_SIZE,
                                             GdkPixbuf.InterpType.BILINEAR);
    }

    // clear the view widgets to be able to re-populate an updated place
    _clearView() {
        this._boxContent.get_children().forEach((child) => child.destroy());
        this._expandedContent.get_children().forEach((child) => child.destroy());
    }

    _initEditButton() {
        this._editButton.visible = true;
        this._editButton.connect('clicked', this._onEditClicked.bind(this));
    }

    _initExpandButton() {
        let image = this._expandButton.get_child();

        this._expandButton.connect('clicked', (function() {
            this._revealer.reveal_child = !this._revealer.child_revealed;
        }).bind(this));
    }

    _onEditClicked() {
        let osmEdit = Application.osmEdit;
        /* if the user is not alread signed in, show the account dialog */
        if (!osmEdit.isSignedIn) {
            let dialog = osmEdit.createAccountDialog(this.get_toplevel(), true);

            dialog.show();
            dialog.connect('response', (dialog, response) => {
                dialog.destroy();
                if (response === OSMAccountDialog.Response.SIGNED_IN)
                    this._edit();
            });

            return;
        }

        this._edit();
    }

    _edit() {
        let osmEdit = Application.osmEdit;
        let dialog = osmEdit.createEditDialog(this.get_toplevel(), this._place);

        dialog.show();
        dialog.connect('response', (dialog, response) => {
            dialog.destroy();

            switch (response) {
            case OSMEditDialog.Response.UPLOADED:
                // update place
                let object = osmEdit.object;
                OSMUtils.updatePlaceFromOSMObject(this._place, object);
                // refresh place view
                this._clearView();
                this._populate(this._place);
                break;
            default:
                break;
            }
        });
    }
});
