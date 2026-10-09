// Shared mutable state. Every top-level variable that more than one module reassigns lives here as S.<name>.
// Read and write it as S.<name>. Do not add a field unless more than one module must reassign it.
import { Circuit } from "../electrical.js";

export const S = {
  // written by: ui
  lang: "es",
  // written by: lessons-bridge, meter
  lessonMeasurement: null,
  // written by: scenario
  circuit: new Circuit(),
  // written by: scenario
  parts: [],
  // written by: parts, scenario
  idcount: 0,
  // written by: input, probes, scenario, ui
  selected: null,
  // written by: input, scenario
  drag: null,
  // written by: scenario
  joints: [],
  // written by: input, meter, scenario, view
  focus: null,
  // written by: input, meter, scenario, view
  returnView: null,
  // written by: loop, scenario, view
  cameraMotion: null,
  // written by: colliders
  allColliders: [],
  // written by: colliders
  pinPicks: [],
  // written by: meter
  measuring: false,
  // written by: meter
  meterMode: "off",
  // written by: meter, probes, scenario
  probes: [],
  // written by: input, loop, meter, probes, scenario
  meterResult: "—",
  // written by: scenario
  testStage: { lo: 0, hi: 0 },
  // written by: scenario
  scenarioCode: "assembly",
  // written by: loop
  clock: 0,
  // written by: bypass
  bypassPorts: [],
  // written by: probes
  selectedProbe: null,
};
