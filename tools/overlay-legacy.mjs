// Copy legacy/** into dist/** — but only paths that dist/ does not already contain.
// Precedence is therefore deterministic: a URL is served by the new Astro page the moment
// src/pages/<route> exists, and by the Webflow mirror until then. Run after `astro build`.
import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const legacy = join(root, 'legacy');
const dist = join(root, 'dist');

let copied = 0, kept = 0;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const src = join(dir, entry.name);
    const rel = relative(legacy, src);
    const dest = join(dist, rel);
    if (entry.isDirectory()) { await mkdir(dest, { recursive: true }); await walk(src); continue; }
    if (existsSync(dest)) { kept++; continue; }
    await cp(src, dest);
    copied++;
  }
}
if (!existsSync(dist)) await mkdir(dist, { recursive: true });
await walk(legacy);
const n = (await readdir(dist, { recursive: true })).length;
console.log(`overlay-legacy: copied ${copied} legacy files, ${kept} already served by Astro, dist has ${n} entries`);
