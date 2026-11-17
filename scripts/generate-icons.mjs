// Renders the PULSE mark to PNG app icons with the preinstalled Chromium.
// Run: npm run icons  (outputs are committed, so this is only needed to redesign them)
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

// Resolve the globally preinstalled Playwright (not a project dependency).
const { chromium } = createRequire(import.meta.url)('playwright');

const mark = (size, { padding = 0.18, rounded = true } = {}) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="30%" cy="20%" r="95%">
      <stop offset="0" stop-color="#0f2a33"/>
      <stop offset="0.55" stop-color="#070b10"/>
      <stop offset="1" stop-color="#05070a"/>
    </radialGradient>
    <linearGradient id="ln" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#22d3ee"/>
      <stop offset="1" stop-color="#2dd4bf"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="14" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#bg)"/>
  <g transform="translate(${256 - (512 * (1 - padding * 2)) / 2} ${256 - (512 * (1 - padding * 2)) / 2}) scale(${1 - padding * 2})">
    <path d="M40 276h108l40-108 64 200 52-148 28 56h140" fill="none" stroke="url(#ln)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
  </g>
</svg>`;

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/favicon.svg', mark(64, { padding: 0.1 }));

const browser = await chromium.launch();
const page = await browser.newPage();
const targets = [
  ['public/icons/icon-192.png', 192, { padding: 0.12 }],
  ['public/icons/icon-512.png', 512, { padding: 0.12 }],
  ['public/icons/icon-maskable-512.png', 512, { padding: 0.24, rounded: false }],
  ['public/apple-touch-icon.png', 180, { padding: 0.14, rounded: false }],
];
for (const [file, size, opts] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${mark(size, opts)}</body></html>`);
  await page.screenshot({ path: file, omitBackground: opts.rounded !== false, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', file);
}
await browser.close();
