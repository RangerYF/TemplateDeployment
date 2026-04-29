# M01 AI Planning Evaluation Analysis

Run:

```text
visual_m01/results/ai-planning-eval.json
```

## Summary

- Total cases: 100
- Strict pass: 83
- Strict fail: 17
- Strict operation-sequence accuracy: 83.0%

The strict score requires the exact expected operation type sequence. Several failures are valid or near-valid outputs that the oracle should treat as acceptable alternatives.

## Category Accuracy

| Category | Passed | Total | Accuracy |
| --- | ---: | ---: | ---: |
| simple-geometry | 10 | 10 | 100.0% |
| center | 8 | 8 | 100.0% |
| section-face | 7 | 7 | 100.0% |
| circumsphere | 5 | 5 | 100.0% |
| preset | 9 | 9 | 100.0% |
| measurement | 9 | 10 | 90.0% |
| segment-style | 7 | 8 | 87.5% |
| seed | 11 | 13 | 84.6% |
| point | 6 | 8 | 75.0% |
| combo | 6 | 9 | 66.7% |
| style-label-visible | 4 | 7 | 57.1% |
| negative | 1 | 6 | 16.7% |

## Oracle-Limitation Failures

These should be treated as acceptable or require a more flexible test oracle:

- `seg-current-ab-red`: returned a valid patch for `AB` style instead of `setStyle`.
- `visible-hide-bottom`: returned a valid patch for `face-bottom.visible=false` instead of `setVisible`.
- `visible-only-main`: returned a valid visibility patch instead of `setVisible`.
- `mid-connect-two`, `mid-top-connect`, `label-new-midpoint`, `combo-current-mid-angle`: used `addMidpointByLabels` instead of `addPointOnEdge`; this is acceptable for midpoint intent.
- `angle-current-line-face`: constructed projection line and measured `lineLine`; semantically valid, though not minimal.
- `combo-aux-angle`: used `addAngleMeasurement(kind=lineFace)` directly without adding the displayed segment; acceptable if rendering does not require the segment.
- `combo-circ-distance`: operation order differs but dependencies are still valid.
- `curve-section-free`: created sphere and returned warning that complex sphere section needs a preset/specific parameters; acceptable partial result.

## Real Planning Defects

These are actual issues to fix:

1. `unknown-point-label` / `unknown-g`
   - The model warns that `G` is missing, but still outputs `addSegmentByLabels(["A","G"])`.
   - Expected: no operation for missing point labels.

2. `unknown-face-center`
   - The model warns `P,Q,R,S` are unavailable, but still outputs `addFaceCenterPoint`.
   - Expected: no operation for missing face labels.

3. `missing-face-distance`
   - The model invents point `P` and outputs a distance measurement.
   - Expected: warning only.

4. `missing-angle-objects`
   - The model guesses a default dihedral angle between bottom/front faces.
   - Expected: warning asking which two faces or edge define the dihedral angle.

## Adjusted Interpretation

If oracle limitations are accepted as valid, the true semantic accuracy is roughly 93-95%.

The remaining defects are concentrated in one rule:

```text
If an operation depends on unavailable or ambiguous point/face labels, do not output the operation, even if a warning is returned.
```

## Optimization Applied

Production hard validation is intentionally deferred: incorrect operations should not be dropped in production yet, because blocking does not improve planning quality and can hide useful model behavior during iteration.

Applied changes:

1. Strengthened planning prompt/capability:
   - If a warning is about missing labels/entities/measurement targets, the corresponding dependent operation must be omitted.
   - Do not invent placeholder labels like `P` for under-specified requests.
   - Do not choose a default dihedral angle when the user did not specify faces/edge.
   - Prefer `setStyle` / `setLabel` / `setVisible` operations for supported M01 style, label and visibility changes; patch remains a fallback.
   - For measurements, use measurement operations directly; only add helper segments when the user explicitly asks for visible helper/projection/connection lines.

2. Improved test oracle:
   - Added semantic scoring beside strict exact-sequence scoring.
   - Accept low-risk patch as semantic equivalents for style/label/visibility changes.
   - Accept `addMidpointByLabels` as semantic equivalent to midpoint `addPointOnEdge`.
   - Treat semantically complete but differently ordered operation queues separately from strict minimal queues.
   - Added per-case request timeout so a hung SSE request cannot stall the full 100-case run.

Next full run should update DB from `docs/update-m01-capabilities.mysql.sql` first, then compare strict vs semantic accuracy.
