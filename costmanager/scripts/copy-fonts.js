// Vendors Vazirmatn WOFF2 files from the npm package into assets/fonts
// so the app can self-host them with zero CDN/network dependency at runtime.
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'node_modules', 'vazirmatn', 'fonts', 'webfonts');
const DEST_DIR = path.join(__dirname, '..', 'assets', 'fonts');

const WEIGHTS = {
  Regular: 'Regular',
  Medium: 'Medium',
  SemiBold: 'SemiBold',
  Bold: 'Bold',
  ExtraBold: 'ExtraBold',
};

if (!fs.existsSync(SRC_DIR)) {
  console.warn('[copy-fonts] vazirmatn package not found, skipping font vendoring');
  process.exit(0);
}

fs.mkdirSync(DEST_DIR, { recursive: true });

for (const weight of Object.values(WEIGHTS)) {
  const src = path.join(SRC_DIR, `Vazirmatn-${weight}.woff2`);
  const dest = path.join(DEST_DIR, `Vazirmatn-${weight}.woff2`);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`[copy-fonts] vendored Vazirmatn-${weight}.woff2`);
  } else {
    console.warn(`[copy-fonts] missing source font: ${src}`);
  }
}
