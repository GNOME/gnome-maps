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

const Cairo = imports.cairo;
const Champlain = imports.gi.Champlain;
const Clutter = imports.gi.Clutter;
const Gdk = imports.gi.Gdk;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;

const MapWalker = imports.mapWalker;
const Utils = imports.utils;

var MapMarker = GObject.registerClass({
    Implements: [Champlain.Exportable],
    Abstract: true,
    Signals: {
        'gone-to': { }
    },
    Properties: {
        'surface': GObject.ParamSpec.override('surface',
                                              Champlain.Exportable)
    }
}, class MapMarker extends Champlain.Marker {

    _init(params) {
        this._place = params.place;
        delete params.place;

        this._mapView = params.mapView;
        delete params.mapView;

        params.latitude = this.place.location.latitude;
        params.longitude = this.place.location.longitude;
        params.selectable = true;

        super._init(params);

        this.connect('notify::size', this._translateMarkerPosition.bind(this));
        if (this._mapView) {
            this._view = this._mapView.view;
            this.connect('notify::selected', this._onMarkerSelected.bind(this));
            this.connect('button-press', this._onButtonPress.bind(this));

            // Some markers are draggable, we want to sync the marker location and
            // the location saved in the GeocodePlace
            this.bind_property('latitude',
                               this.place.location, 'latitude',
                               GObject.BindingFlags.DEFAULT);

            this.bind_property('longitude',
                               this.place.location, 'longitude',
                               GObject.BindingFlags.DEFAULT);
            this._view.connect('notify::latitude', this._onViewUpdated.bind(this));
            this._view.connect('notify::longitude', this._onViewUpdated.bind(this));
            this._view.connect('notify::zoom-level', this._onViewUpdated.bind(this));
        }
    }

    get surface() {
        return this._surface;
    }

    set surface(v) {
        this._surface = v;
    }

    vfunc_get_surface() {
        return this._surface;
    }

    vfunc_set_surface(surface) {
        this._surface = surface;
    }

    _actorFromIconName(name, size, color) {
        try {
            let theme = Gtk.IconTheme.get_default();
            let pixbuf;

            if (color) {
                let info = theme.lookup_icon(name, size, 0);
                pixbuf = info.load_symbolic(color, null, null, null)[0];
            } else {
                pixbuf = theme.load_icon(name, size, 0);
            }

            let canvas = new Clutter.Canvas({ width: pixbuf.get_width(),
                                              height: pixbuf.get_height() });

            canvas.connect('draw', (canvas, cr) => {
                cr.setOperator(Cairo.Operator.CLEAR);
                cr.paint();
                cr.setOperator(Cairo.Operator.OVER);

                Gdk.cairo_set_source_pixbuf(cr, pixbuf, 0, 0);
                cr.paint();

                this._surface = cr.getTarget();
            });

            let actor = new Clutter.Actor();
            actor.set_content(canvas);
            actor.set_size(pixbuf.get_width(), pixbuf.get_height());
            canvas.invalidate();

            return actor;
        } catch (e) {
            Utils.debug('Failed to load image: %s'.format(e.message));
            return null;
        }
    }

    _onButtonPress(marker, event) {
        // Zoom in on marker on double-click
        if (event.get_click_count() > 1) {
            if (this._view.zoom_level < this._view.max_zoom_level) {
                this._view.zoom_level = this._view.max_zoom_level;
                this._view.center_on(this.latitude, this.longitude);
            }
        }
    }

    _translateMarkerPosition() {
        this.set_translation(-this.anchor.x, -this.anchor.y, 0);
    }

    /**
     * Returns: The anchor point for the marker icon, relative to the
     * top left corner.
     */
    get anchor() {
        return { x: 0, y: 0 };
    }

    get bubbleSpacing() {
        return 0;
    }

    get place() {
        return this._place;
    }

    get bubble() {
        if (this._bubble === undefined)
            this._bubble = this._createBubble();

        return this._bubble;
    }

    _createBubble() {
        // Markers has no associated bubble by default
        return null;
    }

    _positionBubble(bubble) {
        let [tx, ty, tz] = this.get_translation();
        let x = this._view.longitude_to_x(this.longitude);
        let y = this._view.latitude_to_y(this.latitude);
        let mapSize = this._mapView.get_allocation();

        let pos = new Gdk.Rectangle({ x: x + tx - this.bubbleSpacing,
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
    }

    _hideBubbleOn(signal, duration) {
        let sourceId = null;
        let signalId = this._view.connect(signal, () => {
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
        });

        Utils.once(this.bubble, 'closed', () => {
            // We still listening for the signal to refresh
            // the existent timeout
            if (!sourceId)
                this._view.disconnect(signalId);
        });

        Utils.once(this, 'notify::selected', () => {
            // When the marker gets deselected, we need to ensure
            // that the timeout callback is not called anymore.
            if (sourceId) {
                Mainloop.source_remove(sourceId);
                this._view.disconnect(signalId);
            }
        });
    }

    _initBubbleSignals() {
        this._hideBubbleOn('notify::zoom-level', 500);
        this._hideBubbleOn('notify::size');

        // This is done to get just one marker selected at any time regardless
        // of the layer to which it belongs so we can get only one visible bubble
        // at any time. We do this for markers in different layers because for
        // markers in the same layer, ChamplainMarkerLayer single selection mode
        // does the job.
        this._mapView.onSetMarkerSelected(this);

        let markerSelectedSignalId = this._mapView.connect('marker-selected', (mapView, selectedMarker) => {
            if (this.get_parent() !== selectedMarker.get_parent())
                this.selected = false;
        });

        let goingToSignalId = this._mapView.connect('going-to', () => {
            this.set_selected(false);
        });
        let buttonPressSignalId =
            this._view.connect('button-press-event', () => {
                this.set_selected(false);
            });
        // Destroy the bubble when the marker is destroyed o removed from a layer
        let parentSetSignalId = this.connect('parent-set', () => {
            this.set_selected(false);
        });
        let dragMotionSignalId = this.connect('drag-motion', () => {
            this.set_selected(false);
        });
        Utils.once(this.bubble, 'closed', () => {
            this._mapView.disconnect(markerSelectedSignalId);
            this._mapView.disconnect(goingToSignalId);
            this._view.disconnect(buttonPressSignalId);
            this.disconnect(parentSetSignalId);
            this.disconnect(dragMotionSignalId);

            this._bubble.destroy();
            delete this._bubble;
        });
    }

    _isInsideView() {
        let [tx, ty, tz] = this.get_translation();
        let x = this._view.longitude_to_x(this.longitude);
        let y = this._view.latitude_to_y(this.latitude);
        let mapSize = this._mapView.get_allocation();

        return x + tx + this.width > 0 && x + tx < mapSize.width &&
               y + ty + this.height > 0 && y + ty < mapSize.height;
    }

    _onViewUpdated() {
        if (this.bubble) {
            if (this._isInsideView())
                this._positionBubble(this.bubble);
            else
                this.bubble.hide();
        }
    }

    showBubble() {
        if (this.bubble && !this.bubble.visible && this._isInsideView()) {
            this._initBubbleSignals();
            this.bubble.show();
            this._positionBubble(this.bubble);
        }
    }

    hideBubble() {
        if (this._bubble)
            this._bubble.hide();
    }

    get walker() {
        if (this._walker === undefined)
            this._walker = new MapWalker.MapWalker(this.place, this._mapView);

        return this._walker;
    }

    zoomToFit() {
        this.walker.zoomToFit();
    }

    goTo(animate) {
        Utils.once(this.walker, 'gone-to', () => this.emit('gone-to'));
        this.walker.goTo(animate);
    }

    goToAndSelect(animate) {
        Utils.once(this, 'gone-to', () => this.selected = true);

        this.goTo(animate);
    }

    _onMarkerSelected() {
        if (this.selected)
            this.showBubble();
        else
            this.hideBubble();
    }
});
