# User-Centric Regression Checklist

This checklist is task-first, not control-first. Run it from the perspective of a real teacher or student trying to complete a goal under time pressure.

## Test Principles

- Prefer realistic end-to-end tasks over isolated control checks.
- Judge both correctness and effort cost.
- Treat "I can do it, but only after guessing" as a product issue.
- Give extra weight to recovery after errors, because classroom use is interruption-heavy.
- Mark issues by `bug`, `usability`, `complexity`, or `recovery`.

## Suggested User Profiles

| Profile | Typical Goal | Risk Pattern |
| --- | --- | --- |
| First-time teacher | Open module and finish one demo in under 2 minutes | Gets lost in layout, does not know where to start |
| Experienced teacher | Build a multi-step explanation quickly | Notices slow paths, repetitive steps, weak shortcuts |
| Live classroom presenter | Switch views and recover from mistakes in front of students | Low tolerance for hidden state or irreversible actions |
| Student self-study user | Explore and learn alone without teacher guidance | Needs clearer affordances and lower cognitive load |

## Global Checks

| ID | What to Verify | Pass Signal | Common Failure Signal |
| --- | --- | --- | --- |
| G-01 | User can identify what each module does from the first screen | Route choice is obvious in under 10 seconds | User must click around or guess |
| G-02 | Core action is visible without documentation | Main input and main canvas are obvious | Important action is hidden in side panel or secondary control |
| G-03 | Current selection and current mode are obvious | User always knows "what is active now" | Silent mode changes or unclear active target |
| G-04 | Mistakes are recoverable | Undo, reset, or clear path is easy to find | User has to reload page to recover |
| G-05 | Invalid input feedback is actionable | Error tells user what to change next | Error is vague, silent, or blocks progress without guidance |
| G-06 | Canvas does not feel fragile | Pan, zoom, hover, select behave predictably | Graph disappears, selection gets stuck, accidental mode conflict |
| G-07 | Narrow layout is still usable | No critical control becomes unreachable | Side panel clipping or dense unreadable controls |
| G-08 | Performance holds during common demos | Dragging and animation stay smooth enough for teaching | Noticeable lag, flicker, or redraw artifacts |

## M02 Function Lab

### Highest-Risk User Tasks

| ID | Scenario | Steps | Expected Result | Issue Type if Failed |
| --- | --- | --- | --- | --- |
| M02-01 | First function entry | Open `/m02`, add `x^2`, identify active function, see graph | Function appears immediately and active state is clear | `usability` or `bug` |
| M02-02 | Natural math shorthand | Enter `sinx`, `2x+1`, `|x|`, `lnx` | Expressions are accepted or corrected with clear feedback | `bug` or `usability` |
| M02-03 | Lost graph recovery | Enter `1/x`, pan far away, zoom aggressively, then recover | User can quickly restore a visible graph by reset or viewport input | `recovery` |
| M02-04 | Transform mental model | Adjust `a`, `b`, `h`, `k` one by one | Change direction matches user expectation and graph never jumps unpredictably | `complexity` or `bug` |
| M02-05 | Mode switching | Switch a custom function between standard and piecewise | User understands what changed and does not lose work unexpectedly | `complexity` or `recovery` |
| M02-06 | Feature explanation flow | Show derivative, tangent, feature points on the same function | Visual result is understandable and not cluttered | `usability` |
| M02-07 | Parameter animation | Configure animation, play, stop, loop, then undo | Playback is predictable and state does not get stuck | `bug` or `recovery` |
| M02-08 | Multi-function comparison | Add 3 to 5 functions, rename or recolor mentally, select one to edit | Active target stays clear and edits never hit the wrong function | `usability` |

### M02 Usability Watchpoints

- Can a first-time user distinguish `普通函数` and `分段函数` without prior explanation?
- When the graph is off-screen, is the fastest recovery path obvious?
- Do users understand whether they are editing the expression itself, named coefficients, or transform sliders?
- Is the right panel too dense once derivative, animation, transform, and viewport controls all appear together?

## M03 Conic Geometry

### Highest-Risk User Tasks

| ID | Scenario | Steps | Expected Result | Issue Type if Failed |
| --- | --- | --- | --- | --- |
| M03-01 | Quick preset success | Open `/m03`, load one preset conic, identify key geometry labels | Teacher can start a demo fast without setup friction | `usability` |
| M03-02 | Add line and inspect intersections | Create a line, move it, observe intersections with conic | Intersections update correctly and remain visually legible | `bug` |
| M03-03 | Implicit curve input | Input a custom curve equation and adjust parameters | Render updates correctly without confusing failure modes | `bug` or `usability` |
| M03-04 | Movable point on curve | Add a point constrained to a curve, drag it, show trajectory | Constraint feels stable and trajectory logic is understandable | `bug` or `complexity` |
| M03-05 | Eccentricity demo | Sweep `e` across ellipse, parabola, hyperbola | Transition tells a clear story, not just moving numbers | `usability` |
| M03-06 | Optical reflection | Enable optical mode and manipulate geometry | Visuals remain readable and explanation value is obvious | `complexity` |
| M03-07 | Multi-tool switching | Alternate between pan, point, line, movable point, selection | Tool state is always obvious and easy to exit | `recovery` |

### M03 Usability Watchpoints

- Are geometry labels readable without overlapping the teaching content?
- Can the user tell whether a drag will move the viewport, a line, or a constrained point?
- When multiple entities exist, is the selected entity unambiguous?
- Does the eccentricity feature explain meaning, or only expose a slider?

## M04 Trigonometry Lab

### Highest-Risk User Tasks

| ID | Scenario | Steps | Expected Result | Issue Type if Failed |
| --- | --- | --- | --- | --- |
| M04-01 | Unit-circle first interaction | Open `/m04`, drag point `P`, see angle and trig values update | Drag works immediately and feedback matches movement | `bug` |
| M04-02 | Dual-view understanding | Drag on unit circle and interpret the synced graph point | User can explain the connection without extra instruction | `usability` |
| M04-03 | Function switching | Switch among `sin`, `cos`, `tan` and inspect labels and scales | Differences are obvious and no stale visual state remains | `bug` or `usability` |
| M04-04 | Five-point method | Start the five-point workflow and follow each step | Progression is teachable, not just technically correct | `complexity` |
| M04-05 | Auxiliary angle formula | Input `a sin x + b cos x` and inspect transformed result | Result is easy to trust and compare visually | `usability` |
| M04-06 | Triangle solver | Solve SSS, SAS, AAS, and SSA edge cases | Inputs, results, and failure states are clear | `bug` |
| M04-07 | Special value table | Click a special angle and verify circle/graph animation | Jump is quick, accurate, and does not disorient users | `usability` |

### M04 Usability Watchpoints

- Is the current mode obvious when switching between function graphing and triangle solving?
- Does the unit-circle panel explain enough for first-time users without becoming noisy?
- Are `tan` discontinuities and scale changes obvious enough to avoid mistrust?
- Is the five-point workflow discoverable or buried behind advanced controls?

## Recovery and Error Tests

Run these in every module.

| ID | Scenario | Expected Result |
| --- | --- | --- |
| R-01 | Enter invalid expression or partial input | User gets clear feedback and can continue editing without state corruption |
| R-02 | Create an object, then undo and redo repeatedly | State is stable and restored accurately |
| R-03 | Select the wrong item, then switch target quickly | Active item updates correctly and panel content follows |
| R-04 | Zoom or pan to an extreme state | Reset path is obvious and effective |
| R-05 | Trigger multiple toggles quickly | UI state stays in sync with rendered state |
| R-06 | Leave a complex scene and come back later | User can still understand the current scene state |

## Performance and Presentation Tests

| ID | Scenario | Expected Result |
| --- | --- | --- |
| P-01 | Continuous drag for 10 seconds | No severe frame drops or flicker |
| P-02 | Animation while labels and overlays are visible | Main teaching content remains readable |
| P-03 | Projector or narrow-width layout | Text and controls remain readable without clipping core actions |
| P-04 | Scene with several objects and annotations | No severe overlap that blocks explanation |

## How to Record Findings

Use one line per issue.

| Module | Persona | Scenario ID | Type | Severity | What Happened | Why It Hurts the User | Suggested Fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M02 | First-time teacher | M02-03 | recovery | high | Graph disappeared and reset was not noticed | Demo stops in class and user loses trust | Move reset closer to viewport controls or add stronger empty-state hint |

## Release Gate Suggestion

Before classroom-facing release, all of the following should be true:

- No `high` severity `bug` in core scenarios `M02-01` to `M02-04`, `M03-01` to `M03-03`, `M04-01` to `M04-03`
- No unresolved `recovery` issue that forces reload
- No `usability` issue where a first-time teacher fails the first-task path twice in a row
- No `complexity` issue that blocks a live demo in under 3 minutes
