// Adapted from <https://github.com/mapbox/tiny-sdf/blob/main/index.js>,
// which is BSD 2-Clause. Edited to handle arbitrary canvas drawings.

const INF = 1e20;

export default class TinySDF {
    constructor({
        iconSize = 16,
        buffer = 3,
        radius = 8,
        cutoff = 0.25,
    } = {}) {
        this.buffer = buffer;
        this.cutoff = cutoff;
        this.radius = radius;

        this.iconSize = iconSize;

        // make the canvas size big enough to both have the specified buffer around the glyph
        // for "halo", and account for some glyphs possibly being larger than their font size
        const size = iconSize + buffer * 2;

        const canvas = this._createCanvas(size);
        const ctx = this.ctx = canvas.getContext('2d', {willReadFrequently: true});

        ctx.fillStyle = 'black';

        // temporary arrays for the distance transform
        this.gridOuter = new Float64Array(size * size);
        this.gridInner = new Float64Array(size * size);
        this.f = new Float64Array(size);
        this.z = new Float64Array(size + 1);
        this.v = new Uint16Array(size);
    }

    _createCanvas(size) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        return canvas;
    }

    async draw(drawFunc) {
        const width = this.iconSize + 2 * this.buffer;
        const height = this.iconSize + 2 * this.buffer;

        const len = Math.max(width * height, 0);
        const data = new Uint8ClampedArray(len);

        const {ctx, buffer, gridInner, gridOuter} = this;
        ctx.clearRect(0, 0, width, height);
        await drawFunc(ctx, this.buffer);
        const imgData = ctx.getImageData(buffer, buffer, this.iconSize, this.iconSize);

        // Initialize grids outside the glyph range to alpha 0
        gridOuter.fill(INF, 0, len);
        gridInner.fill(0, 0, len);

        for (let y = 0; y < this.iconSize; y++) {
            for (let x = 0; x < this.iconSize; x++) {
                const a = imgData.data[4 * (y * this.iconSize + x) + 3] / 255; // alpha value
                if (a === 0) continue; // empty pixels

                const j = (y + buffer) * width + x + buffer;

                if (a === 1) { // fully drawn pixels
                    gridOuter[j] = 0;
                    gridInner[j] = INF;

                } else { // aliased pixels
                    const d = 0.5 - a;
                    gridOuter[j] = d > 0 ? d * d : 0;
                    gridInner[j] = d < 0 ? d * d : 0;
                }
            }
        }

        edt(gridOuter, 0, 0, width, height, width, this.f, this.v, this.z);
        edt(gridInner, buffer, buffer, this.iconSize, this.iconSize, width, this.f, this.v, this.z);

        for (let i = 0; i < len; i++) {
            const d = Math.sqrt(gridOuter[i]) - Math.sqrt(gridInner[i]);
            data[i] = Math.round(255 - 255 * (d / this.radius + this.cutoff));
        }

        const rgba = new Uint8Array(len * 4);
        for (let i = 0; i < len; i++) {
            rgba[4 * i + 0] = 0;
            rgba[4 * i + 1] = 0;
            rgba[4 * i + 2] = 0;
            rgba[4 * i + 3] = data[i];
        }

        return {data: rgba, width, height};
    }
}

// 2D Euclidean squared distance transform by Felzenszwalb & Huttenlocher https://cs.brown.edu/~pff/papers/dt-final.pdf
function edt(data, x0, y0, width, height, gridSize, f, v, z) {
    for (let x = x0; x < x0 + width; x++) edt1d(data, y0 * gridSize + x, gridSize, height, f, v, z);
    for (let y = y0; y < y0 + height; y++) edt1d(data, y * gridSize + x0, 1, width, f, v, z);
}

// 1D squared distance transform
function edt1d(grid, offset, stride, length, f, v, z) {
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    f[0] = grid[offset];

    for (let q = 1, k = 0, s = 0; q < length; q++) {
        f[q] = grid[offset + q * stride];
        const q2 = q * q;
        do {
            const r = v[k];
            s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
        } while (s <= z[k] && --k > -1);

        k++;
        v[k] = q;
        z[k] = s;
        z[k + 1] = INF;
    }

    for (let q = 0, k = 0; q < length; q++) {
        while (z[k + 1] < q) k++;
        const r = v[k];
        const qr = q - r;
        grid[offset + q * stride] = f[r] + qr * qr;
    }
}