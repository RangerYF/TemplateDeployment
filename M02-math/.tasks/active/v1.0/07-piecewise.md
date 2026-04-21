# Task: Phase 7 — Piecewise Functions

**Task ID**: v0.2-p7
**Status**: ✅ COMPLETE
**Date started**: 2026-03-13
**Date completed**: 2026-03-13

---

## Scope

| Sub-task | File | Status |
|----------|------|--------|
| T7.1 | `functionStore.ts` — addSegment/removeSegment/updateSegment | ✅ done |
| T7.2 | `UpdateFunctionParamCommand.ts` — extend FunctionPatch for segments | ✅ done |
| T7.3 | `PiecewisePanel.tsx` (new) | ✅ done |
| T7.4 | `FunctionCanvas.tsx` — piecewise render branch | ✅ done |
| T7.5 | `featurePointRenderer.ts` (new) — renderSegmentEndpoints | ✅ done |
| Layout | `M02Layout.tsx` — mode toggle + PiecewisePanel | ✅ done |

---

## Architecture

### functionStore.ts (T7.1)
Three new actions:
- `addSegment(funcId, segment)` — append to fn.segments
- `removeSegment(funcId, segId)` — filter out by id
- `updateSegment(funcId, segId, patch)` — merge patch into matching segment

### UpdateFunctionParamCommand.ts (T7.2)
FunctionPatch extended with `segments` and `mode` fields so segment array changes can be Undone via the existing command infrastructure.

### featurePointRenderer.ts (T7.5)
`renderSegmentEndpoints(ctx, segment, viewport, color): void`
- Reads domain.xMin/xMax; skips null (±∞) and out-of-viewport endpoints
- inclusive=true → filled circle radius 4px
- inclusive=false → hollow circle radius 4px (COLORS.surface interior, color stroke)

### FunctionCanvas.tsx (T7.4)
Piecewise branch in static layer effect:
```ts
if (fn.mode === 'piecewise') {
  const segmentResults = evaluatePiecewiseRange(fn.segments, vp);
  for (const { segment, points } of segmentResults) {
    const samplePts = points.map(([x,y]) => ({x,y,isValid:true,isBreak:false}));
    renderCurve(ctx, samplePts, vp, fn.color);
    renderSegmentEndpoints(ctx, segment, vp, fn.color);
  }
}
```

### PiecewisePanel.tsx (T7.3)
- Per-segment editor cards: expression input, xMin/xMax fields (empty=∞), inclusive checkboxes, × delete button
- Overlap detection: overlapping segments get yellow left border + tooltip
- Typing: live `updateSegment` (no Command); blur/Enter: `commitCommand`
- Add/Remove: immediate `UpdateFunctionParamCommand`
- `segSnapRef` captures snapshot on first edit for Undo "before"

### M02Layout.tsx
- Mode toggle tabs: "普通函数" / "分段函数"
- `handleModeSwitch`: writes `UpdateFunctionParamCommand({mode, segments})`, auto-inserts default segment if switching to piecewise with empty segments array
- standard mode: FunctionInputPanel + TransformPanel + DerivativePanel
- piecewise mode: PiecewisePanel only

---

## Execution Log

**[2026-03-13] All sub-tasks**
- functionStore: addSegment, removeSegment, updateSegment added + PiecewiseSegment import
- UpdateFunctionParamCommand: FunctionPatch extended with segments + mode
- featurePointRenderer.ts: renderSegmentEndpoints created
- FunctionCanvas.tsx: piecewise rendering branch added; imports updated
- PiecewisePanel.tsx: full segment editor with overlap detection
- M02Layout.tsx: mode tab toggle + PiecewisePanel + modeTabStyle helper
- lint ✅  tsc ✅
