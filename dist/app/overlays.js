// Overlay groups (hitbox lines and pin highlight rings), added to the scene after the probes.
import * as T from "three";
import { scene } from "./scene.js";
import "./probe-tools.js";

export const hitboxGroup = new T.Group();
scene.add(hitboxGroup);
export const hitboxMap = new Map();
export const pinHighlightGroup = new T.Group();
scene.add(pinHighlightGroup);
