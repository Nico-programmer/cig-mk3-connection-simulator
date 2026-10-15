// Draws the MK3 screen canvas states.
import { tr } from "./util.js";
import { mk3 } from "./model-mk3.js";
import { S } from "./state.js";

export function paintScreen(part, state, time) {
  if (state !== "spinner" && part.lastState === state && part.lastLang === S.lang) return;
  part.lastState = state;
  part.lastLang = S.lang;
  const c = part.screenCanvas,
    ctx = c.getContext("2d");
  if (part.realistic) paintRealistic(ctx, c.width, c.height, state, time);
  else paintProcedural(ctx, c, state, time);
  part.screenTexture.needsUpdate = true;
}

// Realistic MK3: off = black, spinner = Expansion Module not detected, otherwise the login image.
function paintRealistic(ctx, W, H, state, time) {
  if (state === "off") {
    ctx.fillStyle = "#05090c";
    ctx.fillRect(0, 0, W, H);
  } else if (state === "spinner") {
    ctx.fillStyle = "#2a5673";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 34px Arial, sans-serif";
    ctx.fillText(tr("Espera mientras nos conectamos", "Please wait while we connect"), W / 2, 78);
    ctx.fillText(tr("al Expansion Module", "to the expansion module"), W / 2, 122);
    // Ring of 8 white dots; their size decreases against the direction of rotation.
    const n = 8,
      head = (time * 3.2) % n;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2,
        r = 5 + 15 * Math.pow(1 - ((head - i + n) % n) / n, 1.6);
      ctx.beginPath();
      ctx.arc(W / 2 + Math.cos(a) * 62, 290 + Math.sin(a) * 62, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (mk3.login) ctx.drawImage(mk3.login, 0, 0, W, H);
  else {
    ctx.fillStyle = "#1f4553";
    ctx.fillRect(0, 0, W, H);
  }
}

function paintProcedural(ctx, c, state, time) {
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
}
