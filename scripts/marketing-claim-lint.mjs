#!/usr/bin/env node
/* scripts/marketing-claim-lint.mjs — v2 (2026-11-27)
 * [CLAIM-PURGE] Mechanical enforcement of the marketing claim register.
 * NEW violations anywhere fail the build. Legacy violations listed in
 * scripts/marketing-claim-baseline.json are QUARANTINED — each entry maps to
 * its rebuild task (Marketing Plan Addendum v1.1); remove it when the task ships.
 * Do not weaken the rules; amend the register (addendum §2) instead.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN_DIR = join(ROOT, 'apps/web/src/app/marketing');
const BASELINE_PATH = join(ROOT, 'scripts/marketing-claim-baseline.json');
const EXTS = new Set(['.jsx', '.tsx', '.ts', '.js']);

const RULES = [
  ['standalone "AI" (frame-as: rate guardrails — register v3.1)', /\bAI\b/],
  ['fabricated case study name', /Grand Plaza/],
  ['public USD-style price', /\$\d/],
  ['unsourced compliance badge', /PCI Level 1|SOC ?2|ISO ?27001/],
  ['free-tier promise (Beacon removed — addendum §1)', /free trial/i],
  ['60-day trial (old copy)', /60-day/],
  ['US payment rails', /\bACH\b|wire transfer/i],
  ['US identity', /San Francisco|\+1-\d/],
  ['old brand', /Unified PMS|unifiedpms/i],
  ['white-label claim (roadmap — not shippable)', /white-?label/i],
  ['unsourced revenue metric', /RevPAR/],
  [
    'fabricated integration catalog (only LIVE/PILOT integrations may be named)',
    /Stripe|Adyen|Worldpay|MICROS|Toast POS|Lightspeed|Assa ?Abloy|SALTO|Dormakaba|QuickBooks|Salesforce|HubSpot/i,
  ],
];

const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  : { files: {} };

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (EXTS.has(p.slice(p.lastIndexOf('.')))) yield p;
  }
}

const newHits = [];
let quarantined = 0;
const quarantinedFiles = new Set();

for (const file of walk(SCAN_DIR)) {
  const rel = file.replace(ROOT, '');
  const entry = baseline.files?.[rel];
  const lines = readFileSync(file, 'utf8').split('\n');
  for (const [label, rx] of RULES) {
    lines.forEach((line, i) => {
      if (!rx.test(line)) return;
      if (entry && (entry.rules === 'all' || (entry.rules || []).includes(label))) {
        quarantined++;
        quarantinedFiles.add(rel);
        return;
      }
      newHits.push(`${rel}:${i + 1}  [${label}]  ${line.trim().slice(0, 90)}`);
    });
  }
}

if (newHits.length > 0) {
  console.error(
    `CLAIM-LINT FAIL — ${newHits.length} NEW banned pattern(s) outside the quarantine baseline:`
  );
  for (const h of newHits) console.error('  ' + h);
  console.error('Fix the copy, or amend the register AND the baseline together (addendum §2).');
  process.exit(1);
}
console.log(
  `CLAIM-LINT PASS — 0 new violations; ${quarantined} quarantined across ${quarantinedFiles.size} legacy file(s)`
);
for (const f of [...quarantinedFiles].sort()) {
  console.log(`  quarantined: ${f} — until: ${baseline.files[f].until}`);
}
