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
 */

import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GnomeMaps from "gi://GnomeMaps";
import GObject from "gi://GObject";

import { BoundingBox } from "./boundingBox.js";
import { JsonStorage } from "./jsonStorage.js";
import { PMTilesDownload } from "./pmtiles.js";
import * as Utils from "./utils.js";

const GNOME_MAPS_DIR = "gnome-maps";
const INDEX_FILE = "downloads.json";
const STORAGE_FILE = "downloads.db";

const CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 1 week
/* The maximum size of a download area in number of tiles. This is fairly arbitrary and is mostly in place to prevent
   massive downloads that could fill the user's hard drive or waste bandwidth. */
const MAX_SIZE_TILES = 100_000;

const DOWNLOAD_URL = "https://mapdownloads.gnome.org/streets.pmtiles";

/**
 * Stores the list of downloaded areas and tiles.
 */
export class DownloadManager extends GObject.Object {
    /**
     * @param {{ storage?: JsonStorage }} props
     */
    constructor({ storage } = {}) {
        super();

        /** @private @type {JsonStorage} */
        this._storage =
            storage ??
            new JsonStorage(
                GLib.build_filenamev([
                    GLib.get_user_data_dir(),
                    GNOME_MAPS_DIR,
                    INDEX_FILE,
                ])
            );

        /** @private @type {Gio.ListStore} */
        this._areas = new Gio.ListStore({
            itemType: DownloadArea,
        });

        this._downloadStore = null;

        /** @private For serializing tasks */
        this._downloadTaskRunning = false;
        /** @private @type {DownloadArea[]} */
        this._downloadQueue = [];
        /** @private */
        this._restartQueue = false;
        /** @private */
        this._cancelQueue = null;
        /** @private */
        this._shouldVacuum = false;

        /** @private @type {DownloadProgress?} */
        this._progress = null;
        /** @private */
        this._progressDebounceTimeout = null;

        /** @private */
        this._ignorePause = false;

        this._saveTimeout = null;

        Gio.NetworkMonitor.get_default().connect(
            "notify::network-metered",
            this.pauseReasonsChanged.bind(this),
        );
        Gio.PowerProfileMonitor.dup_default().connect(
            "notify::power-saver-enabled",
            this.pauseReasonsChanged.bind(this),
        );
    }

    /** @private */
    pauseReasonsChanged() {
        this.notify("pause-reasons");
        this.updatePaused();
    }

    /**
     * Gets a file from the download store.
     *
     * @param {string} tileset
     * @param {string} id
     * @returns {Promise<GLib.Bytes | null>} The file data, or null if it doesn't exist.
     */
    async getFile(tileset, id) {
        return await this.downloadStore.get_async(tileset, id);
    }

    /**
     * A Gio.ListStore of DownloadArea objects.
     * @type {Gio.ListStore}
     */
    get areas() {
        return this._areas;
    }

    /**
     * The current progress of the download manager, or null if it is idle.
     * @type {DownloadProgress?}
     */
    get progress() {
        return this._progress;
    }

    /**
     * Whether the user has chosen to download files despite reasons to pause.
     * @type {boolean}
     */
    get ignorePause() {
        return this._ignorePause;
    }

    set ignorePause(ignore) {
        this._ignorePause = ignore;
        this.notify("ignore-pause");
        this.updatePaused();
    }

    get paused() {
        return !this.ignorePause && this.pauseReasons.length > 0;
    }

    /** @private */
    updatePaused() {
        this.notify("paused");
        if (this.paused) {
            this._cancelQueue?.cancel();
        }
        /* When unpausing, we want to restart the processing queue. When pausing, we also want to restart it,
           because not all tasks are affected by pausing. */
        this.processQueue();

        if (this.paused) {
            Utils.debug("Pausing downloads due to: %s".format(this.pauseReasons.join(", ")));
        } else {
            Utils.debug("Resuming downloads");
        }
    }

    /**
     * The reasons why the download manager should be paused, or
     * an empty array if there is no reason to pause. This returns the
     * reasons even if the user has chosen to ignore them.
     * @type {PauseReason[]}
     */
    get pauseReasons() {
        const reasons = [];

        const network = Gio.NetworkMonitor.get_default();
        if (network.network_metered) {
            reasons.push("metered-network");
        }

        const power = Gio.PowerProfileMonitor.dup_default();
        if (power.power_saver_enabled) {
            reasons.push("power-saver");
        }

        return reasons;
    }

    /** @private */
    get downloadStore() {
        if (this._downloadStore === null) {
            this._downloadStore = GnomeMaps.DownloadStore.new();
            this._downloadStore.open(
                GLib.build_filenamev([
                    GLib.get_user_data_dir(),
                    GNOME_MAPS_DIR,
                    STORAGE_FILE,
                ])
            );
        }
        return this._downloadStore;
    }

    /**
     * Loads the index from disk.
     */
    load() {
        try {
            /** @type {Index} */
            const downloads = this._storage.load();

            if (downloads === null) return;

            this._areas.remove_all();
            for (const area of downloads.areas) {
                const downloadArea = new DownloadArea({
                    manager: this,
                    id: area.id,
                    name: area.name,
                    bounds: new BoundingBox(area.bounds),
                    tilesets: area.tilesets,
                });
                this._areas.append(downloadArea);
            }
        } catch (e) {
            log("Failed to load downloads index: " + e);
        }
    }

    /**
     * @private
     * @returns {Index}
     *
     * Produces the JSON representation of the index, suitable for saving to
     * disk.
     */
    toJSON() {
        const areas = [];
        for (const area of this.areas) {
            areas.push(area.toJSON());
        }
        return { areas };
    }

    /**
     * @private
     * Schedule a save to disk. Used for things like renaming an area, so
     * we don't save every time the user types a letter.
     */
    scheduleSave() {
        if (this._saveTimeout !== null) {
            GLib.source_remove(this._saveTimeout);
        }
        this._saveTimeout = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            5,
            () => {
                this._saveTimeout = null;
                this.save();
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    /** If there is a save scheduled, save it now. */
    saveOnQuit() {
        if (this._saveTimeout !== null) {
            GLib.source_remove(this._saveTimeout);
            this.save();
        }
    }

    /**
     * Saves the index to disk.
     */
    save() {
        this._storage.save(this.toJSON());
    }

    /**
     * Adds an area to the index.
     *
     * @param {string} name The display name of the area.
     * @param {BoundingBox} bounds The bounding box of the area.
     * @param {string[]} [tilesets] The tilesets to download. Defaults to ["vector"].
     * @returns {DownloadArea} The new area.
     */
    addArea(name, bounds, tilesets) {
        tilesets = tilesets ?? ["vector"];
        const area = new DownloadArea({
            manager: this,
            id: this.getUnusedId(),
            name,
            bounds,
            tilesets,
        });
        this._areas.append(area);

        this.scheduleSave();
        this.updateArea(area);

        return area;
    }

    /**
     * Ensures that all the tiles in the area are downloaded.
     * @param {DownloadArea} area
     */
    updateArea(area) {
        this._downloadQueue.push(area);
        this.processQueue();
    }

    /** @private */
    notifySizes() {
        for (const area of this.areas) {
            area.recalculateSize();
        }
    }

    /**
     * Determines if the bounding box is too large to download.
     * @param {BoundingBox} bounds
     * @returns {boolean}
     */
    isTooBig(bounds) {
        const nTiles = Math.abs(
            (getXForLng(bounds.right, 14) - getXForLng(bounds.left, 14)) *
                (getYForLat(bounds.bottom, 14) - getYForLat(bounds.top, 14))
        );
        return nTiles > MAX_SIZE_TILES;
    }

    /**
     * Estimates the size of the area in bytes.
     *
     * This is the download size, not the size on disk, which may be larger.
     *
     * @param {BoundingBox} bounds
     * @param {string[]} tilesets
     * @param {Gio.Cancellable} cancellable
     * @returns {Promise<number | null>}
     */
    async getAreaSizeEstimate(bounds, tilesets, cancellable) {
        if (!bounds.isValid()) return null;

        if (this.isTooBig(bounds)) return null;

        let estimate = 0;
        for (const tileset of tilesets) {
            const handler = this.getTilesetHandler(tileset);
            const tiles = handler.getTilesForBounds(bounds);
            estimate += await handler.getSizeEstimate(tiles, cancellable);
        }

        return estimate;
    }

    /**
     * @private
     * Gets an unused ID for a download area.
     * @returns {string}
     */
    getUnusedId() {
        let max = 0;
        for (const area of this._areas) {
            if (/^\d+$/.test(area.id)) {
                max = Math.max(max, parseInt(area.id, 10));
            }
        }
        return (max + 1).toString();
    }

    /**
     * Removes an area from the index.
     * @param {DownloadArea} area
     */
    removeArea(area) {
        const idx = findIndexInModel(this._areas, (a) => a.id === area.id);
        if (idx === -1) return;
        this._areas.remove(idx);
        this.scheduleSave();

        /* If there is a download in progress, cancel it, because it might
           be downloading files for the area we're removing. */
        this._cancelQueue?.cancel();

        this._downloadQueue = this._downloadQueue.filter((a) => a !== area);

        /* Restart the download queue without the removed area. This also deletes any files associated with the area. */
        this.processQueue();
    }

    tilesetHandlers = {
        vector: new VectorTilesetHandler(this),
    };

    /**
     * @private
     * @param {string} tileset
     * @returns {TilesetHandler}
     */
    getTilesetHandler(tileset) {
        return this.tilesetHandlers[tileset];
    }

    /**
     * Begins processing download and update tasks.
     */
    processQueue() {
        retry(async () => await this.queueLoop()).catch((e) => {
            /* If there's an error or cancellation, also cancel any requested restart. */
            this._restartQueue = false;
            this._progress = null;
            this.notify("progress");

            if (!isCancellationError(e)) {
                logError(e);
                this.emit("error", _("Error occurred while downloading"));
            }
        });
    }

    /**
     * @private
     * The main loop for asynchronous tasks.
     */
    async queueLoop() {
        /* If there's another instance of queueLoop running,
           flag it to restart. */
        if (this._downloadTaskRunning) {
            this._restartQueue = true;
            return;
        } else {
            this._downloadTaskRunning = true;
        }

        try {
            while (true) {
                this._restartQueue = false;

                /* Delete unused files */
                const unneeded = await this.getUnneededFiles();
                if (Object.keys(unneeded).length > 0) {
                    this.setProgress("deleting", Object.keys(unneeded).length);

                    await this.transaction(async () => {
                        for (const tileset in unneeded) {
                            await this.downloadStore.remove_async(
                                tileset,
                                unneeded[tileset]
                            );
                            this.advanceProgress(1);
                        }
                    });
                }

                if (this.paused) {
                    /* Pausing only applies to auto updates. If anything has
                       been explicitly added to the queue, download it now. */
                    if (this._downloadQueue.length > 0) {
                        const queue = this._downloadQueue;
                        this._downloadQueue = [];
                        await this.doDownload(queue, true);
                    }
                } else {
                    await this.doDownload(this.areas, false);
                }

                this.setProgress("finishing", 0);

                if (this._shouldVacuum) {
                    await this.downloadStore.exec_async("VACUUM");
                    this._shouldVacuum = false;
                }

                if (!this._restartQueue) {
                    /* If we get here, we're done */
                    break;
                }
            }
        } finally {
            this._downloadTaskRunning = false;
            this._progress = null;
            this.notify("progress");
        }
    }

    /**
     * @private
     * Gets the list of files that are no longer needed and can be deleted.
     * @returns {{ [tileset: string]: string[] }}
     */
    async getUnneededFiles() {
        const needed = {};
        for (const area of this._areas) {
            const tiles = area.getTiles();
            for (const tileset in tiles) {
                needed[tileset] ??= new Set();
                for (const tile of tiles[tileset]) {
                    needed[tileset].add(tile);
                }
            }
        }

        const unneeded = {};
        for (const tileset of await this.downloadStore.list_tilesets_async()) {
            unneeded[tileset] = [];
            for (const id of await this.downloadStore.list_tiles_async(tileset)) {
                if (!needed[tileset]?.has(id)) {
                    unneeded[tileset].push(id);
                }
            }
        }

        return unneeded;
    }

    /**
     * @private
     */
    async transaction(task) {
        await this.downloadStore.exec_async("BEGIN");
        try {
            await task();
        } catch (e) {
            /* Cancellation means some state changed and we should stop downloading, but we should still
                save what's been downloaded so far. */
            if (!isCancellationError(e)) {
                await this.downloadStore.exec_async("ROLLBACK");
                throw e;
            }
        }

        await this.downloadStore.exec_async("COMMIT");
        this.scheduleSave();
        this._shouldVacuum = true;
    }

    /**
     * @private
     * Downloads the given areas.
     *
     * @param {DownloadArea[]} areas The areas to download
     * @param {boolean} missingOnly If true, only download missing files and don't
     * update outdated ones.
     */
    async doDownload(areas, missingOnly) {
        this._cancelQueue = Gio.Cancellable.new();

        this.setProgress("estimating", 0);

        let totalSize = 0;
        /** @type {{ [tileset: string]: Set<string> }} */
        const files = {};

        /* Compute the list of files to download */
        for (const area of areas) {
            for (const tileset of area.tilesets) {
                const tiles = await this.getDownloadList(area, tileset, missingOnly);
                if (tiles.length === 0) continue;

                files[tileset] ??= new Set();
                for (const tile of tiles) {
                    files[tileset].add(tile);
                }
            }
        }

        /* Quit if there's nothing to do */
        if (Object.keys(files).length === 0) return;

        /* Compute the total download size for the progress bar */
        for (const tileset in files) {
            const handler = this.getTilesetHandler(tileset);
            totalSize += await handler.getSizeEstimate(
                Array.from(files[tileset]),
                this._cancelQueue
            );
        }

        this.setProgress(missingOnly ? "downloading" : "updating", totalSize);

        /* Download the files */
        for (const tileset in files) {
            const handler = this.getTilesetHandler(tileset);
            const tiles = Array.from(files[tileset]);

            await this.transaction(async () => {
                let i = 0;

                await handler.download(
                    tiles,
                    this._cancelQueue,
                    async (ids, data, precompressed) => {
                        const size = data.get_size();

                        await this.downloadStore.insert_async(
                            tileset,
                            ids,
                            data,
                            precompressed,
                            Date.now(),
                        );

                        this.advanceProgress(size);

                        if (++i % 1000 === 0) {
                            await this.downloadStore.exec_async("COMMIT");
                            await this.downloadStore.exec_async("BEGIN");
                            this.scheduleSave();
                        }
                    }
                );
            });
        }
    }

    /**
     * @private
     * @param {DownloadArea} area The area to download
     * @param {string} tileset The tileset to download
     * @param {boolean} missingOnly If true, only list missing files,
     * not outdated ones.
     *
     * Gets the list of files that need updating in the given area.
     */
    async getDownloadList(area, tileset, missingOnly = false) {
        const handler = this.getTilesetHandler(tileset);
        const now = Date.now();

        const neededTiles = handler.getTilesForBounds(area.bounds);
        const mtimeThreshold = missingOnly ? 0 : now - CACHE_AGE;
        const foundTiles = new Set(await this.downloadStore.filter_by_mtime_async(tileset, neededTiles, mtimeThreshold));

        return Array.from(neededTiles).filter(tile => !foundTiles.has(tile));
    }

    /**
     * @private
     * @param {"estimating" | "downloading" | "updating" | "deleting" | "finishing"} job The current job
     * @param {number} remaining The amount of work left to do
     */
    setProgress(job, remaining) {
        const jobText = {
            /* Translators: Progress bar text for estimating the download size */
            estimating: _("Estimating"),
            /* Translators: Progress bar text for downloading new offline areas */
            downloading: _("Downloading"),
            /* Translators: Progress bar text for updating offline areas */
            updating: _("Updating"),
            /* Translators: Progress bar text for deleting offline areas */
            deleting: _("Deleting"),
            /* Translators: Progress bar text for a cleanup step */
            finishing: _("Finishing"),
        }[job];

        this._progress = {
            job: jobText,
            remaining,
            completed: 0,
        };

        this.notify("progress");
    }

    /**
     * @private
     * @param {number} completed The amount of work completed
     */
    advanceProgress(completed) {
        this._progress = {
            ...this._progress,
            completed: this._progress.completed + completed,
            remaining: this._progress.remaining - completed,
        };

        /* Debounce the progress signal. Updating the UI more than
           necessary is considerably slow. */
        const currentProgress = this._progress;
        if (this._progressDebounceTimeout === null) {
            this.notify("progress");
            this.notifySizes();

            this._progressDebounceTimeout = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                1000,
                () => {
                    this._progressDebounceTimeout = null;
                    if (this._progress !== currentProgress) {
                        this.notify("progress");
                        this.notifySizes();
                    }
                    return GLib.SOURCE_REMOVE;
                }
            );
        }
    }
}

GObject.registerClass(
    {
        Properties: {
            areas: GObject.ParamSpec.object(
                "areas",
                "",
                "",
                GObject.ParamFlags.READWRITE,
                Gio.ListStore
            ),
            progress: GObject.ParamSpec.jsobject(
                "progress",
                "",
                "",
                GObject.ParamFlags.READABLE
            ),
            pauseReasons: GObject.ParamSpec.jsobject(
                "pause-reasons",
                "",
                "",
                GObject.ParamFlags.READABLE
            ),
            ignorePause: GObject.ParamSpec.boolean(
                "ignore-pause",
                "",
                "",
                GObject.ParamFlags.READWRITE,
                false
            ),
            paused: GObject.ParamSpec.boolean(
                "paused",
                "",
                "",
                GObject.ParamFlags.READABLE,
                false
            ),
        },
        Signals: {
            error: {
                param_types: [GObject.TYPE_STRING],
            },
        },
    },
    DownloadManager
);

class TilesetHandler {
    /**
     * Gets the names of the tiles that cover the given bounding box.
     * @param {BoundingBox} bounds
     * @returns {string[]}
     */
    getTilesForBounds(bounds) {
        throw new Error("Not implemented");
    }

    /** @returns {Promise<number>} */
    async getSizeEstimate(tiles, cancellable) {
        throw new Error("Not implemented");
    }

    /**
     * @callback DownloadCallback
     * @param {string} name
     * @param {GLib.Bytes} data
     * @param {boolean} precompressed
     * @returns {Promise<void>}
     */

    /**
     * @param {string[]} tiles
     * @param {Gio.Cancellable} cancellable
     * @param {DownloadCallback} callback
     */
    async download(tiles, cancellable, callback) {
        throw new Error("Not implemented");
    }

    async delete(name) {
        throw new Error("Not implemented");
    }
}

class VectorTilesetHandler extends TilesetHandler {
    /**
     * @param {DownloadManager} manager
     */
    constructor(manager) {
        super();
        this._manager = manager;

        this._pmTilesDownload = null;
    }

    getTilesForBounds(bounds) {
        return tilesForBounds(bounds).map(
            (tile) => `${tile[0]}/${tile[1]}/${tile[2]}`
        );
    }

    async getSizeEstimate(tiles, cancellable) {
        return await this.getPMTilesDownloader().getDownloadSize(
            this.convertTileNamesToPositions(tiles),
            cancellable
        );
    }

    async download(tiles, cancellable, callback) {
        const download = this.getPMTilesDownloader();
        const tilePositions = this.convertTileNamesToPositions(tiles);

        await download.downloadTiles(
            tilePositions,
            cancellable,
            async (tilePositions, data, precompressed) => {
                await callback(
                    tilePositions.map((pos) => `${pos[0]}/${pos[1]}/${pos[2]}`),
                    data,
                    precompressed
                );
            }
        );
    }

    /** @private */
    getPMTilesDownloader() {
        if (this._pmTilesDownload === null) {
            this._pmTilesDownload = new PMTilesDownload(DOWNLOAD_URL);
        }
        return this._pmTilesDownload;
    }

    /** @private */
    convertTileNamesToPositions(tiles) {
        return tiles.map((tile) => {
            const p = tile.split("/");
            return [parseInt(p[0]), parseInt(p[1]), parseInt(p[2])];
        });
    }
}

const getXForLng = (lng, zoom) => ((lng + 180) / 360) * (1 << zoom);
const getYForLat = (lat, zoom) => {
    const sinLat = Math.sin((lat * Math.PI) / 180);
    return (
        (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) *
        Math.pow(2, zoom)
    );
};

const tilesForBounds = (bounds) => {
    const tiles = [];

    for (let z = 0; z <= 14; z++) {
        const left = Math.floor(getXForLng(bounds.left, z));
        const right = Math.ceil(getXForLng(bounds.right, z));
        const top = Math.floor(getYForLat(bounds.top, z));
        const bottom = Math.ceil(getYForLat(bounds.bottom, z));
        for (let x = left; x < right; x++) {
            for (let y = top; y < bottom; y++) {
                tiles.push([z, x, y]);
            }
        }
    }

    return tiles;
};

export class DownloadArea extends GObject.Object {
    constructor({ manager, ...params }) {
        super(params);
        this._manager = manager;
        this._byteSize = 0;
        this._recalculateSizePromise = null;
        this._pendingSizeRecalculation = false;
    }

    /** @type {string} */
    get id() {
        return this._id;
    }

    set id(id) {
        this._id = id;
    }

    /** @type {string} */
    get name() {
        return this._name;
    }

    set name(name) {
        if (this._name === name) return;
        this._name = name;
        if (this.manager) this.manager.scheduleSave();
        this.notify("name");
    }

    /** @type {BoundingBox} */
    get bounds() {
        return this._bounds;
    }

    set bounds(bounds) {
        this._bounds = bounds;
        this.notify("bounds");
        this.recalculateSize();
    }

    /** @type {string[]} */
    get tilesets() {
        return this._tilesets;
    }

    set tilesets(tilesets) {
        this._tilesets = tilesets;
        this.notify("tilesets");
    }

    get byteSize() {
        return this._byteSize;
    }

    recalculateSize() {
        if (this._pendingSizeRecalculation) {
            return;
        }

        this._pendingSizeRecalculation = true;
        this._recalculateSizePromise = (this._recalculateSizePromise ?? Promise.resolve())
            .then(async () => {
                this._pendingSizeRecalculation = false;

                let sum = 0;
                const tiles = this.getTiles();
                for (const tileset in tiles) {
                    sum += await this.manager.downloadStore.compute_size_async(
                        tileset,
                        tiles[tileset]
                    );
                }

                this._byteSize = sum;
                this.notify("byte-size");
            })
            .catch(logError);

        this.notify("byte-size");
    }

    /** @type {DownloadManager} */
    get manager() {
        return this._manager;
    }

    /** @returns {{ [tileset: string]: string[] }} */
    getTiles() {
        const result = {};
        for (const tileset of this.tilesets) {
            result[tileset] = this.manager
                .getTilesetHandler(tileset)
                .getTilesForBounds(this.bounds);
        }
        return result;
    }

    /** @returns {IndexArea} */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            bounds: this.bounds.toJSON(),
            tilesets: this.tilesets,
        };
    }
}

GObject.registerClass(
    {
        Properties: {
            id: GObject.ParamSpec.string(
                "id",
                "",
                "",
                GObject.ParamFlags.READWRITE |
                    GObject.ParamFlags.CONSTRUCT_ONLY,
                null
            ),
            name: GObject.ParamSpec.string(
                "name",
                "",
                "",
                GObject.ParamFlags.READWRITE,
                null
            ),
            bounds: GObject.ParamSpec.jsobject(
                "bounds",
                "",
                "",
                GObject.ParamFlags.READWRITE
            ),
            tilesets: GObject.ParamSpec.jsobject(
                "tilesets",
                "",
                "",
                GObject.ParamFlags.READWRITE
            ),
            "byte-size": GObject.ParamSpec.uint64(
                "byte-size",
                "",
                "",
                GObject.ParamFlags.READABLE,
                0,
                GLib.MAXUINT64_BIGINT,
                0
            ),
        },
    },
    DownloadArea
);

const findInModel = (model, predicate) => {
    for (const item of model) {
        if (predicate(item)) return item;
    }
}

const findIndexInModel = (model, predicate) => {
    for (let i = 0; i < model.n_items; i++) {
        if (predicate(model.get_item(i))) return i;
    }
    return -1;
}

const isCancellationError = (e) => (e instanceof GLib.Error) && e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED);

async function retry(fn, tries = 3, delay = 1000) {
    for (let i = 0; i < tries; i++) {
        if (i > 0) {
            Utils.debug(`Retrying... (${i}/${tries})`);
        }

        try {
            return await fn();
        } catch (e) {
            if (i === tries - 1 || isCancellationError(e)) {
                throw e;
            }

            logError(e);

            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
}

/**
 * JSDoc definitions for the JSON representation of the index.
 *
 * @typedef {object} IndexFile
 * @property {number} size
 * @property {number} mtime
 *
 * @typedef {object} IndexArea
 * @property {number} id The unique ID of the area.
 * @property {string} name The display name of the area.
 * @property {{left: number, right: number, top: number, bottom: number}} bounds The bounding box of the area.
 * @property {string[]} tilesets The tilesets to download.
 *
 * @typedef {Object} Index
 * @property {IndexArea[]} areas
 */

/**
 * @typedef DownloadProgress
 * @property {string} job A translated string describing the current job
 * @property {number} completed The amount of work completed
 * @property {number} remaining The amount of work left to do
 *
 * @typedef PauseReason
 * @type {"metered-network" | "power-saver"}
 */
