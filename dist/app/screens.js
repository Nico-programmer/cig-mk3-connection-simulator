// Draws the MK3 screen canvas states.
import { tr } from "./util.js";
import { S } from "./state.js";

export function paintScreen(part, state, time) {
  if (state !== "spinner" && part.lastState === state && part.lastLang === S.lang) return;
  part.lastState = state;
  part.lastLang = S.lang;
  const c = part.screenCanvas,
    ctx = c.getContext("2d");
  ctx.fillStyle = state === "off" ? "#080f13" : "#112636";
  ctx.fillRect(0, 0, c.width, c.height);
  if (state !== "off") {
    ctx.textAlign = "center";
    if (state === "spinner") {
      ctx.lineWidth = 10;
      ctx.strokeStyle = "#425567";
      ctx.beginPath();
      ctx.arc(384, 160, 46, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#e6f2f5";
      ctx.beginPath();
      ctx.arc(384, 160, 46, time * 2, time * 2 + Math.PI * 1.35);
      ctx.stroke();
      ctx.fillStyle = "#d7e3ed";
      ctx.font = "25px Arial";
      ctx.fillText(tr("Espera mientras nos conectamos", "Please wait while we connect"), 384, 282);
      ctx.fillText(tr("al Expansion Module", "to the Expansion Module"), 384, 320);
    } else {
      ctx.fillStyle = "#f0f4f6";
      ctx.font = "bold 61px Arial";
      ctx.fillText("FLEET", 384, 178);
      ctx.fillStyle = "#e8a464";
      ctx.font = "36px Arial";
      ctx.fillText("iQ360", 384, 230);
      ctx.fillStyle = "#b6c9d6";
      ctx.font = "24px Arial";
      ctx.fillText(tr("Bienvenido", "Welcome"), 384, 332);
    }
  }
  part.screenTexture.needsUpdate = true;
}
