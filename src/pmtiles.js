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

import GLib from "gi://GLib";
import Gio from "gi://Gio";
import Soup from "gi://Soup";
import * as Utils from "./utils.js";
import System from "system";

const Compression = {
    UNKNOWN: 0,
    NONE: 1,
    GZIP: 2,
    BROTLI: 3,
    ZSTD: 4,
};

/** Maximum amount of data to fetch in a single tile request (16MB) */
const MAX_RANGE_LENGTH = 1 << 24;
/** Number of parallel requests to make when downloading tiles. Tiles are generally downloaded in lots of small ranges,
 * so having multiple requests in flight at once can significantly improve performance. */
const PARALLEL_DOWNLOADS = 4;

/** @typedef {{offset: number, length: number}} Range */
/** @typedef {[number, number, number]} TilePos */

const createCaches = (header, rootDir) => {
    return {
        header,
        rootDir,
        leafDirs: new LRUCache(100),
        tileRanges: new LRUCache(1000),
    };
}

/**
 * Download tiles from a PMTiles file.
 */
export class PMTilesDownload {
    constructor(url) {
        /** @private */
        this._url = url;

        this._caches = null;

        /** @private */
        this._session = null;
    }

    get url() {
        return this._url;
    }

    /**
     * Estimates the amount of tile data to be downloaded. This calculation
     * requires downloading index information from the PMTiles file.
     *
     * @param {TilePos[]} tiles
     * @param {Gio.Cancellable} cancellable
     * @returns {Promise<number>}
     */
    async getDownloadSize(tiles, cancellable) {
        Utils.debug(`Estimating download size for ${tiles.length} tiles`);

        const caches = await this.getCaches();
        const plan = await this.getDownloadPlan(tiles, cancellable, caches);

        return plan.reduce((acc, range) => {
            return acc + range.range.length;
        }, 0);
    }

    /** @private */
    async getCaches() {
        if (this._caches) {
            return this._caches;
        }

        const [header, rootDir] = await this.fetchHeaderAndRootDir();
        this._caches = createCaches(header, rootDir);
        return this._caches;
    }

    /**
     * @callback TileCallback
     * @param {TilePos[]} tilePositions
     * @param {GLib.Bytes} data
     * @param {boolean} precompressed
     * @returns {Promise<void>}
     *
     * Note: Because PMTiles deduplicates tile data, the same data may be
     * returned for multiple tile positions. This is why @tilePositions is an
     * array.
     */

    /**
     * Downloads the tiles from the PMTiles file and calls the callback
     * for each one.
     *
     * @param {Gio.Cancellable} cancellable
     * @param {TileCallback} callback
     * @returns {Promise<void>}
     */
    async downloadTiles(tiles, cancellable, callback) {
        const caches = await this.getCaches();
        const plan = await this.getDownloadPlan(tiles, cancellable, caches);

        const totalSize = plan.reduce((acc, range) => {
            return acc + range.range.length;
        }, 0);
        Utils.debug(
            `Downloading ${tiles.length} tiles, ${totalSize} bytes in ${plan.length} ranges`
        );

        /* Sort ranges by size to improve parallelism */
        plan.sort((a, b) => a.range.length - b.range.length);

        await parallelLoop(plan, async (range) => {
            cancellable?.set_error_if_cancelled();

            if (range.range.length === 0) {
                const empty = new GLib.Bytes([]);
                for (const tile of range.tiles) {
                    await callback(tile.tiles, empty, false);
                }
                return;
            }

            const [stream, _etag] = await this.fetch(
                range.range.offset,
                range.range.offset + range.range.length - 1,
                cancellable,
                caches.header.etag,
            );

            try {
                for (const tile of range.tiles) {
                    let remaining = tile.length;
                    let chunks = [];
                    while (remaining > 0) {
                        const bytes = await stream.read_bytes_async(
                            remaining,
                            Gio.PRIORITY_DEFAULT,
                            cancellable
                        );
                        if (bytes.get_size() === 0) {
                            throw new Error("Unexpected end of stream");
                        }
                        chunks.push(bytes);
                        remaining -= bytes.get_size();
                    }

                    let tileData, precompressed;
                    if (caches.header.tileCompression === Compression.GZIP) {
                        tileData = decompress(chunks, Compression.NONE);
                        precompressed = true;
                    } else {
                        tileData = decompress(chunks, caches.header.tileCompression);
                        precompressed = false;
                    }

                    await callback(tile.tiles, tileData, precompressed);
                }
            } finally {
                stream.close(null);
            }
        }, PARALLEL_DOWNLOADS);
    }

    /**
     * @private
     * @param {TilePos[]} tiles
     */
    async getDownloadPlan(tiles, cancellable, caches) {
        const ranges = [];
        let i = 0;
        for (const tile of tiles) {
            cancellable?.set_error_if_cancelled();

            i++;
            if (i % 1000 === 0) {
                /* yield to the main loop so the UI doesn't stutter */
                await new Promise((resolve) => {
                    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                        resolve();
                        return GLib.SOURCE_REMOVE;
                    });
                });
            }

            const range = await this.getTileRange(getTileID(tile), caches);
            if (range === null) {
                ranges.push({
                    range: {
                        offset: 0,
                        length: 0,
                    },
                    tile,
                });
            } else {
                ranges.push({
                    range,
                    tile,
                });
            }
        }

        /* sort by offset */
        ranges.sort((a, b) => a.range.offset - b.range.offset);

        /* merge adjacent ranges */
        const mergedRanges = [];
        let currentRange = null;

        for (const nextRange of ranges) {
            if (currentRange !== null) {
                if (
                    currentRange.range.offset === nextRange.range.offset &&
                    currentRange.range.length === nextRange.range.length
                ) {
                    currentRange.tiles[
                        currentRange.tiles.length - 1
                    ].tiles.push(nextRange.tile);
                    continue;
                } else if (
                    currentRange.range.offset + currentRange.range.length ===
                        nextRange.range.offset &&
                    currentRange.range.length < MAX_RANGE_LENGTH
                ) {
                    currentRange.range.length += nextRange.range.length;
                    currentRange.tiles.push({
                        length: nextRange.range.length,
                        tiles: [nextRange.tile],
                    });
                    continue;
                }
            }

            if (currentRange !== null) {
                mergedRanges.push(currentRange);
            }
            currentRange = {
                range: { ...nextRange.range },
                tiles: [
                    {
                        length: nextRange.range.length,
                        tiles: [nextRange.tile],
                    },
                ],
            };
        }
        if (currentRange !== null) {
            mergedRanges.push(currentRange);
        }

        /* Download planning creates a lot of temporary objects, so it's a good time to run GC. */
        System.gc();

        this._downloadPlan = mergedRanges;
        return mergedRanges;
    }

    /** @private */
    async fetchHeaderAndRootDir() {
        const [data, etag] = await this.fetchAll(0, 127);

        const dataview = new DataView(data.toArray().buffer);

        /* Check for magic number */
        if ((dataview.getBigInt64(0, false) & ~0xffn) !== 0x504d54696c657300n) {
            throw new Error(
                "Invalid PMTiles file -- magic number does not match"
            );
        } else if (dataview.getUint8(7) !== 3) {
            throw new Error(
                `Invalid PMTiles file -- version number was ${dataview.getUint8(
                    7
                )}, expected 3`
            );
        }

        const header = {
            etag,
            rootDir: {
                offset: Number(dataview.getBigUint64(0x08, true)),
                length: Number(dataview.getBigUint64(0x10, true)),
            },
            metadata: {
                offset: Number(dataview.getBigUint64(0x18, true)),
                length: Number(dataview.getBigUint64(0x20, true)),
            },
            leafDirs: {
                offset: Number(dataview.getBigUint64(0x28, true)),
                length: Number(dataview.getBigUint64(0x30, true)),
            },
            tileData: {
                offset: Number(dataview.getBigUint64(0x38, true)),
                length: Number(dataview.getBigUint64(0x40, true)),
            },
            nAddressedTiles: Number(dataview.getBigUint64(0x48, true)),
            nTileEntries: Number(dataview.getBigUint64(0x50, true)),
            nTileContents: Number(dataview.getBigUint64(0x58, true)),
            clustered: !!dataview.getUint8(0x60),
            internalCompression: dataview.getUint8(0x61),
            tileCompression: dataview.getUint8(0x62),
            tileType: dataview.getUint8(0x63),
            minZoom: dataview.getUint8(0x64),
            maxZoom: dataview.getUint8(0x65),
            minPos: {
                lon: dataview.getInt32(0x66, true) / 10_000_000,
                lat: dataview.getInt32(0x6a, true) / 10_000_000,
            },
            maxPos: {
                lon: dataview.getInt32(0x6e, true) / 10_000_000,
                lat: dataview.getInt32(0x72, true) / 10_000_000,
            },
            centerZoom: dataview.getUint8(0x76),
            centerPos: {
                lon: dataview.getInt32(0x77, true) / 10_000_000,
                lat: dataview.getInt32(0x7b, true) / 10_000_000,
            },
        };

        if (!compressionSupported(header.internalCompression)) {
            throw new Error(
                `Unsupported internal compression: ${header.internalCompression}`
            );
        }

        if (!compressionSupported(header.tileCompression)) {
            throw new Error(
                `Unsupported tile compression: ${header.tileCompression}`
            );
        }

        const [rootDirData, _etag] = await this.fetchAll(
            header.rootDir.offset,
            header.rootDir.offset + header.rootDir.length - 1,
            header.internalCompression,
            null,
            header.etag,
        );

        return [header, readDirectory(rootDirData.toArray())];
    }

    /** @private */
    async fetchLeafDir(offset, length, caches) {
        const existing = caches.leafDirs.get(offset);
        if (existing) {
            return existing;
        }

        const [data, _etag] = await this.fetchAll(
            caches.header.leafDirs.offset + offset,
            caches.header.leafDirs.offset + offset + length - 1,
            caches.header.internalCompression,
            null,
            caches.header.etag,
        );

        const leafDir = readDirectory(data.toArray());
        caches.leafDirs.set(offset, leafDir);

        return leafDir;
    }

    /**
     * @private
     * @returns {Promise<[Gio.InputStream, string]>}
     */
    async fetch(start, end, cancellable, etag) {
        const msg = Soup.Message.new("GET", this.url);
        msg.request_headers.set_range(start, end);
        if (etag) {
            msg.request_headers.append("If-Match", etag);
        }

        const stream = await this.soupSession.send_async(
            msg,
            GLib.PRIORITY_DEFAULT_IDLE,
            cancellable ?? null
        );

        if (msg.status_code !== 206) {
            if (msg.status_code === 200) {
                throw new Error("Server does not support range requests");
            } else if (msg.status_code === 412) {
                if (this._caches?.header.etag === etag) {
                    this._caches = null;
                }

                throw new Error("ETag does not match");
            } else {
                throw new Error("HTTP error: " + msg.status_code);
            }
        }

        return [stream, msg.response_headers.get_one("ETag")];
    }

    /** @private */
    async fetchAll(start, end, compression, cancellable, etag) {
        const [stream, receivedEtag] = await this.fetch(start, end, cancellable, etag);

        const memStream = Gio.MemoryOutputStream.new_resizable();
        await memStream.splice_async(
            stream,
            Gio.OutputStreamSpliceFlags.CLOSE_SOURCE |
                Gio.OutputStreamSpliceFlags.CLOSE_TARGET,
            GLib.PRIORITY_DEFAULT,
            cancellable ?? null
        );

        return [decompress([memStream.steal_as_bytes()], compression), receivedEtag];
    }

    /** @private */
    get soupSession() {
        if (this._session === null) {
            this._session = new Soup.Session({ user_agent : 'gnome-maps/' + pkg.version });
        }
        return this._session;
    }

    /**
     * @private
     * @returns {Promise<Range | null>}
     */
    async getTileRange(tileId, caches) {
        const cached = caches.tileRanges.get(tileId);
        if (cached) {
            return await cached;
        }

        const recursiveSearch = async (dir) => {
            if (dir.tileIDs.length === 0) {
                return null;
            }

            const idx = searchDirectory(dir, tileId);
            if (dir.runLengths[idx] === 0) {
                const childDir = await this.fetchLeafDir(
                    dir.offsets[idx],
                    dir.lengths[idx],
                    caches
                );
                return recursiveSearch(childDir, tileId);
            } else {
                if (tileId >= dir.tileIDs[idx] && tileId < dir.tileIDs[idx] + dir.runLengths[idx]) {
                    return {
                        offset: caches.header.tileData.offset + dir.offsets[idx],
                        length: dir.lengths[idx],
                    };
                } else {
                    return null;
                }
            }
        };

        const result = recursiveSearch(caches.rootDir);
        caches.tileRanges.set(tileId, result);

        return result;
    }
}

const readVarint = (buf, offset) => {
    let result = 0n;
    let shift = 0n;
    let byte;
    do {
        byte = buf[offset];
        /* bigint is required because shifting is limited to 32 bits in JS */
        result |= BigInt(byte & 0x7f) << shift;
        shift += 7n;
        offset++;
    } while (byte & 0x80);
    return [Number(result), offset];
};

const readVarints = (buf, offset, count) => {
    const result = [];
    for (let i = 0; i < count; i++) {
        [result[i], offset] = readVarint(buf, offset);
    }
    return [result, offset];
};

const getTileID = ([zoom, x, y]) => {
    /* Hilbert curve */

    if (zoom < 0 || isNaN(zoom)) {
        throw new Error(`Invalid zoom level: ${zoom}`);
    }

    if (zoom === 0) {
        return 0;
    } else {
        const offset = 4 ** (zoom - 1);
        const half = 1 << (zoom - 1);

        if (x & half) {
            if (y & half) {
                return getTileID([zoom - 1, x - half, y - half]) + offset * 3;
            } else {
                return (
                    getTileID([zoom - 1, half - y - 1, half - x + half - 1]) +
                    offset * 4
                );
            }
        } else {
            if (y & half) {
                return getTileID([zoom - 1, x, y - half]) + offset * 2;
            } else {
                return getTileID([zoom - 1, y, x]) + offset;
            }
        }
    }
};

const readDirectory = (buf) => {
    let offset, length, tileIDs, runLengths, lengths, offsets;
    [length, offset] = readVarint(buf, 0);

    [tileIDs, offset] = readVarints(buf, offset, length);
    let lastId = 0;
    for (let i = 0; i < length; i++) {
        tileIDs[i] += lastId;
        lastId = tileIDs[i];
    }

    [runLengths, offset] = readVarints(buf, offset, length);
    [lengths, offset] = readVarints(buf, offset, length);

    [offsets, offset] = readVarints(buf, offset, length);
    let lastOffset = 0;
    for (let i = 0; i < length; i++) {
        const o = offsets[i];
        if (o === 0) {
            lastOffset += lengths[i - 1];
        } else {
            lastOffset = o - 1;
        }
        offsets[i] = lastOffset;
    }

    return {
        tileIDs,
        runLengths,
        lengths,
        offsets,
    };
};

const searchDirectory = (dir, tileID) => {
    let low = 0;
    let high = dir.tileIDs.length;
    while (low < high) {
        const mid = low + Math.floor((high - low) / 2);
        if (dir.tileIDs[mid] <= tileID) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }
    return low - 1;
};

/** @returns {GLib.Bytes} */
const decompress = (data, compression) => {
    switch (compression ?? Compression.NONE) {
        case Compression.NONE:
            if (data.length === 1) {
                return data[0];
            } else {
                const out_stream = Gio.MemoryOutputStream.new_resizable();
                for (const chunk of data) {
                    out_stream.splice(
                        Gio.MemoryInputStream.new_from_bytes(chunk),
                        Gio.OutputStreamSpliceFlags.CLOSE_SOURCE,
                        null
                    );
                }
                out_stream.close(null);
                return out_stream.steal_as_bytes();
            }

        case Compression.GZIP: {
            const mem_stream = Gio.MemoryInputStream.new();
            for (const chunk of data) {
                mem_stream.add_bytes(chunk);
            }

            const converter = Gio.ZlibDecompressor.new(
                Gio.ZlibCompressorFormat.GZIP
            );
            const convert_stream = Gio.ConverterInputStream.new(
                mem_stream,
                converter
            );
            const out_stream = Gio.MemoryOutputStream.new_resizable();
            out_stream.splice(
                convert_stream,
                Gio.OutputStreamSpliceFlags.CLOSE_SOURCE |
                    Gio.OutputStreamSpliceFlags.CLOSE_TARGET,
                null
            );
            return out_stream.steal_as_bytes();
        }
        default:
            throw new Error(`Unsupported compression: ${compression}`);
    }
};

const compressionSupported = (compression) => {
    return compression === Compression.NONE || compression === Compression.GZIP;
};

class LRUCache {
    constructor(limit) {
        this._limit = limit;
        this._map = new Map();
        this._recentKeys = [];
    }

    bump(key) {
        this._recentKeys = this._recentKeys.filter((k) => k !== key);
        this._recentKeys.push(key);
    }

    get(key) {
        const value = this._map.get(key);
        if (typeof value === "undefined") {
            return undefined;
        }
        this.bump(key);
        return value;
    }

    set(key, value) {
        this._map.set(key, value);
        this.bump(key);
        if (this._recentKeys.length > this._limit) {
            const oldestKey = this._recentKeys.shift();
            this._map.delete(oldestKey);
        }
    }

    clear() {
        this._map.clear();
        this._recentKeys = [];
    }
}

const parallelLoop = async (items, fn, workers = 2) => {
    const queue = items.slice();
    const promises = [];
    for (let i = 0; i < workers; i++) {
        promises.push(
            (async () => {
                while (queue.length > 0) {
                    const item = queue.pop();
                    await fn(item);
                }
            })()
        );
    }
    await Promise.all(promises);
};
