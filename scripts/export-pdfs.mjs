// Exports the program's key documents as print-quality PDFs → exports/pdf/.
// Markdown → HTML (marked) → headless-Chromium print. Re-run any time:
//   node scripts/export-pdfs.mjs
import { readFileSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { marked } from 'marked';
import { chromium } from '@playwright/test';

const ROOT = resolve('.');
const OUT = resolve('exports/pdf');
mkdirSync(OUT, { recursive: true });

const ASSETS_URL = pathToFileURL(resolve('gitbook/assets')).href;

const CSS = `
  @page { size: A4; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", system-ui, sans-serif; font-size: 10.5pt; line-height: 1.55;
         color: #14232b; margin: 0; padding: 0 6mm; }
  h1 { font-family: "Trebuchet MS", sans-serif; font-size: 21pt; color: #0b3d4f;
       border-bottom: 2.5px solid #1d8a77; padding-bottom: 6px; margin: 0 0 10px; }
  h2 { font-family: "Trebuchet MS", sans-serif; font-size: 14.5pt; color: #0b3d4f; margin: 22px 0 6px;
       border-bottom: 1px solid #cfdde4; padding-bottom: 3px; }
  h3 { font-size: 11.5pt; color: #14606f; margin: 16px 0 4px; }
  p, li { orphans: 3; widows: 3; }
  a { color: #14606f; text-decoration: none; }
  strong { color: #0b2f3d; }
  code { font-family: Consolas, monospace; font-size: 9pt; background: #eef4f6;
         padding: 1px 4px; border-radius: 3px; }
  pre { background: #0d2c38; color: #dceef5; padding: 10px 14px; border-radius: 6px;
        overflow-x: hidden; white-space: pre-wrap; word-wrap: break-word; page-break-inside: avoid; }
  pre code { background: none; color: inherit; padding: 0; font-size: 8.5pt; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 9.5pt; page-break-inside: avoid; }
  th { background: #0b3d4f; color: #fff; text-align: left; padding: 6px 9px; font-size: 8.5pt;
       text-transform: uppercase; letter-spacing: .06em; }
  td { border: 1px solid #cfdde4; padding: 5px 9px; vertical-align: top; }
  tr:nth-child(even) td { background: #f2f7f9; }
  img { max-width: 62%; max-height: 400px; display: block; margin: 14px auto;
        border: 1px solid #cfdde4; border-radius: 6px; page-break-inside: avoid; }
  img[src$=".svg"] { max-width: 100%; max-height: none; border: none; background: #081e27;
        border-radius: 8px; padding: 6px; }
  blockquote { border-left: 3px solid #1d8a77; margin: 10px 0; padding: 2px 14px; color: #3c5560;
        background: #f2f7f9; }
  hr { border: none; border-top: 1px solid #cfdde4; margin: 18px 0; }
  .chapter { page-break-before: always; }
  .chapter:first-child { page-break-before: avoid; }
  .coverpage { page-break-after: always; padding-top: 60mm; text-align: center; }
  .coverpage h1 { border: none; font-size: 30pt; }
  .coverpage .sub { color: #3c5560; font-size: 13pt; margin-top: 6px; }
  .coverpage .meta { color: #6b8591; font-size: 10pt; margin-top: 30mm; line-height: 2; }
`;

marked.setOptions({ gfm: true });

/** md → HTML body, with image srcs resolved to absolute file:// URLs. */
function mdToHtml(mdPath) {
  const md = readFileSync(mdPath, 'utf8');
  let html = marked.parse(md);
  html = html
    .replaceAll('src="../assets/', `src="${ASSETS_URL}/`)
    .replaceAll('src="assets/', `src="${ASSETS_URL}/`);
  // Mermaid blocks don't render in print — label them as source listings.
  html = html.replaceAll(
    '<pre><code class="language-mermaid">',
    '<p><em>Diagram (Mermaid source — renders on GitHub; see SVG equivalents in gitbook/assets):</em></p><pre><code>',
  );
  return html;
}

function wrap(title, subtitle, bodyHtml, cover = false) {
  const coverHtml = cover
    ? `<div class="coverpage"><h1>${title}</h1><div class="sub">${subtitle}</div>
       <div class="meta">Floatsam / Underwater Flappy · v0.6.0<br>Generated ${new Date().toISOString().slice(0, 10)} · flappySeal repository</div></div>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head>
    <body>${coverHtml}${bodyHtml}</body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage();

async function renderPdf(name, html, { landscape = false } = {}) {
  const tmp = resolve(OUT, `_${name}.html`);
  writeFileSync(tmp, html);
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
  const path = resolve(OUT, `${name}.pdf`);
  await page.pdf({
    path,
    format: 'A4',
    landscape,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `<div style="font-size:7.5px; color:#6b8591; width:100%; padding:0 12mm;
      display:flex; justify-content:space-between;"><span>Floatsam / Underwater Flappy</span><span>${name}</span></div>`,
    footerTemplate: `<div style="font-size:7.5px; color:#6b8591; width:100%; text-align:center;">
      <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
    margin: { top: '16mm', bottom: '14mm', left: '10mm', right: '10mm' },
  });
  const kb = (statSync(path).size / 1024).toFixed(0);
  console.log(`  ✓ ${name}.pdf (${kb} KB)`);
}

// ── Single-source documents ─────────────────────────────────────────────
const SINGLES = [
  ['BRIEFING', 'Complete program handout', 'docs/BRIEFING.md'],
  ['HANDOFF-v2', 'Status handoff for the planning chat', 'docs/HANDOFF.md'],
  ['DECISIONS-ADR-LOG', 'Architecture decision records 001–013 + gate evidence', 'docs/DECISIONS.md'],
  ['PHYSICS-SPEC', 'Fluid model: formulas, derivations, tuning ranges', 'docs/PHYSICS_SPEC.md'],
  ['TEST-PLAN', 'Verification layers and gate checklists', 'docs/TEST_PLAN.md'],
  ['ARCHITECTURE-v3_3', 'The "Floatsam" consolidated spec (planning chat)', 'ARCHITECTURE v3_3.md'],
  ['README', 'Repository quickstart', 'README.md'],
];
console.log('documents:');
for (const [name, subtitle, src] of SINGLES) {
  await renderPdf(name, wrap(name.replaceAll('-', ' '), subtitle, mdToHtml(src), true));
}

// ── The compiled game guide (all GitBook chapters + screenshots) ────────
const GUIDE_ORDER = [
  'gitbook/README.md',
  'gitbook/guide/getting-started.md',
  'gitbook/guide/modes.md',
  'gitbook/guide/creatures.md',
  'gitbook/guide/tempo-and-scores.md',
  'gitbook/guide/currents-lab.md',
  'gitbook/under-the-hood/physics.md',
  'gitbook/under-the-hood/architecture.md',
  'gitbook/under-the-hood/fairness.md',
  'gitbook/modding/add-a-creature.md',
  'gitbook/modding/tuning.md',
  'gitbook/dev/testing.md',
  'gitbook/dev/publish-this-guide.md',
];
console.log('compiled guide:');
const guideBody = GUIDE_ORDER.map((p) => `<div class="chapter">${mdToHtml(p)}</div>`).join('\n');
await renderPdf('GAME-GUIDE', wrap('The Game Guide', 'Player · physics · modding · developer handbook (13 chapters)', guideBody, true));

await browser.close();
console.log(`\nall PDFs → ${OUT}`);
