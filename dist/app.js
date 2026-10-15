// MK3 Lab entry point. Each module in ./app/ has a single responsibility; see app/README.md.
// The imports below run the start-up code in the same order as the original single-file app.js.
import "./app/util.js";
import "./app/learning-mount.js";
import "./app/scene.js";
import "./app/bench.js";
import "./app/probe-tools.js";
import "./app/meter.js";
import "./app/input.js";
import "./app/ui.js";
import "./app/hitboxes.js";
import "./app/overlays.js";
import "./app/loop.js";
import { loadMk3Model } from "./app/model-mk3.js";
import { buildScenario } from "./app/scenario.js";
import { animate } from "./app/loop.js";

// The realistic MK3 model (when available) must be ready before the first bench is built.
await loadMk3Model();
buildScenario();
requestAnimationFrame(animate);
