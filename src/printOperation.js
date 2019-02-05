/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
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
 * Author: Amisha Singla <amishas157@gmail.com>
 */

const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;

const Application = imports.application;
const PrintLayout = imports.printLayout;
const TransitPrintLayout = imports.transitPrintLayout;
const Utils = imports.utils;

const _MIN_TIME_TO_ABORT = 3000;

var PrintOperation = class PrintOperation {

    constructor(params) {
        this._mainWindow = params.mainWindow;
        delete params.mainWindow;

        this._operation = new Gtk.PrintOperation({ embed_page_setup: true });
        this._operation.connect('begin-print', this._beginPrint.bind(this));
        this._operation.connect('paginate', this._paginate.bind(this));
        this._operation.connect('draw-page', this._drawPage.bind(this));

        this._abortDialog = new Gtk.MessageDialog({
            transient_for: this._mainWindow,
            destroy_with_parent: true,
            message_type: Gtk.MessageType.OTHER,
            modal: true,
            text: _("Loading map tiles for printing"),
            secondary_text: _("You can abort printing if this takes too long")
        });
        this._abortDialog.add_button(_("Abort printing"),
                                     Gtk.ResponseType.CANCEL);
        this._responseId = this._abortDialog.connect('response',
                                                     this.onAbortDialogResponse.bind(this));

        let printSettings = new Gtk.PrintSettings();
        printSettings.set(
            Gtk.PRINT_SETTINGS_OUTPUT_BASENAME,
            this._createFileName()
        );
        this._operation.set_print_settings(printSettings);
        this._runPrintOperation();
    }

    _beginPrint(operation, context, data) {
        let route = Application.routingDelegator.graphHopper.route;
        let selectedTransitItinerary =
            Application.routingDelegator.openTripPlanner.plan.selectedItinerary;
        let width = context.get_width();
        let height = context.get_height();

        Mainloop.timeout_add(_MIN_TIME_TO_ABORT, () => {
            if (this._operation.get_status() !== Gtk.PrintStatus.FINISHED) {
                this._abortDialog.show();
            }
            return false;
        }, null);

        if (selectedTransitItinerary) {
            this._layout =
                new TransitPrintLayout.TransitPrintLayout({ itinerary: selectedTransitItinerary,
                                                            pageWidth: width,
                                                            pageHeight: height });
        } else {
            this._layout = PrintLayout.newFromRoute(route, width, height);
        }
        this._layout.render();
    }

    onAbortDialogResponse(dialog, response) {
        if (response === Gtk.ResponseType.DELETE_EVENT ||
            response === Gtk.ResponseType.CANCEL) {
            this._abortDialog.disconnect(this._responseId);
            this._operation.cancel();
            this._abortDialog.close();
        }
    }

    _paginate(operation, context) {
        if (this._layout.renderFinished) {
            operation.set_n_pages(this._layout.numPages);
            this._abortDialog.close();
        }
        return this._layout.renderFinished;
    }

    _drawPage(operation, context, page_num, data) {
        let cr = context.get_cairo_context();
        this._layout.surfaceObjects[page_num].forEach((so) => {
            cr.setSourceSurface(so.surface, so.x, so.y);
            cr.paint();
        });
    }

    _runPrintOperation() {
        try {
            let result = this._operation.run(Gtk.PrintOperationAction.PRINT_DIALOG,
                                             this._mainWindow);
            if (result === Gtk.PrintOperationResult.ERROR) {
                let error = this._operation.get_error();
                Utils.debug('Failed to print: %s'.format(error));
            }
        } catch(e) {
            Utils.debug('Failed to print: %s'.format(e.message));
        }
    }

    _createFileName() {
        let route = Application.routingDelegator.graphHopper.route;
        let routeTurnPoints = Application.routingDelegator.graphHopper.route.turnPoints;
        /*Utils.debug(routeTurnPoints);*/

        // Turn Point length - 1 is the arrival point, and has street_name = ""
        let startStreetName = routeTurnPoints[0].street_name || "";
        let endStreetName = "";
        // Loop from last element to 2nd element
        for(let i = routeTurnPoints.length; i-- > 1 ; ) {
            if (routeTurnPoints[i].street_name !== "") {
                endStreetName = routeTurnPoints[i].street_name;
                break;
            }
        }

        if (startStreetName !== "" && endStreetName !== "") {
            return `Route from ${startStreetName} to ${endStreetName}`;
        }
        let routeQueryPoints = Application.routingDelegator.graphHopper.routeQueryPoints;
        /*Utils.debug(routeQueryPoints);*/
        let startLocation = routeQueryPoints[0]._place.location;
        let endLocation = routeQueryPoints[routeQueryPoints.length - 1]._place.location;
        
        return `Route from (${startLocation.latitude.toFixed(2)}, ${startLocation.longitude.toFixed(2)}) to (${endLocation.latitude.toFixed(2)}, ${endLocation.longitude.toFixed(2)})`;
    }
};
