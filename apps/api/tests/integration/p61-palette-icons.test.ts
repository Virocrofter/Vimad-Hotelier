/* P61 — static gate: every `icon: X` reference in the command palette must
 * resolve to an import or an in-file definition. Catches the exact
 * "entry added, import dropped by a rewrite" class that shipped as a
 * runtime ReferenceError (Ticket, 2026-11-27). */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const PALETTE = join(here, '../../../web/src/components/layout/CommandPalette.jsx');

describe('P61 palette icon references', () => {
  it('every icon: identifier is imported or defined in-file', () => {
    const src = readFileSync(PALETTE, 'utf-8');

    const imported = new Set<string>();
    const importRe = /import\s*\{([^}]*)\}\s*from\s*'[^']*'/g;
    let m: RegExpExecArray | null;
    while ((m = importRe.exec(src))) {
      for (const name of m[1].split(',')) {
        const n = name.trim();
        if (n) imported.add(n);
      }
    }

    const defined = new Set<string>();
    for (const re of [/function\s+([A-Z][A-Za-z0-9]*)/g, /const\s+([A-Z][A-Za-z0-9]*)\s*=/g]) {
      while ((m = re.exec(src))) defined.add(m[1]);
    }

    const iconRefs = new Set<string>();
    const iconRe = /icon:\s*([A-Z][A-Za-z0-9]*)/g;
    while ((m = iconRe.exec(src))) iconRefs.add(m[1]);

    expect(iconRefs.size).toBeGreaterThanOrEqual(8);
    const missing = [...iconRefs].filter((n) => !imported.has(n) && !defined.has(n));
    expect(missing).toEqual([]);
    console.log(
      'P61 OK —',
      iconRefs.size,
      'icon refs resolve (imports +',
      defined.size,
      'defined)'
    );
  });
});
