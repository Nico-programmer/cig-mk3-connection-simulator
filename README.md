# CIG Academy — MK3 Lab

Three.js physical connection and diagnostic training simulator. All public assets are self-contained in `dist/`; no CDN, account service or runtime API is required. Serve that directory with any static HTTP server. Opening `index.html` directly with `file://` is not supported by browser ES modules.

## Use

- Drag a connector or a disconnected component directly in the scene. Drag a cable to move both disconnected ends of its harness.
- While dragging, use the wheel for depth. The two diagonal on-screen arrows also move a selected component along the camera axis.
- Use X/Y/Z arrows to orient the selected part. An incorrectly oriented connector stops at its mating surface.
- Click a physical retaining clip to release it, then withdraw the connector along its mating axis before moving freely.
- After circular insertion, the arrows turn the collar. Six visual increments represent tightening; these are interaction steps, **not a documented real hardware torque or turn specification**. Reverse them before withdrawal.
- Drag the background to orbit; right-drag to pan; wheel to zoom. Double-click a connector to inspect it. Escape returns from inspection.
- Turn the physical key to energize/de-energize the system.
- Click the multimeter selector to cycle OFF / V DC / continuity. Click two documented pin contacts. Click the meter display to inspect its reading.
- Continuity of Expansion CAN is tested end-to-end first, then screen–middle, then EM–middle. Passing end-to-end leaves segment tests unnecessary and unavailable. Each CAN conductor has its own test sequence. Ground and supply continuity remain directly measurable.
- Detach a component, drag it to the removed-parts area, bring its spare from the back of the bench and reconnect it. Faults remain associated with the removed component.
- Press **I** (or select the instructor label) to inject a scenario. This is setup, not an authenticated instructor role. It resets the scene and does not expose the selected fault in the training view.
- ES / EN changes the interface language; signal terminology remains in English.

## Source authority and accepted decisions

The 11-page “Simulador de Conexión Física MK3 — Especificación para Astra” is authoritative. The pinout illustration, installation guide, troubleshooting guide and seven supplied photographs are supporting references. Models are representative geometry in arbitrary scene units: no manufacturer dimensions, torque, timing threshold or resistance threshold is asserted.

User clarifications (7 October 2026):

- F10/F11 interrupt the screen branch only, while EM power remains intact. These branch faults are represented in the upper harness at the screen-side positive/ground contact.
- F1/F6/F7/F8 can affect the upper or lower harness.
- F6/F7/F12 require complete harness replacement; no individual terminal extraction or repinning is implemented. F12 is on the lower harness because it ends at the EM connector.

Only the three documented MK3 screen states and three status-LED modes are simulated. The other two EM LEDs remain off. Camera, Truck COM CAN, relay behavior, digital input behavior, accelerometer and unspecified principal-connector pins have no simulated function. Relay-1 wiring is present only for the specified physical bypass procedure.

Bypass connects the vehicle-side pair after detaching it from the Relay-1 pair. A distinct in-memory `bypassLog` records the event; it does not display a success message or score. No persistent trainee tracking or accounts are added.

## Implementation

- `dist/app.js`: scene, hardware models, pointer interactions, swept movement, OBB collision, near-camera sphere collision, mating, removal/replacement, UI, meter, scenarios and optional WebMCP registration.
- `dist/geometry.js`: hardware meshes, pin locations and collision volumes.
- `dist/electrical.js`: documented pin maps and connected-conductor graph. Faults remove or reroute actual graph edges. Replacing an unrelated component leaves the fault intact.
- `dist/vendor/`: Three.js 0.186.1, OrbitControls and OBB under the included MIT license.
- `tests/`: electrical and computational interaction checks. Run `node tests/circuit.test.mjs` and `node tests/interaction.test.mjs`.

## Validation boundary

Electrical scenarios, both configurable harness segments, reboot behavior, voltage polarity, fault isolation, connection/withdrawal, incorrect orientation, swept collision, camera exclusion and meter order have computational checks. Interaction tests use the actual Three.js geometry and application handlers with a mocked DOM and renderer; they **do not render WebGL**. Browser visual review, real pointer/touch usability and WebMCP registration in a supporting browser still require an interactive browser session.
