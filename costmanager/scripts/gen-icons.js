// One-off icon authoring helper: renders the app's SVG mark to PNG icons
// (192/512, plus maskable variants with safe-zone padding) using Playwright+Chromium.
// Not part of the npm build pipeline — icons are committed as static assets.
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'icons');
fs.mkdirSync(OUT_DIR, { recursive: true });

function svgMark({ size, padding }) {
  const inner = size - padding * 2;
  const r = size * 0.22;
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#6C5CE7"/>
        <stop offset="100%" stop-color="#5747D6"/>
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" rx="${r}" fill="url(#g)"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
      font-family="Vazirmatn, Tahoma, sans-serif" font-weight="800"
      font-size="${inner * 0.62}" fill="#FFFFFF">م</text>
  </svg>`;
}

async function render(svg, size, outPath) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
  await page.locator('svg').screenshot({ path: outPath, omitBackground: true });
  await browser.close();
}

(async () => {
  await render(svgMark({ size: 192, padding: 0 }), 192, path.join(OUT_DIR, 'icon-192.png'));
  await render(svgMark({ size: 512, padding: 0 }), 512, path.join(OUT_DIR, 'icon-512.png'));
  // Maskable: extra padding so the mark sits inside the safe zone when OS masks crop the edges.
  await render(svgMark({ size: 192, padding: 24 }), 192, path.join(OUT_DIR, 'icon-192-maskable.png'));
  await render(svgMark({ size: 512, padding: 64 }), 512, path.join(OUT_DIR, 'icon-512-maskable.png'));
  console.log('[gen-icons] wrote icon-192, icon-512, icon-192-maskable, icon-512-maskable');
})();
