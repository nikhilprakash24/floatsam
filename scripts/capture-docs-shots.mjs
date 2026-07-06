// Captures the screenshots used by the GitBook guide (gitbook/assets/*.png).
// Spins up Vite programmatically, drives the game with Playwright at the native
// 480×720 canvas size (2× DPR for crisp images). Re-run after visual changes:
//   node scripts/capture-docs-shots.mjs
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const PORT = 5199;
const OUT = 'gitbook/assets';
mkdirSync(OUT, { recursive: true });

const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'silent' });
await server.listen();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 480, height: 720 }, deviceScaleFactor: 2 });
const base = `http://localhost:${PORT}`;

const go = async (url, settleMs = 1000) => {
  await page.goto(base + url);
  await page.waitForTimeout(settleMs);
};
const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ✓ ${name}.png`);
};
const tap = async (x = 240, y = 360) => page.locator('canvas').click({ position: { x, y } });

/** Hold a dive control via in-page events (same path the e2e uses). */
const holdDown = (ms) =>
  page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const c = document.querySelector('canvas');
        const r = c.getBoundingClientRect();
        const o = { clientX: r.left + r.width / 2, clientY: r.top + r.height * 0.85, button: 0, bubbles: true };
        // touch-half fallback path: plain left-hold in the lower half dives
        c.dispatchEvent(new MouseEvent('mousedown', { ...o, button: 2, buttons: 2 }));
        setTimeout(() => resolve(null), ms); // screenshot happens while held
      }),
    ms,
  );

console.log('capturing…');

// Selection flow
await go('/', 1400);
await shot('menu');
await go('/?scene=pace');
await shot('tempo-select');
await go('/?scene=mode');
await shot('mode-select');
await go('/?scene=character');
await shot('card-seal');
await tap(454, 324); // next arrow → Otter
await page.waitForTimeout(400);
await shot('card-otter');

// Classic mid-run (seeded, a few taps for a lively frame)
await go('/?play=1&mode=classic&character=seal&seed=42', 800);
await tap(); // start
for (const wait of [500, 500, 450, 400]) {
  await page.waitForTimeout(wait);
  await tap();
}
await page.waitForTimeout(250);
await shot('classic-run');

// Game over panel (no input → seabed death)
await go('/?play=1&mode=classic&character=seal&seed=42', 600);
await tap();
await page.waitForTimeout(6200);
await shot('game-over');

// Dive mid-dive (Otter), captured while the dive is held
await go('/?play=1&mode=dive&character=otter', 800);
await tap();
await page.waitForTimeout(400);
await holdDown(600);
await shot('dive-run');

// Power Dive (Sea Lion) mid-lunge
await go('/?play=1&mode=powerdive&character=sealion', 800);
await tap();
await page.waitForTimeout(400);
await holdDown(550);
await shot('powerdive-run');

// Currents Lab: default preset + whirlpool
await go('/?scene=lab', 1600);
await shot('lab-drift');
await tap(426, 624); // next preset →
await page.waitForTimeout(1200);
await shot('lab-whirlpool');

// Sandbox (DOM sliders included)
await go('/?scene=sandbox', 1200);
await shot('sandbox');

await browser.close();
await server.close();
console.log('done.');
