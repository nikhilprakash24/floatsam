// G3 budget gate: initial load < 3 MB (ARCHITECTURE.md §6 Phase 3).
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BUDGET = 3 * 1024 * 1024;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk('dist');
const total = files.reduce((sum, f) => sum + statSync(f).size, 0);
const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';

console.log(files.map((f) => `${mb(statSync(f).size).padStart(9)}  ${f}`).join('\n'));
console.log(`\ntotal ${mb(total)} / budget ${mb(BUDGET)}`);

if (total > BUDGET) {
  console.error('BUDGET EXCEEDED');
  process.exit(1);
}
console.log('budget OK');
