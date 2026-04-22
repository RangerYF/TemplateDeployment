# End-to-End Physics Validation System

## Problem Statement

Code compiles and runs, but the VISUAL OUTPUT may be physically wrong:
- Force arrow pointing the wrong direction
- Object moving along wrong trajectory
- Graph showing wrong curve shape
- Numbers displayed incorrectly
- Animation behavior contradicting physics laws

Traditional unit tests verify formulas. We need to verify **what the user actually sees**.

---

## Architecture: 4-Layer Validation Pipeline

```
Layer 1: Analytical Oracle     (ground truth from physics equations)
Layer 2: State Extraction      (read simulation state at each frame)
Layer 3: Visual Verification   (screenshot + pixel analysis)
Layer 4: LLM-as-Judge          (vision model reviews screenshots)
```

### Layer 1: Analytical Oracle (Deterministic, Automated)

For each module, define test scenarios with KNOWN analytical solutions:

```typescript
// Example: P-02 projectile motion
const scenario = {
  module: 'p02',
  scene: '平抛运动',
  params: { v0: 10, angle: 0, g: 9.8 },
  checkpoints: [
    { t: 0.0, x: 0, y: 0, vx: 10, vy: 0 },
    { t: 0.5, x: 5, y: -1.225, vx: 10, vy: -4.9 },
    { t: 1.0, x: 10, y: -4.9, vx: 10, vy: -9.8 },
  ],
  invariants: [
    'vx === v0 at all times',           // horizontal velocity constant
    'vy === -g*t at all times',          // vertical velocity linear
    'y === -0.5*g*t^2 at all times',     // parabolic trajectory
  ],
  tolerance: 0.01, // 1% relative error
};
```

**Implementation**: Playwright loads page, sets params, steps simulation frame-by-frame,
reads state from `window.__SIM_STATE__` (expose via a debug hook), compares to oracle.

### Layer 2: State Extraction (Read internal state, no vision needed)

Add a minimal debug interface to SimLoop:

```typescript
// In SimLoop.ts - add debug export
if (typeof window !== 'undefined') {
  (window as any).__SIM_STATE__ = () => ({
    t: this.currentState.t,
    state: { ...this.currentState },
    params: this.getParams?.() ?? {},
  });
}
```

Then Playwright tests can:
```typescript
const state = await page.evaluate(() => (window as any).__SIM_STATE__());
expect(state.state.x).toBeCloseTo(expectedX, 2);
```

**What this catches**: Wrong physics formulas, sign errors, unit errors, integration drift.
**What this misses**: Rendering bugs (state correct but drawn wrong).

### Layer 3: Visual Verification (Pixel-level, Semi-automated)

#### 3a: Position Tracking via Canvas Pixel Analysis

For each frame, find the object's rendered position by color detection:

```typescript
// Extract object position from canvas pixels
async function findObjectPosition(page: Page, color: [number, number, number]) {
  const pixels = await page.evaluate((targetColor) => {
    const canvas = document.querySelector('canvas')!;
    const ctx = canvas.getContext('2d')!;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let sumX = 0, sumY = 0, count = 0;
    for (let i = 0; i < data.data.length; i += 4) {
      if (Math.abs(data.data[i] - targetColor[0]) < 30 &&
          Math.abs(data.data[i+1] - targetColor[1]) < 30 &&
          Math.abs(data.data[i+2] - targetColor[2]) < 30) {
        const px = (i / 4) % canvas.width;
        const py = Math.floor((i / 4) / canvas.width);
        sumX += px; sumY += py; count++;
      }
    }
    return count > 0 ? { x: sumX / count, y: sumY / count, count } : null;
  }, color);
  return pixels;
}
```

Then verify trajectory shape:
```typescript
// Collect positions over 60 frames
const positions = [];
for (let i = 0; i < 60; i++) {
  await page.evaluate(() => (window as any).__SIM_STEP__());
  positions.push(await findObjectPosition(page, [96, 165, 250])); // blue object
}

// Verify: projectile should trace a parabola
// Fit y = ax^2 + bx + c, check R^2 > 0.99
const fit = parabolaFit(positions.map(p => [p.x, p.y]));
expect(fit.rSquared).toBeGreaterThan(0.99);
```

#### 3b: Arrow Direction Verification

For force/velocity arrows, detect arrow head position relative to tail:

```typescript
// Verify force arrow points in correct direction
// Green pixels (#4ade80) = force arrow
const arrowPixels = await findPixelCluster(page, [74, 222, 128]);
const { headX, headY, tailX, tailY } = extractArrowEndpoints(arrowPixels);
const angle = Math.atan2(headY - tailY, headX - tailX);

// For object on incline, normal force should point perpendicular to surface
const expectedAngle = Math.PI / 2 + slopeAngle;
expect(angleDiff(angle, expectedAngle)).toBeLessThan(0.1); // ~6 degrees tolerance
```

#### 3c: Graph Shape Verification

Extract graph curve and verify shape:

```typescript
// Read the v-t graph pixels
const graphRegion = await page.evaluate(() => {
  const canvas = document.querySelector('.graph-canvas')!;
  // ... extract yellow curve pixels from graph region
});

// For uniform acceleration: v-t should be linear
const linearity = linearFitRSquared(graphPixelPoints);
expect(linearity).toBeGreaterThan(0.98);

// For SHM: x-t should be sinusoidal
const sinFit = sinusoidFitRSquared(graphPixelPoints);
expect(sinFit).toBeGreaterThan(0.95);
```

### Layer 4: LLM-as-Judge (Vision Model, Most Powerful but Expensive)

Take screenshots at key moments and have a vision model verify physics:

```typescript
import Anthropic from '@anthropic-ai/sdk';

async function llmPhysicsReview(screenshotPath: string, scenario: string): Promise<{
  correct: boolean;
  issues: string[];
}> {
  const client = new Anthropic();
  const imageData = fs.readFileSync(screenshotPath).toString('base64');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data: imageData },
        },
        {
          type: 'text',
          text: `You are a physics competition coach. This is a screenshot of: ${scenario}

Verify:
1. Are all force arrows pointing in the correct direction?
2. Are the magnitudes proportional to expected values?
3. Is the trajectory/motion path physically correct?
4. Are the displayed numerical values consistent with the physics?
5. Are labels and annotations correct?

Return JSON: { "correct": bool, "issues": ["issue1", ...] }`
        }
      ]
    }]
  });

  return JSON.parse(response.content[0].text);
}
```

**When to use LLM-as-Judge**:
- After each major code change (CI pipeline)
- For complex visual scenes (field lines, interference patterns)
- For things pixel analysis can't catch (label correctness, annotation placement)

---

## Test Scenario Registry

Each module defines scenarios in a structured format:

```typescript
// tests/scenarios/p01-scenarios.ts
export const P01_SCENARIOS: PhysicsScenario[] = [
  {
    id: 'p01-incline-static-friction',
    module: 'p01',
    scene: '斜面',
    params: { mass: 2, angle: 30, mu: 0.5, motion: '静止' },
    expected: {
      forces: [
        { name: 'G', magnitude: 19.6, direction: 270 },          // gravity down
        { name: 'N', magnitude: 16.97, direction: 120 },         // normal to surface
        { name: 'f', magnitude: 9.8, direction: 30 },            // friction up the slope
      ],
      netForce: { magnitude: 0, direction: null },                // static equilibrium
    },
    visualChecks: [
      'green arrow pointing downward (gravity)',
      'green arrow perpendicular to incline surface (normal)',
      'green arrow along incline pointing upward (friction)',
      'no red arrow (no acceleration, static)',
    ],
  },
  {
    id: 'p01-suspension-two-rope',
    module: 'p01',
    scene: '悬挂',
    params: { mass: 1, theta1: 30, theta2: 45 },
    expected: {
      forces: [
        { name: 'T1', magnitude: /* G*sin45/sin75 */ 7.18, direction: 120 },
        { name: 'T2', magnitude: /* G*sin30/sin75 */ 5.07, direction: 45 },
        { name: 'G', magnitude: 9.8, direction: 270 },
      ],
    },
  },

  // ... 200+ scenarios across all modules
];
```

---

## Conservation Law Invariant Checks (Continuous)

Run during every simulation step, not just at checkpoints:

```typescript
// Built into SimLoop as a debug mode
class PhysicsInvariantChecker {
  checkEnergyConservation(state: SimState, prevState: SimState) {
    // For conservative systems: |E_total(t) - E_total(0)| < epsilon
    const dE = Math.abs(state.totalEnergy - this.initialEnergy);
    if (dE / this.initialEnergy > 0.001) {
      console.error(`Energy conservation violated: dE/E = ${dE / this.initialEnergy}`);
    }
  }

  checkMomentumConservation(state: SimState) {
    // For isolated systems: p_total = const
    const dp = Math.abs(state.totalMomentum - this.initialMomentum);
    if (dp > 0.001) {
      console.error(`Momentum conservation violated: dp = ${dp}`);
    }
  }

  checkKeplerSecondLaw(state: OrbitalState) {
    // dA/dt = const (equal areas in equal times)
    const dA = 0.5 * Math.abs(state.x * state.vy - state.y * state.vx);
    if (Math.abs(dA - this.initialDA) / this.initialDA > 0.01) {
      console.error(`Kepler 2nd law violated: dA/dt drift = ${(dA - this.initialDA) / this.initialDA}`);
    }
  }
}
```

---

## CI Pipeline

```yaml
# .github/workflows/physics-validation.yml
name: Physics Validation
on: [push, pull_request]

jobs:
  unit-formulas:
    # Layer 1: Pure math/physics formula tests
    # Fast, runs on every commit
    runs-on: ubuntu-latest
    steps:
      - run: pnpm test:formulas    # vitest unit tests

  state-extraction:
    # Layer 2: Run simulations headlessly, extract state, compare to oracle
    # Medium speed, runs on every commit
    runs-on: ubuntu-latest
    steps:
      - run: pnpm test:state       # playwright + state extraction

  visual-regression:
    # Layer 3: Screenshot comparison + pixel analysis
    # Slower, runs on PRs
    runs-on: ubuntu-latest
    steps:
      - run: pnpm test:visual      # playwright screenshots + pixel math

  llm-judge:
    # Layer 4: Vision model review
    # Expensive, runs on release branches only
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - run: pnpm test:llm-judge   # Claude vision API review
```

---

## Practical Implementation Order

### Phase 1: State Extraction (highest ROI, lowest effort)
1. Add `__SIM_STATE__` and `__SIM_STEP__` hooks to SimLoop
2. Write 50 analytical oracle scenarios (5 per module)
3. Playwright test runner that sets params, steps, compares
4. This alone would have caught 80% of the bugs we found

### Phase 2: Conservation Invariants (catches integration drift)
1. Add energy/momentum/angular-momentum checkers
2. Run continuously during 1000-frame simulations
3. Catches Boris algorithm drift, Verlet energy issues, etc.

### Phase 3: Visual Pixel Tests (catches rendering bugs)
1. Arrow direction detection for force analysis
2. Trajectory shape fitting for motion modules
3. Graph curve shape verification
4. Screenshot baseline comparison for stable scenes

### Phase 4: LLM-as-Judge (catches everything else)
1. Generate scenarios with known physics
2. Screenshot each scenario
3. Have Claude Vision verify correctness
4. Most expensive but catches label errors, annotation mistakes, visual inconsistencies

---

## Key Insight: Why This Is NOT Like Training an RL Model

RL needs to LEARN the reward function. We already KNOW the reward function — it's physics.
The analytical oracle IS the reward signal. We don't need to train anything.

The challenge is purely engineering:
- Extracting observable state from a canvas
- Defining comprehensive test scenarios
- Running them efficiently in CI

This is closer to **property-based testing** (like QuickCheck) than RL:
- Property: "energy is conserved"
- Property: "force arrows sum to net force"
- Property: "trajectory matches analytical solution"
- We generate random params, run sim, check properties hold
