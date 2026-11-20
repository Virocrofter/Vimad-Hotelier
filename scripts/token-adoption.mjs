/* DS-04 — token adoption metrics. Run from repo root: node scripts/token-adoption.mjs */
import fs from 'node:fs';
import path from 'node:path';

const roots = ['apps/web/src/styles', 'apps/web/src/app'];
function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith('.css') && !p.includes('styles/generated')) yield p;
  }
}
let vars = 0;
let hexes = 0;
const perFile = [];
for (const r of roots) {
  for (const f of walk(r)) {
    const t = fs.readFileSync(f, 'utf8');
    const v = (t.match(/var\(--/g) || []).length;
    const h = (t.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
    vars += v;
    hexes += h;
    perFile.push({ file: f, varRefs: v, rawHexes: h });
  }
}
const pct = vars + hexes ? Math.round((vars / (vars + hexes)) * 100) : 100;
const quarter = `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`;
const report = {
  generatedAt: new Date().toISOString(),
  quarter,
  tokenRefs: vars,
  rawHexes: hexes,
  tokenAdoptionPct: pct,
  topDebt: perFile.filter((p) => p.rawHexes > 0).sort((a, b) => b.rawHexes - a.rawHexes).slice(0, 12),
};
fs.mkdirSync('docs/design-system', { recursive: true });
fs.writeFileSync(`docs/design-system/adoption-${quarter}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
