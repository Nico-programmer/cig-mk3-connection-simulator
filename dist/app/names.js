// Display names of parts and connectors (ES/EN).
import { tr } from "./util.js";

export function partName(p) {
  return {
    screen: "MK3",
    upper: tr("Arnés superior", "Upper harness"),
    lower: tr("Arnés inferior", "Lower harness"),
    em: "Expansion Module",
  }[p.type];
}
export function portName(p) {
  return {
    orange: tr("Conector naranja · MK3", "Orange connector · MK3"),
    screen: "MK3 · 12 pin",
    up4: tr("Arnés superior · 4 pin", "Upper harness · 4 pin"),
    low4: tr("Arnés inferior · 4 pin", "Lower harness · 4 pin"),
    circular: "Expansion Module · 12 pin",
    em: "Expansion Module · 12 pin",
    vehicleA: tr("Arnés del vehículo", "Vehicle harness"),
    vehicleB: tr("Arnés del vehículo", "Vehicle harness"),
    relayA: "RLY 1 · Black",
    relayB: "RLY 1 · Black/White",
  }[p.kind];
}
