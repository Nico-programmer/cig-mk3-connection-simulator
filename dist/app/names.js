// Display names of parts and connectors (ES/EN).
import { tr } from "./util.js";

export function partName(p) {
  return {
    screen: "MK3",
    upper: tr("Arnés superior", "Upper harness"),
    lower: tr("Arnés inferior", "Lower harness"),
    em: "Expansion Module",
    supply: tr("Cable de alimentación", "Supply cable"),
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
    supplyPlug: tr("Cable de alimentación · 4 pin", "Supply cable · 4 pin"),
    bypassPlug: tr("Cable de bypass · 4 pin", "Bypass cable · 4 pin"),
    bypassJack: tr("Arnés inferior · bypass", "Lower harness · bypass"),
    supplyJack: tr("Arnés superior · alimentación", "Upper harness · supply"),
    vehicleA: tr("Arnés del vehículo", "Vehicle harness"),
    vehicleB: tr("Arnés del vehículo", "Vehicle harness"),
    relayA: "RLY 1 · Black",
    relayB: "RLY 1 · Black/White",
  }[p.kind];
}
