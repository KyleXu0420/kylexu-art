// Full-page screenshot of a built page for design review, plus native-resolution tiles.
//   node tools/shot.mjs <url> <outDir> [width=1440] [tileHeight=1100]
// Writes <outDir>/full.png (trimmed to content height) and <outDir>/tile-1.png … (top to bottom).
import { execFileSync } from 'node:child_process';
import { mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const [url, outDir, w = '1440', tileH = '1100'] = process.argv.slice(2);
if (!url || !outDir) { console.error('usage: node tools/shot.mjs <url> <outDir> [width] [tileHeight]'); process.exit(2); }
const width = +w, tile = +tileH, MAX = 12000;
mkdirSync(outDir, { recursive: true });
const raw = join(outDir, '_raw.png');
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  `--window-size=${width},${MAX}`, '--virtual-time-budget=8000', `--screenshot=${raw}`, url], { stdio: 'ignore' });

// trim: find the last row that differs from the bottom-right pixel (the page background)
const img = sharp(raw);
const { width: W, height: H, channels: ch } = await img.metadata();
const buf = await img.raw().toBuffer();
const bg = buf.subarray((H - 1) * W * ch + (W - 1) * ch, (H - 1) * W * ch + W * ch);
let last = H - 1;
outer: for (let y = H - 1; y >= 0; y--) {
  for (let x = 0; x < W; x += 4) {
    const i = (y * W + x) * ch;
    if (Math.abs(buf[i] - bg[0]) > 6 || Math.abs(buf[i + 1] - bg[1]) > 6 || Math.abs(buf[i + 2] - bg[2]) > 6) { last = y; break outer; }
  }
}
const height = Math.min(H, last + 80);
await sharp(raw).extract({ left: 0, top: 0, width: W, height }).png().toFile(join(outDir, 'full.png'));
let n = 0;
for (let top = 0; top < height; top += tile) {
  n++;
  await sharp(raw).extract({ left: 0, top, width: W, height: Math.min(tile, height - top) }).png().toFile(join(outDir, `tile-${n}.png`));
}
unlinkSync(raw);
console.log(`shot: ${width}x${height} → ${outDir}/full.png + ${n} tiles of ${tile}px`);
