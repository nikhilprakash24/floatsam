import { expect, test, type Page } from '@playwright/test';

interface SimState {
  y: number;
  vy: number;
  score: number;
  phase: 'PLAY' | 'DEAD' | 'OVER';
  frame: number;
  started: boolean;
  gate: { x: number; c: number; gap: number } | null;
}

/**
 * Drive the seal toward gate gaps until it scores `target` or dies. Runs
 * entirely in-page (no driver round-trips) so reactions are frame-accurate.
 */
async function playUntilScore(page: Page, target: number, ms: number): Promise<number> {
  return page.evaluate(
    ({ target, ms }) =>
      new Promise<number>((resolve) => {
        const canvas = document.querySelector('canvas')!;
        const rect = canvas.getBoundingClientRect();
        const tap = () => {
          // Phaser 3's input manager listens for mouse/touch events, not
          // pointer events — dispatch what it actually subscribes to.
          const opts = {
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            button: 0,
            bubbles: true,
          };
          canvas.dispatchEvent(new MouseEvent('mousedown', opts));
          canvas.dispatchEvent(new MouseEvent('mouseup', opts));
        };
        const deadline = Date.now() + ms;
        const iv = window.setInterval(() => {
          const s = window.__sim;
          if (!s) return;
          if (s.score >= target || s.phase !== 'PLAY' || Date.now() > deadline) {
            window.clearInterval(iv);
            resolve(s.score);
            return;
          }
          const brake = s.gate ? s.gate.c + s.gate.gap * 0.15 : 360;
          if (s.y + s.vy * 0.25 > brake) tap();
        }, 25);
      }),
    { target, ms },
  );
}

declare global {
  interface Window {
    __sim?: SimState;
  }
}

async function tapCanvas(page: Page): Promise<void> {
  await page.locator('canvas').click({ position: { x: 240, y: 360 } });
}

async function simState(page: Page): Promise<SimState | undefined> {
  return page.evaluate(() => window.__sim);
}

/**
 * Deep-link straight into a deterministic Classic(Seal) run (?play=1 skips the
 * mode/character menus) and tap once to start the world.
 */
async function startRun(page: Page, seed: number): Promise<void> {
  await page.goto(`/?play=1&mode=classic&character=seal&seed=${seed}`);
  await expect(page.locator('canvas')).toBeVisible();
  for (let i = 0; i < 30; i++) {
    await tapCanvas(page);
    await page.waitForTimeout(150);
    const s = await simState(page);
    if (s?.started) return;
  }
  throw new Error('run never started');
}

test('boot → menu → play: canvas renders and the sim starts on tap', async ({ page }) => {
  await startRun(page, 42);
  await expect.poll(async () => (await simState(page))?.phase).toBe('PLAY');
  await expect.poll(async () => (await simState(page))?.frame).toBeGreaterThan(0);
});

test('full loop: play → die → game over → restart in under a second', async ({ page }) => {
  await startRun(page, 42);

  // Stop tapping: the seal sinks to its death (seabed or gate).
  await expect.poll(async () => (await simState(page))?.phase, { timeout: 30_000 }).toBe('OVER');

  // Tap through the game-over panel (after its input guard) and time the
  // restart in-page so driver round-trips don't pollute the measurement.
  await page.waitForTimeout(450);
  const restartMs = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const canvas = document.querySelector('canvas')!;
        const rect = canvas.getBoundingClientRect();
        const opts = {
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          button: 0,
          bubbles: true,
        };
        canvas.dispatchEvent(new MouseEvent('mousedown', opts));
        canvas.dispatchEvent(new MouseEvent('mouseup', opts));
        const t0 = performance.now();
        const iv = window.setInterval(() => {
          const s = window.__sim as { phase: string; frame: number } | undefined;
          if (s && s.phase === 'PLAY' && s.frame < 100) {
            window.clearInterval(iv);
            resolve(performance.now() - t0);
          } else if (performance.now() - t0 > 5000) {
            window.clearInterval(iv);
            reject(new Error('restart never happened'));
          }
        }, 16);
      }),
  );
  expect(restartMs).toBeLessThan(1000);
});

test('score increments when passing gates (bot-driven)', async ({ page }) => {
  await startRun(page, 7);
  const score = await playUntilScore(page, 1, 25_000);
  expect(score).toBeGreaterThanOrEqual(1);
});

test('best score persists across a reload', async ({ page }) => {
  await startRun(page, 7);

  // Score at least one gate so there is a best to persist, then drown.
  const score = await playUntilScore(page, 1, 25_000);
  expect(score).toBeGreaterThanOrEqual(1);
  await expect.poll(async () => (await simState(page))?.phase, { timeout: 30_000 }).toBe('OVER');

  // Best score is now keyed per (mode, character).
  const KEY = 'uf.best.classic.seal';
  const stored = await page.evaluate((k) => window.localStorage.getItem(k), KEY);
  expect(Number(stored)).toBeGreaterThanOrEqual(1);

  await page.reload();
  const after = await page.evaluate((k) => window.localStorage.getItem(k), KEY);
  expect(after).toBe(stored);
});

test('menu advances into the mode/character select flow', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(400);
  // A menu tap must NOT start a run — it enters ModeSelect (no sim yet).
  await tapCanvas(page);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__sim)).toBeUndefined();
});

async function startDiveRun(page: Page): Promise<void> {
  await page.goto('/?play=1&mode=dive&character=seal');
  await expect(page.locator('canvas')).toBeVisible();
  await tapCanvas(page); // first interaction starts the world
  await expect.poll(async () => (await simState(page))?.started).toBe(true);
}

/** Hold a control for `ms` via in-page events (headless-stable), return vy/y. */
async function holdDive(
  page: Page,
  control: 'right' | 'down' | 'up',
  ms: number,
): Promise<{ vy: number; y: number }> {
  return page.evaluate(
    ({ control, ms }) =>
      new Promise<{ vy: number; y: number }>((resolve) => {
        const c = document.querySelector('canvas')!;
        const r = c.getBoundingClientRect();
        const code = control === 'down' ? 'ArrowDown' : 'ArrowUp';
        const keyCode = control === 'down' ? 40 : 38; // Phaser 3 matches on keyCode
        const mid = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true };
        const press = () => {
          if (control === 'right') {
            c.dispatchEvent(new MouseEvent('mousemove', { ...mid, buttons: 2 }));
            c.dispatchEvent(new MouseEvent('mousedown', { ...mid, button: 2, buttons: 2 }));
          } else {
            window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, keyCode, which: keyCode, bubbles: true }));
          }
        };
        const release = () => {
          if (control === 'right') {
            c.dispatchEvent(new MouseEvent('mouseup', { ...mid, button: 2, buttons: 0 }));
          } else {
            window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, keyCode, which: keyCode, bubbles: true }));
          }
        };
        press();
        setTimeout(() => {
          const s = window.__sim as { vy: number; y: number };
          release();
          resolve({ vy: s.vy, y: s.y });
        }, ms);
      }),
    { control, ms },
  );
}

// Passive near-neutral drift terminates at ~12 px/s; >25 is unambiguously
// active T_down. (Kept modest because headless rAF + the sim's accumulator
// clamp advance less wall-time than a real browser.)
const ACTIVE_DIVE_VY = 25;

test('Dive mode: right-click actively dives downward (ADR-009)', async ({ page }) => {
  await startDiveRun(page);
  const y0 = (await simState(page))!.y;
  const s = await holdDive(page, 'right', 700);
  expect(s.vy).toBeGreaterThan(ACTIVE_DIVE_VY);
  expect(s.y).toBeGreaterThan(y0);
});

test('Dive mode: keyboard ↓ dives downward (ADR-009)', async ({ page }) => {
  await startDiveRun(page);
  const down = await holdDive(page, 'down', 700);
  expect(down.vy).toBeGreaterThan(ACTIVE_DIVE_VY); // diving
});

test('Dive mode: keyboard ↑ rises upward (ADR-009)', async ({ page }) => {
  await startDiveRun(page);
  // From rest, up-thrust must flip the gentle downward drift to a clear rise.
  const up = await holdDive(page, 'up', 700);
  expect(up.vy).toBeLessThan(-ACTIVE_DIVE_VY);
});
