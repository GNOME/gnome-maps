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

import Cairo from 'cairo';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {Application} from './application.js';
import {InstructionRow} from './instructionRow.js';
import {PlaceStore} from './placeStore.js';
import {QueryPoint} from './routeQuery.js';
import {RouteEntry} from './routeEntry.js';
import {RouteQuery} from './routeQuery.js';
import {StoredRoute} from './storedRoute.js';
import {TransitArrivalRow} from './transitArrivalRow.js';
import {TransitItineraryRow} from './transitItineraryRow.js';
import {TransitLegRow} from './transitLegRow.js';
import {TransitMoreRow} from './transitMoreRow.js';
import {TransitOptionsPanel} from './transitOptionsPanel.js';
import * as Utils from './utils.js';

const ID_PEDESTRIAN = 'pedestrian';
const ID_CAR = 'car';
const ID_BIKE = 'bike';
const ID_TRANSIT = 'transit';

export class Sidebar extends Gtk.Grid {

    constructor({ mapView, ...params }) {
        super(params);

        this._mapView = mapView;

        this._query = Application.routeQuery;
        this._initInstructionList();

        /* I could not get the custom GTK+ template widget to init properly
         * from the UI file, we also need to manually insert the transit
         * itinerary header widget into the GtkStack to get the correct
         * animation direction.
         */
        this._transitOptionsPanel = new TransitOptionsPanel({ visible: true });
        this._transitHeader.add_named(this._transitOptionsPanel, 'options');
        this._transitHeader.add_named(this._transitItineraryHeader,
                                      'itinerary-header');
        this._initTransportationToggles();

        this._initQuerySignals();
        this._query.addPoint(0);
        this._query.addPoint(1);
        this._switchRoutingMode(Application.routeQuery.transportation);
    }

    focusStartEntry() {
        this._entryList.get_row_at_index(0).child.entry.grab_focus();
    }

    _initTransportationToggles() {
        const transport = RouteQuery.Transportation;

        this._modeChooser.connect('notify::active', () => {
            const activeModeId = this._modeChooser.active_name;
            let mode;

            if (activeModeId === ID_PEDESTRIAN) {
                mode = transport.PEDESTRIAN;
            } else if (activeModeId === ID_CAR) {
                mode = transport.CAR;
            } else if (activeModeId === ID_BIKE) {
                mode = transport.BIKE;
            } else if (activeModeId === ID_TRANSIT) {
                mode = transport.TRANSIT;
            }

            let previousMode = this._query.transportation;

            if (previousMode !== mode) {
                this._switchRoutingMode(mode);
                this._query.transportation = mode;
            }
        });

        let setToggles = function() {
            let activeModeId;

            switch(Application.routeQuery.transportation) {
            case transport.PEDESTRIAN:
                activeModeId = ID_PEDESTRIAN;
                break;
            case transport.CAR:
                activeModeId = ID_CAR;
                break;
            case transport.BIKE:
                activeModeId = ID_BIKE;
                break;
            case transport.TRANSIT:
                activeModeId = ID_TRANSIT;
                break;
            }

            this._modeChooser.active_name = activeModeId;

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
        this._numRouteEntries = 0;
        this._query.connect('point-added', (obj, point, index) => {
            this._createRouteEntry(index, point);
            this._numRouteEntries++;
        });

        this._query.connect('point-removed', (obj, point, index) => {
            let row = this._entryList.get_row_at_index(index);
            this._entryList.remove(row);
            this._numRouteEntries--;
        });
    }

    _cancelStore() {
        GLib.source_remove(this._storeRouteTimeoutId);
        this._storeRouteTimeoutId = 0;
    }

    _createRouteEntry(index, point) {
        let type;
        if (index === 0)
            type = RouteEntry.Type.FROM;
        else if (index === this._numRouteEntries)
            type = RouteEntry.Type.TO;
        else
            type = RouteEntry.Type.VIA;

        let routeEntry = new RouteEntry({ type: type,
                                          point: point,
                                          mapView: this._mapView });

        routeEntry.entry.connect('notify::place', () => {
            this._onRouteEntrySelectedPlace(routeEntry.entry);
        });
        this._entryList.insert(routeEntry, index);

        if (type === RouteEntry.Type.FROM) {
            routeEntry.button.connect('clicked', () => {
                let lastIndex = this._numRouteEntries;
                this._query.addPoint(lastIndex - 1);
                // focus on the newly added point's entry
                this._entryList.get_row_at_index(lastIndex - 1).get_child().entry.grab_focus();
            });

            this.connect('notify::child-revealed', () => {
                if (this.child_revealed)
                    routeEntry.entry.grab_focus();
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

    _onRouteEntrySelectedPlace(entry) {
        let [index, numEntries] = this._getIndexForRouteEntryAndNumEntries(entry);

        /* if a new place is selected and it's not the last entry, focus next
         * entry
         */
        if (entry.place && index < numEntries - 1) {
            let nextPlaceEntry =
                this._entryList.get_row_at_index(index + 1).get_child().entry;

            if (!nextPlaceEntry.place)
                nextPlaceEntry.grab_focus();
        }
    }

    _getIndexForRouteEntryAndNumEntries(entry) {
        let index = 0;
        let foundIndex = -1;

        for (let item of this._entryList) {
            let routeEntry = item.get_child();

            if (routeEntry.entry === entry)
                foundIndex = index;

            index++;
        }

        return [foundIndex, index];
    }

    // this is needed to be called on shutdown to avoid a GTK warning
    unparentSearchPopovers() {
        for (let item of this._entryList) {
            item.get_child().entry.popover.unparent();
        }
    }

    _initInstructionList() {
        let route = Application.routingDelegator.route;
        let transitPlan = Application.routingDelegator.transitRouter.plan;

        route.connect('reset', () => {
            this._clearInstructions();

            let length = 0;

            for (let entry of this._entryList) {
                length++;
            }

            for (let index = 1; index < (length - 1); index++) {
                this._query.removePoint(1);
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
            let loadMoreRow;

            for (let row of this._transitOverviewListBox) {
                if (row instanceof TransitMoreRow)
                    loadMoreRow = row;
            }

            loadMoreRow.showNoMore();
        });

        this._query.connect('run', () => {
            this._transitHeader.visible_child_name = 'options';
            this._instructionStack.visible_child = this._instructionSpinner;
        });

        this._query.connect('cancel', () => {
           this._clearInstructions();
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

            this._storeRouteTimeoutId = GLib.timeout_add(null, 5000, () => {
                let placeStore = Application.placeStore;
                let places = this._query.filledPoints.map(function(point) {
                    return point.place;
                });
                let storedRoute = new StoredRoute({
                    transportation: this._query.transportation,
                    route: route,
                    places: places,
                    geoclue: Application.geoclue
                });

                if (!storedRoute.containsNull && !storedRoute.containsCurrentLocation) {
                    placeStore.addPlace(storedRoute);
                }
                this._storeRouteTimeoutId = 0;
            });

            route.turnPoints.forEach((turnPoint) => {
                let row = new InstructionRow({ turnPoint: turnPoint,
                                               transportation: this._query.transportation} );
                this._instructionList.insert(row, -1);
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

    _clearListBox(listBox) {
        let rows = [];

        for (let row of listBox) {
            if (row instanceof Gtk.ListBoxRow)
                rows.push(row);
        }

        for (let row of rows) {
            listBox.remove(row);
        }
    }

    _clearTransitOverview() {
        let listBox = this._transitOverviewListBox;

        this._clearListBox(listBox);
        this._instructionStack.visible_child = this._transitWindow;
        this._timeInfo.label = '';
        this._distanceInfo.label = '';
    }

    _clearTransitItinerary() {
        let listBox = this._transitItineraryListBox;

        this._clearListBox(listBox);
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
            const row = new TransitItineraryRow({ itinerary: itinerary });
            this._transitOverviewListBox.insert(row, -1);
        });
        /* add the "load more" row */
        this._transitOverviewListBox.insert(new TransitMoreRow(), -1);
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
        const direct =
            itinerary.legs.length === 1 && !itinerary.legs[0].isTransit;

        this._transitItineraryTimeLabel.label =
            itinerary.prettyPrintTimeInterval();
        this._transitItineraryDurationLabel.label =
            itinerary.prettyPrintDuration();

        this._clearTransitItinerary();
        for (const [i, leg] of itinerary.legs.entries()) {
            const row = new TransitLegRow({ leg: leg,
                                            start: i === 0,
                                            direct: direct,
                                            mapView: this._mapView });
            this._transitItineraryListBox.insert(row, -1);
        }

        /* insert the additional arrival row, showing the arrival place and time */
        this._transitItineraryListBox.insert(
            new TransitArrivalRow({ itinerary: itinerary, mapView: this._mapView }),
            -1);
    }


    _clearInstructions() {
        let listBox = this._instructionList;

        this._clearListBox(listBox);
        this._instructionStack.visible_child = this._instructionWindow;
        this._timeInfo.label = '';
        this._distanceInfo.label = '';
    }

    // Iterate over points and establish the new order of places
    _reorderRoutePoints(srcIndex, destIndex) {
        let points = this._query.points;
        let srcPlace = this._query.points[srcIndex].place;

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
     * array to fire the query notify signal that will initiate an update.
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

    _onDragDrop(row, point) {
        let srcIndex = this._query.points.indexOf(point);
        let destIndex = row.get_index();

        this._reorderRoutePoints(srcIndex, destIndex);

        return true;
    }

    // Drag ends, show the dragged row again.
    _onDragEnd(row) {
        row.opacity = 1.0;
    }

    _onDragPrepare(point, source, x, y) {
        return Gdk.ContentProvider.new_for_value(point);
    }

    // Drag begins, set the correct drag icon and dim the dragged row.
    _onDragBegin(source, row) {
        let routeEntry = row.get_child();
        let {x, y, width, height} = row.get_allocation();
        let paintable = new Gtk.WidgetPaintable({ widget: routeEntry });

        source.set_icon(paintable, 0, 0);
        row.opacity = 0.6;
    }

    // Set up drag and drop between RouteEntrys. The drag source is from a
    // GtkEventBox that contains the start/end icon next in the entry. And
    // the drag destination is the ListBox row.
    _initRouteDragAndDrop(routeEntry) {
        let dragIcon = routeEntry.icon;
        let row = routeEntry.get_parent();
        let dragSource = new Gtk.DragSource();

        dragIcon.add_controller(dragSource);

        dragSource.connect('prepare',
                           this._onDragPrepare.bind(this, routeEntry.point));
        dragSource.connect('drag-begin',
                           (source, drag, widget) =>
                           this._onDragBegin(source, row));
        dragSource.connect('drag-end',
                           (source, dele, data) => this._onDragEnd(row));

        let dropTarget = Gtk.DropTarget.new(QueryPoint, Gdk.DragAction.COPY);

        row.add_controller(dropTarget);

        dropTarget.connect('drop',
                           (target, value, x, y, data) =>
                           this._onDragDrop(row, value));
    }
}

GObject.registerClass({
    Template: 'resource:///org/gnome/Maps/ui/sidebar.ui',
    InternalChildren: [ 'distanceInfo',
                        'entryList',
                        'instructionList',
                        'instructionWindow',
                        'instructionSpinner',
                        'instructionStack',
                        'errorLabel',
                        'modeChooser',
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
}, Sidebar);
