// F-6 (v0.6.1): renders public/icon.svg to the PNG icon set PWA installs and
// stores expect (full-bleed for maskable). Re-run after icon changes:
//   node scripts/gen-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svg = readFileSync('public/icon.svg', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();

async function renderPng(size) {
  const b64 = await page.evaluate(
    async ({ svg, size }) => {
      const img = new Image();
      img.src = 'data:image/svg+xml;base64,' + btoa(svg);
      await img.decode();
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      // Full-bleed ground so maskable crops (circles etc.) never show holes.
      ctx.fillStyle = '#0b3d4f';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      return c.toDataURL('image/png').split(',')[1];
    },
    { svg, size },
  );
  writeFileSync(`public/icon-${size}.png`, Buffer.from(b64, 'base64'));
  console.log(`  ✓ public/icon-${size}.png`);
}

for (const size of [180, 192, 512]) await renderPng(size);
await browser.close();
