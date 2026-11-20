/* DS-13 — money-format rule check: find hand-formatted money outside lib/money.
   Report-only until the Phase 3 money sweep; run from repo root. */
import fs from 'node:fs';
import path from 'node:path';

const root = 'apps/web/src';
const allow = /lib[\/\\]money|design-tokens|generated/;
function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(jsx?|tsx?|css)$/.test(e.name)) yield p;
  }
}
const hits = [];
for (const f of walk(root)) {
  if (allow.test(f)) continue;
  const t = fs.readFileSync(f, 'utf8').split('\n');
  t.forEach((line, i) => {
    if (/toFixed\(2\)/.test(line) || /\/\s*100\b/.test(line)) {
      hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 110)}`);
    }
  });
}
console.log(`money-format suspects: ${hits.length} (report-only; sweep lands with Phase 3)`);
hits.slice(0, 30).forEach((h) => console.log('  ' + h));
