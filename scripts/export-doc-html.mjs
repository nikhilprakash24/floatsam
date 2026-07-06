// Renders each key document as a self-contained HTML page (images inlined as
// downscaled JPEG data-URIs, SVG diagrams inlined) → exports/site/*.html.
// Used for Claude-artifact publishing now and the GitHub Pages docs site later.
//   node scripts/export-doc-html.mjs
import { readFileSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { marked } from 'marked';
import { chromium } from '@playwright/test';

const OUT = resolve('exports/site');
mkdirSync(OUT, { recursive: true });
marked.setOptions({ gfm: true });

// The deep-sea theme — matches the original status report & hub artifacts.
const CSS = `
  :root{--ink:#081E27;--panel:#0D2C38;--panel2:#10394A;--line:#1C4A5C;--foam:#DCEEF5;
        --mist:#8FB4C0;--reef:#2BAF97;--gold:#F5C86B;--sky:#5FB6DC}
  html{background:var(--ink)}
  body{font-family:"Segoe UI",system-ui,sans-serif;font-size:16px;line-height:1.65;color:var(--foam);
       max-width:860px;margin:0 auto;padding:40px 22px 80px;
       background:radial-gradient(1100px 460px at 70% -10%,rgba(43,175,151,.08),transparent 60%),var(--ink)}
  h1{font-family:"Trebuchet MS",sans-serif;font-size:32px;color:#E8F6FB;line-height:1.15;
     border-bottom:3px solid var(--reef);padding-bottom:8px;margin:8px 0 14px}
  h2{font-family:"Trebuchet MS",sans-serif;font-size:22px;color:#E8F6FB;margin:34px 0 8px;
     border-bottom:1px solid var(--line);padding-bottom:4px}
  h3{font-size:17px;color:var(--reef);margin:22px 0 6px}
  p,li{color:var(--foam)}
  a{color:var(--sky)}
  strong{color:var(--gold)}
  em{color:var(--mist)}
  code{font-family:Consolas,monospace;font-size:13.5px;background:var(--panel2);color:#D8F3FF;
      padding:1px 5px;border-radius:4px}
  pre{background:var(--panel);border:1px solid var(--line);color:var(--foam);
      padding:14px 18px;border-radius:8px;overflow-x:auto}
  pre code{background:none;color:inherit;padding:0;font-size:13px}
  table{border-collapse:collapse;width:100%;margin:14px 0;font-size:14.5px;display:block;overflow-x:auto}
  th{background:var(--panel2);color:var(--mist);text-align:left;padding:8px 11px;font-size:12px;
     text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;border-bottom:1px solid var(--line)}
  td{border:1px solid var(--line);padding:7px 11px;vertical-align:top;background:var(--panel)}
  tr:nth-child(even) td{background:#0F323F}
  img{max-width:min(420px,88%);display:block;margin:18px auto;border:1px solid var(--line);
      border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.35)}
  svg{max-width:100%;height:auto;display:block;margin:18px auto;border-radius:10px}
  blockquote{border-left:4px solid var(--reef);margin:14px 0;padding:4px 18px;color:var(--mist);
      background:var(--panel);border-radius:0 8px 8px 0}
  hr{border:none;border-top:1px solid var(--line);margin:26px 0}
  .stamp{font-family:Consolas,monospace;font-size:12px;color:var(--reef);letter-spacing:.14em;
      text-transform:uppercase;margin-bottom:2px}
`;

const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();
// Give the page a file:// origin so it can load local images for re-encoding.
await page.goto(pathToFileURL(resolve('gitbook/assets')).href);

/** Downscale a local PNG to a JPEG data URI (keeps artifact pages small). */
async function inlineImage(absPath) {
  return page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const w = Math.min(560, img.width);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = Math.round(img.height * (w / img.width));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  }, pathToFileURL(absPath).href);
}

async function mdToHtml(mdPath) {
  let html = marked.parse(readFileSync(mdPath, 'utf8'));
  // Inline SVG diagrams directly (self-contained, scoped class/marker names).
  for (const svg of ['diagram-architecture.svg', 'diagram-sim-loop.svg']) {
    const tag = new RegExp(`<img[^>]*src="[^"]*${svg}"[^>]*>`, 'g');
    if (tag.test(html)) html = html.replace(tag, readFileSync(resolve('gitbook/assets', svg), 'utf8'));
  }
  // Inline raster screenshots as downscaled JPEG data URIs.
  const imgRefs = [...html.matchAll(/src="(?:\.\.\/)?assets\/([\w-]+\.png)"/g)];
  for (const [, file] of new Set(imgRefs.map((m) => [m[0], m[1]]))) {
    const uri = await inlineImage(resolve('gitbook/assets', file));
    html = html.replaceAll(`src="../assets/${file}"`, `src="${uri}"`).replaceAll(`src="assets/${file}"`, `src="${uri}"`);
  }
  html = html.replaceAll(
    '<pre><code class="language-mermaid">',
    '<p><em>Diagram (Mermaid source — renders on GitHub):</em></p><pre><code>',
  );
  return html;
}

const DOCS = [
  ['briefing', 'Floatsam — Program Briefing', 'docs/BRIEFING.md'],
  ['handoff-v2', 'Floatsam — Handoff v2', 'docs/HANDOFF.md'],
  ['decisions-adr', 'Floatsam — Decision Log (ADR 001–013)', 'docs/DECISIONS.md'],
  ['physics-spec', 'Floatsam — Physics Spec', 'docs/PHYSICS_SPEC.md'],
  ['test-plan', 'Floatsam — Test Plan', 'docs/TEST_PLAN.md'],
  ['architecture-v3-3', 'ARCHITECTURE v3.3 — the Floatsam Spec', 'ARCHITECTURE v3_3.md'],
];

for (const [slug, title, src] of DOCS) {
  const body = await mdToHtml(src);
  const html = `<title>${title}</title>\n<style>${CSS}</style>\n<p class="stamp">Floatsam / Underwater Flappy · v0.6.0 · ${new Date().toISOString().slice(0, 10)}</p>\n${body}`;
  writeFileSync(resolve(OUT, `${slug}.html`), html);
  console.log(`  ✓ ${slug}.html (${(statSync(resolve(OUT, `${slug}.html`)).size / 1024).toFixed(0)} KB)`);
}

// Compiled game guide (all chapters, screenshots inlined)
const GUIDE = [
  'gitbook/README.md', 'gitbook/guide/getting-started.md', 'gitbook/guide/modes.md',
  'gitbook/guide/creatures.md', 'gitbook/guide/tempo-and-scores.md', 'gitbook/guide/currents-lab.md',
  'gitbook/under-the-hood/physics.md', 'gitbook/under-the-hood/architecture.md',
  'gitbook/under-the-hood/fairness.md', 'gitbook/modding/add-a-creature.md',
  'gitbook/modding/tuning.md', 'gitbook/dev/testing.md', 'gitbook/dev/publish-this-guide.md',
];
let guide = '';
for (const p of GUIDE) guide += `<hr>\n${await mdToHtml(p)}\n`;
const guideHtml = `<title>Floatsam — The Game Guide</title>\n<style>${CSS}</style>\n<p class="stamp">Floatsam / Underwater Flappy · complete game guide · v0.6.0</p>\n${guide}`;
writeFileSync(resolve(OUT, 'game-guide.html'), guideHtml);
console.log(`  ✓ game-guide.html (${(statSync(resolve(OUT, 'game-guide.html')).size / 1024).toFixed(0)} KB)`);

await browser.close();
console.log(`\nall pages → ${OUT}`);
