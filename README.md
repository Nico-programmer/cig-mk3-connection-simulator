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

- `dist/app.js`: scene, hardware models, pointer interactions, swept movement, OBB collision, near-camera sphere collision, mating, removal/replacement, UI, meter, scenarios and optional WebMCP registration.
- `dist/geometry.js`: hardware meshes, pin locations and collision volumes.
- `dist/electrical.js`: documented pin maps and connected-conductor graph. Faults remove or reroute actual graph edges. Replacing an unrelated component leaves the fault intact.
- `dist/vendor/`: Three.js 0.186.1, OrbitControls and OBB under the included MIT license.
- `tests/`: electrical and computational interaction checks. Run `node tests/circuit.test.mjs` and `node tests/interaction.test.mjs`.

## Validation boundary

Electrical scenarios, both configurable harness segments, reboot behavior, voltage polarity, fault isolation, connection/withdrawal, incorrect orientation, swept collision, camera exclusion and meter order have computational checks. Interaction tests use the actual Three.js geometry and application handlers with a mocked DOM and renderer; they **do not render WebGL**. Browser visual review, real pointer/touch usability and WebMCP registration in a supporting browser still require an interactive browser session.

## v2 validation
The interaction suite checks button connection/disconnection, probe dragging and electrical contact, assembled clearance, swept movement, camera exclusion and hitbox visualization. Static project browser rendering remains unverified in this runtime.

The complete meter workflow is checked through the actual DOM button handlers: choose voltage, approach two terminals, explicitly connect both probes, read 12.0 V, focus the display, change mode, remove both probes, reconnect to an intact conductor, read continuity and remove again. Pointer approach only offers the connection; it does not perform it.
