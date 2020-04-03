/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2011, 2012, 2013 Red Hat, Inc.
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
 * Author: Zeeshan Ali (Khattak) <zeeshanak@gnome.org>
 *         Mattias Bengtsson <mattias.jc.bengtsson@gmail.com>
 */

const Cairo = imports.cairo;
const Gdk = imports.gi.Gdk;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;

const Application = imports.application;
const InstructionRow = imports.instructionRow;
const PlaceStore  = imports.placeStore;
const RouteEntry = imports.routeEntry;
const RouteQuery = imports.routeQuery;
const StoredRoute = imports.storedRoute;
const TransitArrivalRow = imports.transitArrivalRow;
const TransitItineraryRow = imports.transitItineraryRow;
const TransitLegRow = imports.transitLegRow;
const TransitMoreRow = imports.transitMoreRow;
const TransitOptionsPanel = imports.transitOptionsPanel;
const Utils = imports.utils;

var Sidebar = GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/sidebar.ui',
    InternalChildren: [ 'distanceInfo',
                        'entryList',
                        'instructionList',
                        'instructionWindow',
                        'instructionSpinner',
                        'instructionStack',
                        'errorLabel',
                        'modeBikeToggle',
                        'modeCarToggle',
                        'modePedestrianToggle',
                        'modeTransitToggle',
                        'timeInfo',
                        'linkButtonStack',
                        'transitWindow',
                        'transitRevealer',
                        //'transitOptionsPanel',
                        'transitHeader',
                        'transitListStack',
                        'transitOverviewListBox',
                        'transitItineraryHeader',
                        'transitItineraryListBox',
                        'transitItineraryBackButton',
                        'transitItineraryTimeLabel',
                        'transitItineraryDurationLabel',
                        'transitAttributionLabel']
}, class Sidebar extends Gtk.Revealer {

    _init(mapView) {
        super._init({ transition_type: Gtk.RevealerTransitionType.SLIDE_LEFT });

        this._mapView = mapView;

        this._query = Application.routeQuery;
        this._initInstructionList();

        /* I could not get the custom GTK+ template widget to init properly
         * from the UI file, we also need to manually insert the transit
         * itinerary header widget into the GtkStack to get the correct
         * animation direction.
         */
        this._transitOptionsPanel =
            new TransitOptionsPanel.TransitOptionsPanel({ visible: true });
        this._transitHeader.add_named(this._transitOptionsPanel, 'options');
        this._transitHeader.add_named(this._transitItineraryHeader,
                                      'itinerary-header');
        this._initTransportationToggles(this._modePedestrianToggle,
                                        this._modeBikeToggle,
                                        this._modeCarToggle,
                                        this._modeTransitToggle);

        this._initQuerySignals();
        this._query.addPoint(0);
        this._query.addPoint(1);
        this._switchRoutingMode(Application.routeQuery.transportation);
        /* Enable/disable transit mode switch based on the presence of
         * public transit providers.
         * For some reason, setting visible to false in the UI file and
         * dynamically setting visible false here doesn't work, maybe because
         * it's part of a radio group? As a workaround, just remove the button
         * instead.
         */
        if (!Application.routingDelegator.transitRouter.enabled)
            this._modeTransitToggle.destroy();
    }

    _initTransportationToggles(pedestrian, bike, car, transit) {
        let transport = RouteQuery.Transportation;

        let onToggle = function(mode, button) {
            let previousMode = this._query.transportation;

            if (button.active && previousMode !== mode) {
                this._switchRoutingMode(mode);
                this._query.transportation = mode;
            }
        };
        pedestrian.connect('toggled', onToggle.bind(this, transport.PEDESTRIAN));
        car.connect('toggled', onToggle.bind(this, transport.CAR));
        bike.connect('toggled', onToggle.bind(this, transport.BIKE));
        transit.connect('toggled', onToggle.bind(this, transport.TRANSIT))

        let setToggles = function() {
            switch(Application.routeQuery.transportation) {
            case transport.PEDESTRIAN:
                pedestrian.active = true;
                break;
            case transport.CAR:
                car.active = true;
                break;
            case transport.BIKE:
                bike.active = true;
                break;
            case transport.TRANSIT:
                transit.active = true;
                break;
            }

            this._switchRoutingMode(Application.routeQuery.transportation);
        };

        setToggles.bind(this)();
        this._query.connect('notify::transportation', setToggles.bind(this));
    }

    _switchRoutingMode(mode) {
        if (mode === RouteQuery.Transportation.TRANSIT) {
            Application.routingDelegator.useTransit = true;
            this._linkButtonStack.visible_child_name = 'transit';
            this._transitOptionsPanel.reset();
            this._transitRevealer.reveal_child = true;
        } else {
            Application.routingDelegator.useTransit = false;
            this._linkButtonStack.visible_child_name = 'turnByTurn';
            this._transitRevealer.reveal_child = false;
            Application.routingDelegator.transitRouter.plan.deselectItinerary();
        }
        this._clearInstructions();
    }

    _initQuerySignals() {
        this._query.connect('point-added', (obj, point, index) => {
            this._createRouteEntry(index, point);
        });

        this._query.connect('point-removed', (obj, point, index) => {
            let row = this._entryList.get_row_at_index(index);
            row.destroy();
        });
    }

    _cancelStore() {
        Mainloop.source_remove(this._storeRouteTimeoutId);
        this._storeRouteTimeoutId = 0;
    }

    _createRouteEntry(index, point) {
        let type;
        if (index === 0)
            type = RouteEntry.Type.FROM;
        else if (index === this._entryList.get_children().length)
            type = RouteEntry.Type.TO;
        else
            type = RouteEntry.Type.VIA;

        let routeEntry = new RouteEntry.RouteEntry({ type: type,
                                                     point: point,
                                                     mapView: this._mapView });
        this._entryList.insert(routeEntry, index);

        if (type === RouteEntry.Type.FROM) {
            routeEntry.button.connect('clicked', () => {
                let lastIndex = this._entryList.get_children().length;
                this._query.addPoint(lastIndex - 1);
            });

            this.connect('notify::child-revealed', () => {
                if (this.child_revealed)
                    routeEntry.entry.grab_focus_without_selecting();
            });
        } else if (type === RouteEntry.Type.VIA) {
            routeEntry.button.connect('clicked', () => {
                let row = routeEntry.get_parent();
                this._query.removePoint(row.get_index());
            });
        } else if (type === RouteEntry.Type.TO) {
            routeEntry.button.connect('clicked',
                                      this._reverseRoutePoints.bind(this));
        }

        this._initRouteDragAndDrop(routeEntry);
    }

    _initInstructionList() {
        let route = Application.routingDelegator.graphHopper.route;
        let transitPlan = Application.routingDelegator.transitRouter.plan;

        route.connect('reset', () => {
            this._clearInstructions();

            let length = this._entryList.get_children().length;
            for (let index = 1; index < (length - 1); index++) {
                this._query.removePoint(index);
            }
        });

        transitPlan.connect('reset', () => {
            this._clearTransitOverview();
            this._showTransitOverview();
            this._instructionStack.visible_child = this._transitWindow;
            /* don't remove query points as with the turn-based routing,
             * since we might get "no route" because of the time selected
             * and so on */
            this._transitAttributionLabel.label = '';
        });

        transitPlan.connect('no-more-results', () => {
            // set the "load more" row to indicate no more results
            let numRows = this._transitOverviewListBox.get_children().length;
            let loadMoreRow = this._transitOverviewListBox.get_row_at_index(numRows - 2);
            loadMoreRow.showNoMore();
        });

        this._query.connect('run', () => {
            this._instructionStack.visible_child = this._instructionSpinner;
        });

        this._query.connect('notify', () => {
            if (this._instructionStack.visible_child !== this._instructionSpinner &&
                this._instructionStack.visible_child !== this._errorLabel) {
                if (this._query.transportation === RouteQuery.Transportation.TRANSIT) {
                    this._clearTransitOverview();
                    this._showTransitOverview();
                    this._transitAttributionLabel.label = '';
                } else {
                    this._clearInstructions();
                }
            }

            if (this._storeRouteTimeoutId)
                this._cancelStore();

        });

        route.connect('update', () => {
            this._clearInstructions();

            if (this._storeRouteTimeoutId)
                this._cancelStore();

            this._storeRouteTimeoutId = Mainloop.timeout_add(5000, () => {
                let placeStore = Application.placeStore;
                let places = this._query.filledPoints.map(function(point) {
                    return point.place;
                });
                let storedRoute = new StoredRoute.StoredRoute({
                    transportation: this._query.transportation,
                    route: route,
                    places: places,
                    geoclue: Application.geoclue
                });

                if (!storedRoute.containsNull) {
                    placeStore.addPlace(storedRoute,
                                        PlaceStore.PlaceType.RECENT_ROUTE);
                }
                this._storeRouteTimeoutId = 0;
            });

            route.turnPoints.forEach((turnPoint) => {
                let row = new InstructionRow.InstructionRow({ visible: true,
                                                              turnPoint: turnPoint });
                this._instructionList.add(row);
            });

            /* Translators: %s is a time expression with the format "%f h" or "%f min" */
            this._timeInfo.label = _("Estimated time: %s").format(Utils.prettyTime(route.time));
            this._distanceInfo.label = Utils.prettyDistance(route.distance);
        });

        this._instructionList.connect('row-selected', (listbox, row) => {
            if (row)
                this._mapView.showTurnPoint(row.turnPoint);
        });

        transitPlan.connect('update', () => {
            this._updateTransitAttribution();
            this._clearTransitOverview();
            this._showTransitOverview();
            this._populateTransitItineraryOverview();
        });

        /* use list separators for the transit itinerary overview list */
        this._transitOverviewListBox.set_header_func((row, prev) => {
            if (prev)
                row.set_header(new Gtk.Separator());
        });

        this._transitOverviewListBox.connect('row-activated',
                                             this._onItineraryOverviewRowActivated.bind(this));
        this._transitItineraryBackButton.connect('clicked',
                                                 this._showTransitOverview.bind(this));

        // connect error handlers
        route.connect('error', (route, msg) => this._showError(msg));
        transitPlan.connect('error', (plan, msg) => this._showError(msg));
    }

    _showError(msg) {
        this._instructionStack.visible_child = this._errorLabel;
        this._errorLabel.label = msg;
    }

    _clearTransitOverview() {
        let listBox = this._transitOverviewListBox;
        listBox.forall(listBox.remove.bind(listBox));

        this._instructionStack.visible_child = this._transitWindow;
        this._timeInfo.label = '';
        this._distanceInfo.label = '';
    }

    _clearTransitItinerary() {
        let listBox = this._transitItineraryListBox;
        listBox.forall(listBox.remove.bind(listBox));
    }

    _updateTransitAttribution() {
        let plan = Application.routingDelegator.transitRouter.plan;

        if (plan.attribution) {
            let attributionLabel =
                _("Itineraries provided by %s").format(plan.attribution);
            if (plan.attributionUrl) {
                this._transitAttributionLabel.label =
                    '<a href="%s">%s</a>'.format([plan.attributionUrl],
                                                 attributionLabel);
            } else {
                this._transitAttributionLabel.label = attributionLabel;
            }
        } else {
            this._transitAttributionLabel.label = '';
        }
    }

    _showTransitOverview() {
        let plan = Application.routingDelegator.transitRouter.plan;

        this._transitListStack.visible_child_name = 'overview';
        this._transitHeader.visible_child_name = 'options';
        plan.deselectItinerary();
    }

    _showTransitItineraryView() {
        this._transitListStack.visible_child_name = 'itinerary';
        this._transitHeader.visible_child_name = 'itinerary-header';
    }

    _populateTransitItineraryOverview() {
        let plan = Application.routingDelegator.transitRouter.plan;

        plan.itineraries.forEach((itinerary) => {
            let row =
                new TransitItineraryRow.TransitItineraryRow({ visible: true,
                                                              itinerary: itinerary });
            this._transitOverviewListBox.add(row);
        });
        /* add the "load more" row */
        this._transitOverviewListBox.add(
            new TransitMoreRow.TransitMoreRow({ visible: true }));

        /* add an empty list row to get a final separator */
        this._transitOverviewListBox.add(new Gtk.ListBoxRow({ visible: true }));
    }

    _onItineraryActivated(itinerary) {
        let plan = Application.routingDelegator.transitRouter.plan;

        this._populateTransitItinerary(itinerary);
        this._showTransitItineraryView();
        plan.selectItinerary(itinerary);
    }

    _onMoreActivated(row) {
        row.startLoading();
        Application.routingDelegator.transitRouter.fetchMoreResults();
    }

    _onItineraryOverviewRowActivated(listBox, row) {
        this._transitOverviewListBox.unselect_all();

        if (row.itinerary)
            this._onItineraryActivated(row.itinerary);
        else
            this._onMoreActivated(row);
    }

    _populateTransitItinerary(itinerary) {
        this._transitItineraryTimeLabel.label =
            itinerary.prettyPrintTimeInterval();
        this._transitItineraryDurationLabel.label =
            itinerary.prettyPrintDuration();

        this._clearTransitItinerary();
        for (let i = 0; i < itinerary.legs.length; i++) {
            let leg = itinerary.legs[i];
            let row = new TransitLegRow.TransitLegRow({ leg: leg,
                                                        start: i === 0,
                                                        mapView: this._mapView });
            this._transitItineraryListBox.add(row);
        }

        /* insert the additional arrival row, showing the arrival place and time */
        this._transitItineraryListBox.add(
            new TransitArrivalRow.TransitArrivalRow({ itinerary: itinerary,
                                                      mapView: this._mapView }));
    }


    _clearInstructions() {
        let listBox = this._instructionList;
        listBox.forall(listBox.remove.bind(listBox));

        this._instructionStack.visible_child = this._instructionWindow;
        this._timeInfo.label = '';
        this._distanceInfo.label = '';
    }

    // Iterate over points and establish the new order of places
    _reorderRoutePoints(srcIndex, destIndex) {
        let points = this._query.points;
        let srcPlace = this._draggedPoint.place;

        // Determine if we are swapping from "above" or "below"
        let step = (srcIndex < destIndex) ? -1 : 1;

        // Hold off on notifying the changes to query.points until
        // we have re-arranged the places.
        this._query.freeze_notify();

        for (let i = destIndex; i !== (srcIndex + step); i += step) {
            // swap
            [points[i].place, srcPlace] = [srcPlace, points[i].place];
        }

        this._query.thaw_notify();
    }

    /* The reason we don't just use the array .reverse() function is that we
     * need to update the place parameters on the actual point objects in the
     * array to fire the query notify signal that will iniate an update.
     */
    _reverseRoutePoints() {
        let points = this._query.points;
        let length = points.length;

        this._query.freeze_notify();
        for (let i = 0; i < length / 2; i++) {
            let p1 = points[i].place;
            let p2 = points[length - i - 1].place;

            points[i].place = p2;
            points[length - i - 1].place = p1;
        }
        this._query.thaw_notify();
    }

    _onDragDrop(row, context, x, y, time) {
        let srcIndex = this._query.points.indexOf(this._draggedPoint);
        let destIndex = row.get_index();

        this._reorderRoutePoints(srcIndex, destIndex);
        Gtk.drag_finish(context, true, false, time);
        return true;
    }

    _dragHighlightRow(row) {
        row.opacity = 0.6;
    }

    _dragUnhighlightRow(row) {
        row.opacity = 1.0;
    }

    // Set the opacity of the row we are currently dragging above
    // to semi transparent.
    _onDragMotion(row, context, x, y, time) {
        let routeEntry = row.get_child();

        if (this._draggedPoint && this._draggedPoint !== routeEntry.point) {
            this._dragHighlightRow(row);
            Gdk.drag_status(context, Gdk.DragAction.MOVE, time);
        } else
            Gdk.drag_status(context, 0, time);
        return true;
    }

    // Drag ends, show the dragged row again.
    _onDragEnd(context, row) {
        this._draggedPoint = null;

        // Restore to natural height
        row.height_request = -1;
        row.get_child().show();
    }

    // Drag begins, set the correct drag icon and hide the dragged row.
    _onDragBegin(context, row) {
        let routeEntry = row.get_child();
        let width = row.get_allocated_width();
        let height = row.get_allocated_height();
        let surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, width, height);
        let cr = new Cairo.Context(surface)

        row.draw(cr);
        this._draggedPoint = routeEntry.point;

        // Set a fixed height on the row to prevent the sidebar height
        // to shrink while dragging a row.
        row.height_request = height;
        row.get_child().hide();

        Gtk.drag_set_icon_surface(context, surface);
    }

    // Set up drag and drop between RouteEntrys. The drag source is from a
    // GtkEventBox that contains the start/end icon next in the entry. And
    // the drag destination is the ListBox row.
    _initRouteDragAndDrop(routeEntry) {
        let dragIcon = routeEntry.iconEventBox;
        let row = routeEntry.get_parent();

        dragIcon.drag_source_set(Gdk.ModifierType.BUTTON1_MASK,
                                 null,
                                 Gdk.DragAction.MOVE);
        dragIcon.drag_source_add_image_targets();

        row.drag_dest_set(Gtk.DestDefaults.MOTION,
                          null,
                          Gdk.DragAction.MOVE);
        row.drag_dest_add_image_targets();

        dragIcon.connect('drag-begin', (icon, context) => this._onDragBegin(context, row));
        dragIcon.connect('drag-end', (icon, context) => this._onDragEnd(context, row));

        row.connect('drag-leave', this._dragUnhighlightRow.bind(this, row));
        row.connect('drag-motion', this._onDragMotion.bind(this));
        row.connect('drag-drop', this._onDragDrop.bind(this));
    }
});
