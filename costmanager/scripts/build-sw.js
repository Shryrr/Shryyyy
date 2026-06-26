// Bundles src/sw.ts (Workbox imports + a generated precache manifest) into a
// single dependency-free sw.js at the project root, matching where
// navigator.serviceWorker.register('/sw.js') expects to find it.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const minify = process.argv.includes('--minify');

function hashFile(absPath) {
  return crypto.createHash('md5').update(fs.readFileSync(absPath)).digest('hex').slice(0, 10);
}

function entry(url, absPath) {
  return { url, revision: hashFile(absPath) };
}

function buildManifest() {
  const manifest = [];

  // Only '/' is precached, not '/index.html': several static hosts (including the
  // project's own `npx serve` preview server) 301-redirect /index.html -> /, and
  // Cache.put() throws on a redirected response, which would fail SW install entirely.
  manifest.push({ url: '/', revision: hashFile(path.join(ROOT, 'index.html')) });

  manifest.push(entry('/manifest.json', path.join(ROOT, 'manifest.json')));
  manifest.push(entry('/src/styles.css', path.join(ROOT, 'src/styles.css')));

  const appJsPath = path.join(ROOT, 'dist/app.js');
  if (fs.existsSync(appJsPath)) {
    manifest.push(entry('/dist/app.js', appJsPath));
  } else {
    console.warn('[build-sw] dist/app.js not found yet — run the app build first for it to be precached');
  }

  const fontsDir = path.join(ROOT, 'assets/fonts');
  for (const file of fs.readdirSync(fontsDir).filter((f) => f.endsWith('.woff2'))) {
    manifest.push(entry(`/assets/fonts/${file}`, path.join(fontsDir, file)));
  }

  const iconsDir = path.join(ROOT, 'assets/icons');
  for (const file of fs.readdirSync(iconsDir).filter((f) => f.endsWith('.png'))) {
    manifest.push(entry(`/assets/icons/${file}`, path.join(iconsDir, file)));
  }

  return manifest;
}

async function main() {
  const manifest = buildManifest();

  await esbuild.build({
    entryPoints: [path.join(ROOT, 'src/sw.ts')],
    outfile: path.join(ROOT, 'sw.js'),
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: ['es2020'],
    minify,
    logLevel: 'info',
    define: {
      __PRECACHE_MANIFEST__: JSON.stringify(manifest),
      'process.env.NODE_ENV': JSON.stringify(minify ? 'production' : 'development'),
    },
  });

  console.log(`[build-sw] wrote sw.js with ${manifest.length} precached entries`);
}

main().catch((err) => {
  console.error('[build-sw] failed:', err);
  process.exit(1);
});
