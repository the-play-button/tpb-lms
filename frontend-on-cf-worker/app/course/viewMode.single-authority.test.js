import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// SINGLE-AUTHORITY LOCK (§ refacto-lifecycle-contract-fracture step 7).
// `viewMode` ('overview' | 'step') is the current view surface. Its lifecycle has exactly TWO
// legal transitions, each owned by the ONE render authority for that surface:
//   - renderCurrentStep   (course/renderer.js)  → viewMode = 'step'
//   - renderCourseOverview (course/overview.js) → viewMode = 'overview'
// No other module may WRITE viewMode — a scattered write is the fracture this converged away
// (navigation/loader/showCourseOverview used to each set it, and quiz/handler.js was a forgotten
// path). The sidebar READS it (getState + subscription) but never writes it.
const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  if (statSync(p).isDirectory()) return name === 'node_modules' ? [] : walk(p);
  return p.endsWith('.js') && !p.endsWith('.test.js') ? [p] : [];
});

describe('viewMode — single authority (one writer per surface)', () => {
  const writers = walk(appDir).filter((f) => /setState\(\s*['"]viewMode['"]/.test(readFileSync(f, 'utf8')));
  const rel = writers.map((f) => f.slice(appDir.length + 1).replace(/\\/g, '/')).sort();

  it('is written from EXACTLY the two render authorities (renderer.js + overview.js)', () => {
    expect(rel).toEqual(['course/overview.js', 'course/renderer.js']);
  });

  it('the sidebar subscribes to viewMode so reads reflect the current surface', () => {
    const sidebar = readFileSync(join(appDir, 'ui', 'sidebar.js'), 'utf8');
    expect(sidebar).toMatch(/SUBSCRIBED_KEYS\s*=\s*\[[^\]]*['"]viewMode['"]/);
  });
});
