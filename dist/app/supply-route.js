// Where the supply cable runs (1.22), shared by the taped run (supply-cable.js) and the cable part that ends in the
// plug (parts.js): from the key box to the duct, and along it to its exit, where the free cable with the plug starts.
import { groundAt } from "./rope.js";
import { V } from "./util.js";

export const SUPPLY_TAPE_Y = groundAt() + 0.06;
// Corners of the taped run (world x, z): one straight section across the front of the mat, between the key box and
// the upper harness (it stays clear of the MK3, the bypass connectors and the bypass duct along the front edge).
export const SUPPLY_ROUTE = [
  [-6.6, -2.4],
  [-1, -2.4],
  [-1, -1.7],
].map(([x, z]) => V(x, SUPPLY_TAPE_Y, z));
// The exit of the duct and the direction the cable leaves in (along the last section).
export const SUPPLY_EXIT = {
  point: SUPPLY_ROUTE[SUPPLY_ROUTE.length - 1].clone(),
  direction: SUPPLY_ROUTE[SUPPLY_ROUTE.length - 1].clone().sub(SUPPLY_ROUTE[SUPPLY_ROUTE.length - 2]).setY(0).normalize(),
};
