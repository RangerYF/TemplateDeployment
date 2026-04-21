/**
 * Formal Logic Acceptance Tests for M03 — pure math functions only.
 * Run with: npx tsx --tsconfig tsconfig.json src/__tests__/acceptance.test.ts
 */

// Use relative imports to avoid @ alias resolution issues with tsx
import { computeEllipseDerived, computeHyperbolaDerived, computeParabolaDerived, eccentricityToParams } from '../engine/conicAnalysis';

let pass = 0;
let fail = 0;
function assert(name: string, ok: boolean) {
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else    { fail++; console.log(`  ✗ ${name}`); }
}

// ─── Test 1: Elliptical Precision (a=5, b=3) ────────────────────────────────

console.log('\n=== Test 1: Ellipse a=5, b=3 ===');
const e1 = computeEllipseDerived({ a: 5, b: 3, cx: 0, cy: 0 });
assert(`c = ${e1.c.toFixed(6)} (expected 4)`,  Math.abs(e1.c - 4) < 1e-6);
assert(`e = ${e1.e.toFixed(6)} (expected 0.8)`, Math.abs(e1.e - 0.8) < 1e-6);
assert(`F₁ = (${e1.foci[0][0]}, ${e1.foci[0][1]}) → (-4, 0)`, Math.abs(e1.foci[0][0] + 4) < 1e-6 && Math.abs(e1.foci[0][1]) < 1e-6);
assert(`F₂ = (${e1.foci[1][0]}, ${e1.foci[1][1]}) → (4, 0)`,  Math.abs(e1.foci[1][0] - 4) < 1e-6 && Math.abs(e1.foci[1][1]) < 1e-6);
assert(`directrix₁ = ${e1.directrices[0].toFixed(4)} → -6.25`, Math.abs(e1.directrices[0] + 6.25) < 1e-4);
assert(`directrix₂ = ${e1.directrices[1].toFixed(4)} →  6.25`, Math.abs(e1.directrices[1] - 6.25) < 1e-4);

// ─── Test 2: Eccentricity Transition ─────────────────────────────────────────

console.log('\n=== Test 2: Eccentricity Transition ===');
const c = 3;
assert('e=0.5 → ellipse',   eccentricityToParams(0.5, c).type === 'ellipse');
assert('e=1.0 → parabola',  eccentricityToParams(1.0, c).type === 'parabola');
assert('e=1.5 → hyperbola', eccentricityToParams(1.5, c).type === 'hyperbola');
assert('e < 1e-6 → circle', eccentricityToParams(1e-7, c).type === 'circle');

// Smooth sweep: verify no NaN params (a=0 is valid for parabola)
let smooth = true;
for (let eVal = 0.01; eVal <= 2.5; eVal += 0.01) {
  const r = eccentricityToParams(eVal, c);
  if (!r.type) { smooth = false; break; }
  if (isNaN(r.a) || isNaN(r.b)) { smooth = false; break; }
  // For non-parabola, a must be positive
  if (r.type !== 'parabola' && r.a <= 0) { smooth = false; break; }
}
assert('Sweep e=0.01→2.5: no NaN, valid params', smooth);

// ─── Test 3: Hyperbola Precision (a=3, b=4) ─────────────────────────────────

console.log('\n=== Test 3: Hyperbola a=3, b=4 ===');
const h1 = computeHyperbolaDerived({ a: 3, b: 4, cx: 0, cy: 0 });
assert(`c = ${h1.c.toFixed(6)} (expected 5)`,       Math.abs(h1.c - 5) < 1e-6);
assert(`e = ${h1.e.toFixed(6)} (expected 1.66667)`,  Math.abs(h1.e - 5/3) < 1e-5);
assert(`asymptote slope = ±${(h1.asymptotes[0].k).toFixed(4)} (expected ±1.3333)`, Math.abs(Math.abs(h1.asymptotes[0].k) - 4/3) < 1e-4);

// ─── Test 4: Parabola Focus/Directrix (p=2) ─────────────────────────────────

console.log('\n=== Test 4: Parabola p=2 ===');
const p1 = computeParabolaDerived({ p: 2, cx: 0, cy: 0, orientation: 'h' });
assert(`Focus = (${p1.focus[0]}, ${p1.focus[1]}) → (1, 0)`, Math.abs(p1.focus[0] - 1) < 1e-6 && Math.abs(p1.focus[1]) < 1e-6);
assert(`Directrix = ${p1.directrix} → -1`,                   Math.abs(p1.directrix + 1) < 1e-6);

const p2 = computeParabolaDerived({ p: 2, cx: 0, cy: 0, orientation: 'v' });
assert(`Vertical focus = (${p2.focus[0]}, ${p2.focus[1]}) → (0, 1)`, Math.abs(p2.focus[0]) < 1e-6 && Math.abs(p2.focus[1] - 1) < 1e-6);
assert(`Vertical directrix = ${p2.directrix} → -1`,                   Math.abs(p2.directrix + 1) < 1e-6);

// ─── Test 5: Locus r₁+r₂ = 2a verification ─────────────────────────────────

console.log('\n=== Test 5: Locus r₁+r₂ = 2a ===');
// Use the already-computed ellipse (a=5, b=3, foci at ±4)
const f1 = e1.foci[0], f2 = e1.foci[1];
let maxError = 0;
for (let i = 0; i < 360; i++) {
  const theta = (i / 360) * 2 * Math.PI;
  const px = 5 * Math.cos(theta);
  const py = 3 * Math.sin(theta);
  const r1 = Math.sqrt((px - f1[0])**2 + (py - f1[1])**2);
  const r2 = Math.sqrt((px - f2[0])**2 + (py - f2[1])**2);
  const error = Math.abs(r1 + r2 - 10);
  if (error > maxError) maxError = error;
}
assert(`r₁+r₂ = 10 (2a), max deviation = ${maxError.toExponential(4)}`, maxError < 1e-10);

// ─── Test 6: Equation sync (derived updates with params) ────────────────────

console.log('\n=== Test 6: Equation Sync ===');
const eA = computeEllipseDerived({ a: 3, b: 2, cx: 0, cy: 0 });
const eB = computeEllipseDerived({ a: 4, b: 2, cx: 0, cy: 0 });
assert('Changing a: c updates correctly', Math.abs(eA.c - Math.sqrt(5)) < 1e-6 && Math.abs(eB.c - Math.sqrt(12)) < 1e-6);
assert('Changing a: e updates correctly',  Math.abs(eA.e - Math.sqrt(5)/3) < 1e-6 && Math.abs(eB.e - Math.sqrt(12)/4) < 1e-6);

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════');
console.log(`${pass} passed, ${fail} failed`);
console.log(`${fail === 0 ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}`);
console.log('═══════════════════════════════════════');

if (fail > 0) process.exit(1);
