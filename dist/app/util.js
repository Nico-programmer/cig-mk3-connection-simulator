// Small shared helpers: DOM lookup, vector/quaternion shorthands and the ES/EN text selector.
import * as T from "three";
import { S } from "./state.js";

export const $ = (id) => document.getElementById(id),
  V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z),
  Q = (x = 0, y = 0, z = 0) => new T.Quaternion().setFromEuler(new T.Euler(x, y, z));
export const tr = (es, en) => (S.lang === "es" ? es : en);
