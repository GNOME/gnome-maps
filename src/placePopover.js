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
 * Author: Jonas Danielsson <jonas@threetimestwo.org>
 */

import Geocode from 'gi://GeocodeGlib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {Application} from './application.js';
import {Overpass} from './overpass.js';
import {PlaceListRow} from './placeListRow.js';
import {PlaceStore} from './placeStore.js';
import * as PoiCategories from './poiCategories.js';
import {PoiCategoryGobackRow} from './poiCategoryGobackRow.js';
import {PoiCategoryRow} from './poiCategoryRow.js';
import {SearchPopover} from './searchPopover.js';

const _PLACE_ICON_SIZE = 20;

export class PlacePopover extends SearchPopover {

    constructor({maxChars, hasPoiBrowser = false, ...params}) {
        super(params);

        this._maxChars = maxChars;

        this.list.connect('row-activated', (list, row) => {
            if (row)
                this.emit('selected', row.place);
        });

        if (hasPoiBrowser) {
            this._overpass = new Overpass();
            this._createPoiCategories();
        }

        // This silents warning at Maps exit about this widget being
        // visible but not mapped.
        this.connect('unmap', (popover) => popover.hide());
    }

    get isShowingPoiBrowser() {
        return this._stack.visible_child === this._poiMainCategories ||
               this._stack.visible_child === this._poiSubCategories;
    }

    _createPoiCategories() {
        let categoryStructure = PoiCategories.getCategoryStructure();

        for (let mainCategory of categoryStructure) {
            let row = new PoiCategoryRow({ label:    mainCategory.label,
                                           iconName: mainCategory.icon ??
                                                     'map-marker-symbolic' });

            this._poiMainCategoriesListBox.insert(row, -1);
            row.mainCategory = mainCategory;
        }

        this._poiMainCategoriesListBox.connect('row-activated', (list, row) => {
            let subcategoryListBox =
                this._createSubcategoryListBox(row.mainCategory, row);

            // set stack switching animation to "sliding"
            this._stack.transition_type = Gtk.StackTransitionType.SLIDE_LEFT;
            this._poiSubCategories.child = subcategoryListBox;
            this._stack.visible_child = this._poiSubCategories;
            // unselect current main category
            this._poiMainCategoriesListBox.unselect_all();

            // grab focus on entry to enable continued keyboard navigation
            this.get_parent().placeEntry.grab_focus();
        });
    }

    _createSubcategoryListBox(mainCategory, row) {
        let listBox = new Gtk.ListBox();

        // insert "go back" row
        let goBackRow = new PoiCategoryGobackRow();

        listBox.insert(goBackRow, -1);

        for (let subcategory of mainCategory.subcategories) {
            let row = new PoiCategoryRow({ label:    subcategory.label,
                                           iconName: subcategory.icon ??
                                                     'map-marker-symbolic' });

            listBox.insert(row, -1);
        }

        listBox.connect('row-activated', (list, row) => {
            // grab focus on entry to enable continued keyboard navigation
            this.get_parent().placeEntry.grab_focus();

            if (row === goBackRow) {
                // slide back to main
                this._stack.transition_type =
                    Gtk.StackTransitionType.SLIDE_RIGHT;
                this._stack.visible_child = this._poiMainCategories;

                // unselect, so the "go back" row is not highlighted when going back
                listBox.unselect_all();

                return;
            }

            // the index of the selected category, subtract one for the "go back"
            let index = row.get_index() - 1;
            let selectedCategory = mainCategory.subcategories[index];
            this.showSpinner(Gtk.StackTransitionType.SLIDE_LEFT);
            this._performPoiSearch(selectedCategory);
        });

        return listBox;
    }

    _performPoiSearch(category) {
        let viewport = this._entry.mapView.map.viewport;

        this._poiSearchCancellable = new Gio.Cancellable();
        this._overpass.searchPois(viewport.latitude, viewport.longitude,
                                  category, this._poiSearchCancellable,
                                  (results) => {
            this._poiSearchCancellable = null;

            if (!results) {
                this.showError();
            } else if (results.length === 0) {
                this.showNoResult();
            } else {
                let placeStore = Application.placeStore;
                let completedPlaces = placeStore.getCompletedPlaces(results);

                this.updateResult(completedPlaces, '');
                this.showResult();
                this._entry.grab_focus();
            }
        });
    }

    _showPopover() {
        let {x, y, width, height} = this.get_parent().get_allocation();

        // Magic number to make the alignment pixel perfect.
        this.width_request = width + 20;
        this.popup();
    }

    showPoiMainCategories() {
        let firstRow = this._poiMainCategoriesListBox.get_row_at_index(0);

        if (this._poiSearchCancellable &&
            !this._poiSearchCancellable.is_cancelled()) {
            this._poiSearchCancellable.cancel();
            this._poiSearchCancellable = null;
        }

        this._stack.visible_child = this._poiMainCategories;
        this._poiMainCategoriesListBox.select_row(firstRow);

        if (!this.visible)
            this._showPopover();
    }

    showSpinner(transitionType = Gtk.StackTransitionType.CROSSFADE) {
        this._spinner.start();
        this._stack.transition_type = transitionType;
        this._stack.visible_child = this._spinner;

        /* set the transition to crossfade so the result won't come in
         * with a sliding animation when coming from POI browsing
         */
       this._stack.transition_type = Gtk.StackTransitionType.CROSSFADE;

        if (!this.visible)
            this._showPopover();

        this._numResults = 0;
    }

    showResult() {
        if (this._spinner.spinning)
            this._spinner.stop();

        this._stack.visible_child = this._scrolledWindow;

        let row = this.list.get_row_at_index(0);
        if (row)
            this.list.select_row(row);

        if (!this.visible)
            this._showPopover();
    }

    showNoResult() {
        if (this._spinner.spinning)
            this._spinner.stop();

        this._stack.visible_child = this._noResultsLabel;
        this._numResults = 0;
    }

    showError() {
        if (this._spinner.spinning)
            this._spinner.stop();

        this._stack.visible_child = this._errorLabel;
        this._numResults = 0;
    }

    updateResult(places, searchString) {
        let i = 0;

        places.forEach((p) => {
            let row = this.list.get_row_at_index(i);

            // update existing row, if there is one, otherwise create new
            if (row)
                row.update(p.place, p.type, searchString);
            else
                this._addRow(p.place, p.type, searchString);

            i++;
        });

        this._numResults = i;

        // remove remaining rows
        let row = this.list.get_row_at_index(i);

        while (row) {
            this.list.remove(row);
            row = this.list.get_row_at_index(i);
        }
    }

    /* Selects given row and ensures that it is visible. */
    selectRow(row) {
        this.list.select_row(row);
        let adjustment = this.list.get_adjustment();
        if (adjustment) {
            let allocation = row.get_allocation();
            adjustment.clamp_page(allocation.y, allocation.y + allocation.height);
        }
    }

    _addRow(place, type, searchString) {
        let row = new PlaceListRow({ place:        place,
                                     searchString: searchString,
                                     type:         type,
                                     can_focus:    true });
        this.list.insert(row, -1);
    }
}

GObject.registerClass({
    Signals : {
        'selected' : { param_types: [ GObject.TYPE_OBJECT ] }
    },
    Template: 'resource:///org/gnome/Maps/ui/place-popover.ui',
    Children: [ 'list' ],
    InternalChildren: [ 'scrolledWindow',
                        'stack',
                        'spinner',
                        'noResultsLabel',
                        'errorLabel',
                        'poiMainCategories',
                        'poiMainCategoriesListBox',
                        'poiSubCategories'],
}, PlacePopover);
