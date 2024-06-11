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

import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {Application} from './application.js';
import {LongPrintLayout} from './longPrintLayout.js';
import {ShortPrintLayout} from './shortPrintLayout.js';
import {TransitPrintLayout} from './transitPrintLayout.js';
import * as Utils from './utils.js';

const _MIN_TIME_TO_ABORT = 3000;

/* Following constant has unit as meters */
const _SHORT_LAYOUT_MAX_DISTANCE = 3000;

export class PrintOperation {

    constructor({mainWindow}) {
        this._mainWindow = mainWindow;

        this._operation = new Gtk.PrintOperation({ embed_page_setup: true });
        this._operation.connect('begin-print', this._beginPrint.bind(this));
        this._operation.connect('paginate', this._paginate.bind(this));
        this._operation.connect('draw-page', this._drawPage.bind(this));

        this._abortDialog = new Adw.AlertDialog({
            heading: _("Loading map tiles for printing"),
            body: _("You can abort printing if this takes too long"),
            canClose: false
        });
        this._abortDialog.add_response('abort', _("Abort printing"));
        this._abortDialog.set_response_appearance('abort',
                                                  Adw.ResponseAppearance.DESTRUCTIVE);
        this._responseId = this._abortDialog.connect('response',
                                                     this.onAbortDialogResponse.bind(this));

        this._runPrintOperation();
    }

    _beginPrint(operation, context, data) {
        let route = Application.routingDelegator.route;
        let selectedTransitItinerary =
            Application.routingDelegator.transitRouter.plan.selectedItinerary;
        let width = context.get_width();
        let height = context.get_height();

        if (selectedTransitItinerary) {
            this._layout =
                new TransitPrintLayout({ itinerary: selectedTransitItinerary,
                                         pageWidth: width,
                                         pageHeight: height,
                                         mainWindow: this._mainWindow });
        } else {
            // TODO: for now just use short layout, as we don't have minimaps
            this._layout = new ShortPrintLayout({ route: route,
                                                  pageWidth: width,
                                                  pageHeight: height,
                                                  mainWindow: this._mainWindow });
            /*
            if (route.distance > _SHORT_LAYOUT_MAX_DISTANCE) {
                this._layout = new LongPrintLayout({ route: route,
                                                     pageWidth: width,
                                                     pageHeight: height,
                                                     mainWindow: this._mainWindow });
            } else {
                this._layout = new ShortPrintLayout({ route: route,
                                                      pageWidth: width,
                                                      pageHeight: height,
                                                      mainWindow: this._mainWindow });
            }
            */
        }

        GLib.timeout_add(null, _MIN_TIME_TO_ABORT, () => {
            if (!this._layout.renderFinished) {
                this._abortDialog.present(this._mainWindow);
            }
            return false;
        });

        this._layout.render();
    }

    onAbortDialogResponse(dialog, response) {
        if (response === 'abort') {
            this._abortDialog.disconnect(this._responseId);
            this._operation.cancel();
            this._abortDialog.force_close();
        }
    }

    _paginate(operation, context) {
        if (this._layout) {
            if (this._layout.renderFinished) {
                operation.set_n_pages(this._layout.numPages);
                this._abortDialog.force_close();
            }
            return this._layout.renderFinished;
        } else {
            return false;
        }
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
}
