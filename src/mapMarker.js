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
 * with GNOME Maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Damián Nohales <damiannohales@gmail.com>
 */

const Cairo = imports.gi.cairo;
const Champlain = imports.gi.Champlain;
const Geocode = imports.gi.GeocodeGlib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const Lang = imports.lang;
const Mainloop = imports.mainloop;

const MapWalker = imports.mapWalker;
const Utils = imports.utils;

const MapMarker = new Lang.Class({
    Name: 'MapMarker',
    Extends: Champlain.Marker,
    Abstract: true,
    Signals: {
        'gone-to': { }
    },

    _init: function(params) {
        this._place = params.place;
        delete params.place;

        this._mapView = params.mapView;
        delete params.mapView;

        this._view = this._mapView.view;

        params.latitude = this.place.location.latitude;
        params.longitude = this.place.location.longitude;
        params.selectable = true;

        this.parent(params);

        this.connect('notify::size', this._translateMarkerPosition.bind(this));
        this.connect('notify::selected', this._onMarkerSelected.bind(this));

        // Some markers are draggable, we want to sync the marker location and
        // the location saved in the GeocodePlace
        this.bind_property('latitude',
                           this.place.location, 'latitude',
                           GObject.BindingFlags.DEFAULT);

        this.bind_property('longitude',
                           this.place.location, 'longitude',
                           GObject.BindingFlags.DEFAULT);
    },

    _translateMarkerPosition: function() {
        this.set_translation(-this.anchor.x, -this.anchor.y, 0);
    },

    /**
     * Returns: The anchor point for the marker icon, relative to the
     * top left corner.
     */
    get anchor() {
        return { x: 0, y: 0 };
    },

    get bubbleSpacing() {
        return 0;
    },

    get place() {
        return this._place;
    },

    get bubble() {
        if (this._bubble === undefined)
            this._bubble = this._createBubble();

        return this._bubble;
    },

    _createBubble: function() {
        // Markers has no associated bubble by default
        return null;
    },

    _positionBubble: function(bubble) {
        let [tx, ty, tz] = this.get_translation();
        let x = this._view.longitude_to_x(this.longitude);
        let y = this._view.latitude_to_y(this.latitude);
        let mapSize = this._mapView.get_allocation();

        let pos = new Cairo.RectangleInt({ x: x + tx - this.bubbleSpacing,
                                           y: y + ty - this.bubbleSpacing,
                                           width: this.width + this.bubbleSpacing * 2,
                                           height: this.height + this.bubbleSpacing * 2 });
        bubble.pointing_to = pos;
        bubble.position = Gtk.PositionType.TOP;

        // Gtk+ doesn't provide a widget allocation by calling get_allocation
        // if it's not visible, the bubble positioning occurs when bubble
        // is not visible yet
        let bubbleSize = bubble.get_preferred_size()[1];

        // Set bubble position left/right if it's close to a vertical map edge
        if (pos.x + pos.width / 2 + bubbleSize.width / 2 >= mapSize.width)
            bubble.position = Gtk.PositionType.LEFT;
        else if (pos.x + pos.width / 2 - bubbleSize.width / 2 <= 0)
            bubble.position = Gtk.PositionType.RIGHT;
        // Avoid bubble to cover header bar if the marker is close to the top map edge
        else if (pos.y - bubbleSize.height <= 0)
            bubble.position = Gtk.PositionType.BOTTOM;
    },

    _hideBubbleOn: function(signal, duration) {
        let sourceId = null;
        let signalId = this._view.connect(signal, (function() {
            if (sourceId)
                Mainloop.source_remove(sourceId);
            else
                this.hideBubble();

            let callback = (function() {
                sourceId = null;
                this.showBubble();
            }).bind(this);

            if (duration)
                sourceId = Mainloop.timeout_add(duration, callback);
            else
                sourceId = Mainloop.idle_add(callback);
        }).bind(this));

        Utils.once(this.bubble, 'closed', (function() {
            // We still listening for the signal to refresh
            // the existent timeout
            if (!sourceId)
                this._view.disconnect(signalId);
        }).bind(this));

        Utils.once(this, 'notify::selected', (function() {
            // When the marker gets deselected, we need to ensure
            // that the timeout callback is not called anymore.
            if (sourceId) {
                Mainloop.source_remove(sourceId);
                this._view.disconnect(signalId);
            }
        }).bind(this));
    },

    _initBubbleSignals: function() {
        this._hideBubbleOn('notify::zoom-level', 500);
        this._hideBubbleOn('notify::size');

        // This is done to get just one marker selected at any time regardless
        // of the layer to which it belongs so we can get only one visible bubble
        // at any time. We do this for markers in different layers because for
        // markers in the same layer, ChamplainMarkerLayer single selection mode
        // does the job.
        this._mapView.onSetMarkerSelected(this);

        let markerSelectedSignalId = this._mapView.connect('marker-selected', (function(mapView, selectedMarker) {
            if (this.get_parent() != selectedMarker.get_parent())
                this.selected = false;
        }).bind(this));

        let goingToSignalId = this._mapView.connect('going-to',
                                                    this.set_selected.bind(this, false));
        let buttonPressSignalId = this._view.connect('button-press-event',
                                                     this.set_selected.bind(this, false));
        // Destroy the bubble when the marker is destroyed o removed from a layer
        let parentSetSignalId = this.connect('parent-set',
                                             this.set_selected.bind(this, false));
        let dragMotionSignalId = this.connect('drag-motion',
                                              this.set_selected.bind(this, false));

        Utils.once(this.bubble, 'closed', (function() {
            this._mapView.disconnect(markerSelectedSignalId);
            this._mapView.disconnect(goingToSignalId);
            this._view.disconnect(buttonPressSignalId);
            this.disconnect(parentSetSignalId);
            this.disconnect(dragMotionSignalId);

            this._bubble.destroy();
            delete this._bubble;
        }).bind(this));
    },

    _isInsideView: function() {
        let [tx, ty, tz] = this.get_translation();
        let x = this._view.longitude_to_x(this.longitude);
        let y = this._view.latitude_to_y(this.latitude);
        let mapSize = this._mapView.get_allocation();

        return x + tx + this.width > 0 && x + tx < mapSize.width &&
               y + ty + this.height > 0 && y + ty < mapSize.height;
    },

    showBubble: function() {
        if (this.bubble && !this.bubble.visible && this._isInsideView()) {
            this._initBubbleSignals();
            this.bubble.show();
            this._positionBubble(this.bubble);
        }
    },

    hideBubble: function() {
        if (this._bubble)
            this._bubble.hide();
    },

    get walker() {
        if (this._walker === undefined)
            this._walker = new MapWalker.MapWalker(this.place, this._mapView);

        return this._walker;
    },

    zoomToFit: function() {
        this.walker.zoomToFit();
    },

    goTo: function(animate) {
        Utils.once(this.walker, 'gone-to', (function() {
            this.emit('gone-to');
        }).bind(this));

        this.walker.goTo(animate);
    },

    goToAndSelect: function(animate) {
        Utils.once(this, 'gone-to', (function() {
            this.selected = true;
        }).bind(this));

        this.goTo(animate);
    },

    _onMarkerSelected: function() {
        if (this.selected)
            this.showBubble();
        else
            this.hideBubble();
    }
});
