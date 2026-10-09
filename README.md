# CIG Academy — MK3 Lab

Three.js physical connection and diagnostic training simulator. All public assets are self-contained in `dist/`; no CDN, account service or runtime API is required. Serve that directory with any static HTTP server. Opening `index.html` directly with `file://` is not supported by browser ES modules.

## Use (v2 — connection buttons and physical probes)

- Drag a disconnected connector near its counterpart, then press **Conectar / Connect**. Orientation and insertion are automatic; the circular joint is secured by the same action. There is no automatic snap during drag.
- Select an attached connector and press **Desconectar / Disconnect**. It is withdrawn to a free position. All three chain joints use these buttons.
- Drag the red and black probe handles to documented connector pins or device terminals. Cables remain visible at all times. When a probe approaches a pin, press the visible **Conectar punta / Connect probe** button. Releasing the drag does not attach it.
- Use the visible meter controls for OFF / V DC / continuity. Use the red/black selection buttons and each **Retirar / Remove** button to change contacts. **Ver display / View display** focuses the instrument. Read the instrument display. Removing either probe clears the reading; contact positions follow moved components.
- Preserve the CAN continuity sequence: end-to-end, screen–middle, EM–middle. No diagnosis, score or action verdict is shown.
- Camera sensitivity: rotate 1.65, zoom 1.8, pan 1.6. Part drag multiplier 1.35; wheel depth multiplier 0.016.
- Click **Hitboxes** to show/hide the actual oriented collision boxes. This is a debugging display, not diagnostic feedback.
- Background drag orbits; right drag pans; wheel zooms; double-click inspects; Escape returns. Press **I** for scenario setup. ES / EN switches language.
- Replace parts by disconnecting them, moving them away and connecting their spares.

## Source authority and accepted decisions

The 11-page “Simulador de Conexión Física MK3 — Especificación para Astra” is authoritative. The pinout illustration, installation guide, troubleshooting guide and seven supplied photographs are supporting references. Models are representative geometry in arbitrary scene units: no manufacturer dimensions, torque, timing threshold or resistance threshold is asserted.

User clarifications (7 October 2026):

- F10/F11 interrupt the screen branch only, while EM power remains intact. These branch faults are represented in the upper harness at the screen-side positive/ground contact.
- F1/F6/F7/F8 can affect the upper or lower harness.
- F6/F7/F12 require complete harness replacement; no individual terminal extraction or repinning is implemented. F12 is on the lower harness because it ends at the EM connector.

Only the three documented MK3 screen states and three status-LED modes are simulated. The other two EM LEDs remain off. Camera, Truck COM CAN, relay behavior, digital input behavior, accelerometer and unspecified principal-connector pins have no simulated function. Relay-1 wiring is present only for the specified physical bypass procedure.

Bypass connects the vehicle-side pair after detaching it from the Relay-1 pair. A distinct in-memory `bypassLog` records the event; it does not display a success message or score. No persistent trainee tracking or accounts are added.

## Implementation

- `dist/app.js`: entry point only. Since 1.1 the application code lives in `dist/app/` (one responsibility per module, shared mutable state in `dist/app/state.js`). See `dist/app/README.md` for the module map and the rules for changing it.
- `dist/geometry.js`: hardware meshes, pin locations and collision volumes.
- `dist/electrical.js`: documented pin maps and connected-conductor graph. Faults remove or reroute actual graph edges. Replacing an unrelated component leaves the fault intact.
- `dist/vendor/`: Three.js 0.186.1, OrbitControls and OBB under the included MIT license.
- `tests/`: electrical and computational interaction checks. Run `node tests/circuit.test.mjs` and `node tests/interaction.test.mjs`.

## Validation boundary

Electrical scenarios, both configurable harness segments, reboot behavior, voltage polarity, fault isolation, connection/withdrawal, incorrect orientation, swept collision, camera exclusion and meter order have computational checks. Interaction tests use the actual Three.js geometry and application handlers with a mocked DOM and renderer; they **do not render WebGL**. Browser visual review, real pointer/touch usability and WebMCP registration in a supporting browser still require an interactive browser session.

## v2 validation
The interaction suite checks button connection/disconnection, probe dragging and electrical contact, assembled clearance, swept movement, camera exclusion and hitbox visualization. Static project browser rendering remains unverified in this runtime.

The complete meter workflow is checked through the actual DOM button handlers: choose voltage, approach two terminals, explicitly connect both probes, read 12.0 V, focus the display, change mode, remove both probes, reconnect to an intact conductor, read continuity and remove again. Pointer approach only offers the connection; it does not perform it.

## v4 cursor and instrument visibility
The scene never requests pointer lock. A separate cursor overlay remains visible even before WebGL initializes; native cursors change on controls, parts and pins. The meter controls have an explicit layer above the canvas. Selecting red or black and clicking an exposed pin brings the probe close; the user must still press Connect probe. The entry scripts and stylesheet have v4 cache keys. The new tests exercise raycast contact clicks, visible connection controls, 12.0 V, continuity and removal. Browser rendering is not verified.

## v5 solids
Each connector uses one continuous oriented body hull; pin holes are no longer arbitrary penetration paths. Main harness cables and meter leads have segmented collision volumes, probe handles are solid, and bypass cables are registered too. Drag and rotation test the updated cable shape at each sweep step. Only the intended mated port volumes are exempted. Moving hardware treats the camera sphere as an obstacle. The camera sphere has radius 0.38; it is swept in 0.08 steps and ejected if an external change encloses it. Show hitboxes / Hide hitboxes displays the exact registered volumes, including cables and probes. F4's partially inserted visual position is separated consistently with the new hulls.

## v6 learning and practice
The updated specification's “Interfaz y modos” is implemented by `dist/learning.js`. Learning opens by default, with a bilingual 12-step guide: physical chain and connection controls, power and LED/screen observations, two-probe operation, 12 V supply testing, continuity end-to-end then upper then lower, restart before replacement, harness replacement and bypass. Back/Next moves through the method without grading actions. After both CAN conductors pass an actual end-to-end measurement, individual-segment lessons are omitted. A fresh instructor scenario clears those observations.

Practice hides teaching text, the guide, and the meter's “NEXT” instruction. Controls and instrument readings remain available. Switching modes does not reset hardware or change the instructor-selected fault or segment. The guide receives no scenario ID or part fault and never names the active faulty component. This update changes instructional display and observes completed meter measurements; cursor, probe interaction, collision and camera mechanics are unchanged from v5.

Run all checks with `node --test tests/circuit.test.mjs tests/interaction.test.mjs tests/learning.test.mjs`. New checks cover mode transitions, preserved scenario, English/Spanish lessons, measurement-based skipping and reset. Computational interaction checks do not render WebGL.


## v7: learning-only lesson edition
This edition opens a compact eight-item lesson menu, in the user-requested order: assembly, LED, supply voltage, seating, orange/brown wiring, continuity, two-way display swap and bypass. The instructor dialog, mode selector, keyboard instructor shortcut and agent scenario-injection tool are removed. There is no evaluator or random selection. Internal circuit cases are deterministic examples chosen by each lesson, not user-configurable assessments.

Each lesson resets its bench, presents one short bilingual instruction and enables Next after the required scene action. Return to menu and Repeat lesson remain available. The intact continuity example ends after both end-to-end conductors pass; the interrupted example begins separately and tests end-to-end, upper then lower. Supply examples produce actual 12 V and 0 V readings. The LED lesson demonstrates unpowered, blinking and frozen states with the accepted restart-first behavior.

Swap uses two electrically separate chains at the same documented 12 V. The user physically exchanges both displays; symptom outcomes derive from the conductor graph and the connected screen/EM. A compact selector repeats either the screen-fault or vehicle-fault example. This is a tabletop representation of two vehicles, not a simulated drivable vehicle. Individual terminal pulling/repinning remains outside the implemented mechanics and is stated in the wiring lesson. The existing connection button completes securing/thread tightening.

The troubleshooting PDF supplies the diagnostic order. The updated simulator specification and accepted user clarification retain restart before replacement for steady green, despite the older troubleshooting wording. No short-circuit or high-resistance scenarios are added.

Bypass now allows the two compatible vehicle connectors, which share a display group, to mate. Its moving connector excludes its own trailing cable from collision checks; unrelated bodies still collide. Source models and the other existing interaction mechanics are preserved.

Validation uses actual application button, selection and raycast handlers with a mocked renderer. It exercises all eight instructional procedures, both swap outcomes, bilingual menu, action gating, clean repetition, electrical readings and separate bypass logging. WebGL browser rendering remains unverified because this plain static project has no compatible managed preview server.

## v8: lesson navigation and measurement-point visibility
Next/Finish no longer depends on completing hardware actions. The compact guide allows forward/back navigation, retains the correct counter, restores deterministic example setups when crossing example boundaries, and repeats any lesson from the beginning. This is guided learning, not assessment.

The current lesson step has explicit documented pin targets in `pinTargets`. Non-colliding rings and screen-space number labels mark those actual pin coordinates and move with their connectors. Voltage uses the incoming circular connector's 7/8 pair, equivalent to the EM supply contacts. Red/COM tones distinguish the voltage pair. Continuity highlights the exact documented endpoints; wire inspection also marks pin 12 as the distinct seat input where mentioned. Marker graphics render above housing geometry and do not take pointer input or change electrical contacts.

Each probe displays a floating number/signal label when approaching a valid pin or while connected. It uses the same nearest-pin selection as Connect probe, including during dragging. Returning to the lesson menu clears instructional markers.

Checks traverse every step of all eight lessons without performing physical actions, exercise Previous/Next/Repeat, and check pin target changes, marker movement, actual proximity identification, correspondence with the connection target and menu cleanup. Existing physical/electrical workflows still pass; these are computational tests without WebGL rendering.

## v9 live voltage display
Voltage is recomputed directly from the two probe tools' authoritative contacts and the current conductor graph on every display refresh and periodic scene update. Recalculation is no longer gated by whether a previous display value exists. Missing probes clear the reading; key, disconnected joints and interrupted conductors update it without requiring probe removal. Contact polarity remains meaningful.

The healthy connected EM receptacle pins 7/8 return +12.0 V in computational checks. The reported 0 V on a healthy system was not reproduced with those exact contacts. The lesson's distinct zero-supply example (step 4/5) still deliberately interrupts EM supply; a compact label now distinguishes that example from the healthy supply demonstration. No artificial 12 V override or fixed voltage output was introduced.

New application tests exercise exact EM contacts, OFF/ON, reversed probes, disconnect/reconnect of the supply chain with probes left in place, conductor interruption/restoration, missing-probe clearing and both prepared voltage examples, using display refresh and animation handlers. Browser rendering remains unverified.

## v10 explicit continuity probe placement
Continuity instructions identify the black and red probe, named connector and concrete pin at each endpoint. End-to-end: black screen 9 / red EM 1 for brown CAN LO, black screen 10 / red EM 2 for orange CAN HI. Upper segment: black screen 9 or 10 / red upper middle 3 or 4. Lower segment: black lower middle 3 or 4 / red EM 1 or 2. Both signal mappings are stated directly in each segment step; individual-segment testing remains conditional on an end-to-end failure of that signal.

A compact bilingual note states that continuity is polarity-independent, while voltage places red at positive and black at Ground. The note remains visible through the continuity lesson and relevant swap-test steps. Current pin highlights include both conductors for segment-reference steps and use probe colours to match the text. Circuit behavior, measurements and lesson navigation are unchanged.

## v11: middle 4-pin teaching examples
Continuity has a compact deterministic example selector: the existing lower-harness interruption, an unsecured middle joint and poor contact at the upper middle half's brown CAN LO terminal (pin 3). The new examples start already prepared, retaining the same end-to-end → upper segment → lower segment order. Both individual harness segments pass while end-to-end fails. The guide explicitly deduces the contact/locking interface between the halves and notes that those readings alone do not identify which half has the affected terminal.

The unsecured-joint lesson interrupts CAN at the joint bridge only, preserving voltage and individual conductor continuity. Securing the joint after physical disconnect/reconnect restores communication. The poor-terminal lesson attaches a binary open-contact flag to the actual upper 4-pin port; it removes only that pin's mating bridge. No invented resistance threshold, intermittent probability or short circuit is modeled. Reseating does not clear it; physically replacing the upper harness restores the graph. The removed harness keeps its defective contact. Measurement highlights follow the currently installed replacement.

These are learning-only cases explicitly requested by the user; no random evaluator or instructor setup is added. Existing F1–F12 circuit semantics and the prior lower-harness example are retained. Tests verify both segment passes/end-to-end failure, continued 12 V supply/normal EM LED, different reseating outcomes, physical harness replacement, replacement pin highlighting and repeat/reset behavior. WebGL rendering remains unverified.


## Version naming
From now on versions are numbered 1.x: 1.0 is the original v16; each 1.x is one step of the collision and cable repair.

## 1.1: restructuring only (step 1 of the collision/cable rebuild)
`dist/app.js` was split mechanically into 26 modules under `dist/app/` (largest about 290 lines, previously one 2,170-line file once formatted). No statement changed behaviour: top-level variables reassigned by more than one module became fields of the shared state object `S`. `electrical.js`, `learning.js`, `geometry.js`, `collision.js`, `drag-performance.js`, styles and vendor files are byte-identical to v16.

Equivalence was checked three ways: the four existing suites pass; a 121-step scripted run (all eight lessons step by step, assembly, connection, rotation, probes, voltage/continuity, camera, hitboxes, language, keyboard) yields identical state, scene and interface snapshots (about 300,000 lines) to 1.0 (v16); and Chromium renders of three screens match 1.0 pixel for pixel. The interaction suites now load the app through `tests/support/load-app.mjs`, which accepts both layouts; their assertions are unchanged.

The pre-existing rotation bug (`rotateSelected` refers to an undefined `context`) is intentionally preserved and is addressed by the collision rebuild.

## 1.13: probe lag removed (step 2)
`app/probes.js` only. Finding the pin nearest a probe (done every frame during lessons and on every probe drag move) no longer runs the approach-direction search for each pin: with the default clearance the direction is multiplied by zero, so `probeTargetPosition()` returns exactly the same position without it. `probePose()` also skips solids that are geometrically out of reach of every tested segment.

Measured with the real modules (CPU, mocked renderer), continuity lesson with the chain assembled: frame 83 ms → 2.5 ms; probe drag move 253 ms → 12 ms; probe connection 400 ms → 10 ms. In Chromium, long main-thread tasks during the lesson went from 6 in 4 s (worst 123 ms) to none. The full test run dropped from about 70 s to 35 s.

Behaviour is unchanged. `tests/probe-pose.test.mjs` compares the new code with the 1.0 algorithm for 1,344 pin/clearance cases and 560 probe-tip positions, requiring exact equality. The 121-step scripted run remains identical to 1.0.


## 1.14: rigid-body collision rebuilt (step 3)
`app/colliders.js` was rewritten and `app/movement.js` uses it. Three one-line removals were made elsewhere: cable collision proxies are no longer generated in `cables.js`, `bypass.js` and `probes.js`.

Rules: only rigid hardware is solid (77 boxes, previously 906). Cables are flexible and never block anything; they become physical ropes in later steps. There are two exemptions, both in one function: mated connector hulls, and a probe tip on the connector it measures. A probe connected to the moving part follows it. Dragging is one swept move with sliding along surfaces. Rotation goes through the same checks; a part tilted into the table is lifted onto it, and any other contact cancels the turn.

Fixed:
- Rotation threw `ReferenceError: context is not defined` and skipped collision.
- Dragging the MK3 or EM by its housing ignored every other part.

Results: a connector drag step costs about 2.8 ms (previously about 21 ms) and an MK3 body step about 0.4 ms. A lesson frame costs about 0.6 ms of CPU.

Tests: `tests/collision.test.mjs` is new. It covers the two fixed bugs, rotation of every part and connector on every axis, sliding, a probe that follows its connector, and 320 seeded random drags and rotations. After each move it checks that no two rigid bodies overlap and nothing enters the table. Run against 1.13 as a control, the same checks fail.

Three assertions in `interaction.test.mjs` described cables as solids; they now assert the flexible-cable rule. Every other existing assertion is unchanged and passes. The scripted 121-step run matches 1.0 in all lesson, meter, circuit and joint state. The only differences are in the keyboard-rotation steps, where 1.0 threw before updating the selection panel.


## 1.15: camera guard rebuilt (step 4)
Changed `app/view.js`; `app/loop.js` now calls `restoreCameraDesired()` before `controls.update()`.

In 1.0 the camera advanced in 0.08 steps from its last safe point, testing every step against every solid. When blocked it stayed there; when trapped it teleported to (12, 13, 22). Writing the clamped position back into the orbit controls also made the zoom distance drift.

In 1.15 the orbit controls keep the desired position. The camera goes exactly there unless that point is inside a solid (widened by the 0.38 camera radius). In that case it slides along the line toward the orbit target until it is just outside. Solids that only hide the target do not move the camera. The guard casts one ray per frame using the exact sphere-to-box distance and costs about 0.1 ms.

A part dragged toward the view still stops before entering the camera sphere, so the camera never jumps behind the part being held.

Tests: `tests/camera.test.mjs` sweeps the orbit through about 15,000 frames around the bench and every connector, with no frame inside a solid and no frame where the camera sticks. It also checks that the opening view and the zoom distance are exact, and that a target inside a solid works without a teleport. Run against 1.14 as a control, the camera stuck on 7,358 frames. The existing camera assertions in `interaction.test.mjs` pass unchanged.

## 1.15.1: smoother camera transitions
Every camera transition takes 1 s instead of 0.42 s: focusing a connector, returning with Esc, View display, and automatic focus when a connector approaches its mate. The transitions now use smootherstep easing, which starts and stops more gently. The duration is `CAMERA_TRANSITION_MS` in `app/view.js`; the easing is in `app/loop.js`.

From now on, adjustments within a version are numbered 1.x.y.

## 1.15.2: camera glides to the bench when a lesson changes
Choosing a lesson, repeating it, or crossing into a new example inside a lesson rebuilds the bench. The camera used to jump in one frame to the home view (up to 36.7 units). It now glides from wherever it was to the home view over the same 1 s transition (`travelHome` in `app/lessons-bridge.js`). `buildScenario` is unchanged, so start-up still opens directly on the home view.


## 1.16: meter leads are physical ropes (step 5)
New `app/rope.js`, a reusable particle-chain cable. The meter leads in `app/probes.js` use it, and `app/loop.js` advances it each frame. The polyline lead routing (`routeLead`, `leadPath`) is no longer used, so a lead can no longer stop a probe from moving. Only the lead's reach (`LEAD_REACH`, about 18 units) limits a probe.

The leads:
- hang under real gravity, rest on the table, and drape over parts;
- leave the meter jack and the probe handle in a straight line;
- never stretch: one inextensible pass, and the length only pays out under lasting, geometric tension;
- never pass through rigid hardware or the trays;
- sleep at zero cost when still.

Cost: about 0.2 ms per frame asleep and about 2 ms with both leads moving (CPU, mocked renderer). In Chromium, there were no long tasks during a measurement.

Tests: `tests/rope.test.mjs` is new. It checks:
- the leads hang, sleep, and keep their cost low;
- a real measurement reads PASA with both leads simulated;
- the reach limit works;
- 120 seeded random drags, teleports, resets, scenario changes and lesson changes, checked every frame. In that run there was never a loop, never an invalid value, at most 2.4 % whole-lead stretch, and no penetration once settled.

In `interaction.test.mjs`, the routing-specific "lead clearance" check now lets the rope settle for 3 s before checking it. `refreshProbes` now refreshes the probe's world matrix, which 1.15 only did as a side effect of lead routing.


## 1.17: harness cables are physical ropes leaving the back of the connectors (step 6)
Fixes a defect reported with screenshots. Every harness cable was anchored at the centre of each connector's *mating* face: it came out through the pin face and ran back through the shell. When the other half was mated, the cable ended inside the mated pair, so it looked cut off on the table. Its smoothed curve could also dip below the table and reappear.

`app/cables.js` was rewritten:
- Each harness is a rope (`rope.js`) that starts at the cable jacket behind both connectors.
- The four coloured wires (red, black, orange, brown) run from the rear of the shell into the jacket.
- The cable hangs, rests on the table, and never stretches.
- Its length follows the connector gap with slack, up to `HARNESS_MAX` (11 units, enough for the reference vehicle in the swap lesson). A dragged connector stops at the reach (`app/movement.js`).

`rope.js` gained two things:
- Snag release: stretch concentrated in one segment means a particle is caught in a crevice. It no longer pays out cable; that pair slips free instead.
- Drawing in the local space of a moving parent.

Tests: `tests/harness.test.mjs` is new.
- 268 settled checks across every scenario and every step of every lesson: cables leave the back of the connectors and never pass through a connector, under the table, in a loop or stretched.
- The reported case: voltage lesson with the orange connector disconnected. The cable starts behind it and nothing lies in front of its pin face.
- The reach limit and frame cost: about 0.7 ms idle with every cable asleep, 1.7 ms while dragging a connector.

The 1.14 cable test in `interaction.test.mjs` reads the rope instead of the old curve.

## 1.17.1: straight, slim probes
Each probe had a wide finger guard (0.34) next to the tip. On adjacent pins (as close as 0.205 on the circular and 12-pin connectors), the second probe hit the first, so 86 of 348 documented pin pairs could not be measured with both probes at once. The probes in `app/probe-tools.js` are now straight like real meter probes: a thin metal tip (radius 0.03) and a slim square handle (0.15), with nothing sticking out. The overall length and the lead attachment are unchanged.

`tests/probe-pairs.test.mjs` connects both probes on every pair of documented pins of every connector, free and mated: 348 of 348 now succeed with no overlap (1.17: 86 failures). In Chromium, red on circular pin 8 with black on pin 1 both connect, and the voltage lesson's pins 7/8 read 12.0 V. The cost bounds in `rope.test.mjs` now account for the four harness ropes added in 1.17.
