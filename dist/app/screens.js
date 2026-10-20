// Draws the MK3 screen canvas states.
import { tr } from "./util.js";
import { mk3 } from "./model-mk3.js";
import { S } from "./state.js";

export function paintScreen(part, state, time) {
  // The realistic screen fades between states, so it keeps repainting until the fade is over.
  const fading = part.realistic && updateFade(part, state, time);
  const animated = state === "spinner" || (part.realistic && part.fade.splash > 0);
  if (!fading && !animated && part.lastState === state && part.lastLang === S.lang) return;
  part.lastState = state;
  part.lastLang = S.lang;
  const c = part.screenCanvas,
    ctx = c.getContext("2d");
  if (part.realistic) paintRealistic(ctx, c.width, c.height, part.fade, time);
  else paintProcedural(ctx, c, state, time);
  part.screenTexture.needsUpdate = true;
}

// Layers (0..1) of the realistic screen: the boot screen ("FLEET iQ360 - System is loading"), the login image
// and the "connecting" window. Each moves towards its target at 1 / FADE_SECONDS per second, so switching
// on, the error appearing and the error being solved are never abrupt. Switching on shows the boot screen
// for BOOT_SECONDS first, then fades to the login (and the window, if there is no Expansion Module).
// A new screen starts settled, without booting.
const FADE_SECONDS = 0.45;
export const BOOT_SECONDS = 3;
const approach = (value, target, step) => (value < target ? Math.min(target, value + step) : Math.max(target, value - step));
const smooth = (t) => t * t * (3 - 2 * t);
// Returns true while a fade is still moving.
function updateFade(part, state, time) {
  const on = state !== "off";
  if (!part.fade) part.bootStart = on ? -Infinity : null;
  else if (on && part.bootStart === null) part.bootStart = time; // just switched on
  else if (!on) part.bootStart = null;
  const booting = on && time - part.bootStart < BOOT_SECONDS;
  const target = { splash: booting ? 1 : 0, login: on && !booting ? 1 : 0, popup: state === "spinner" && !booting ? 1 : 0 };
  const f = (part.fade ??= { ...target, time, elapsed: 0 });
  const step = Math.max(0, time - f.time) / FADE_SECONDS;
  f.time = time;
  if (Number.isFinite(part.bootStart)) f.elapsed = time - part.bootStart;
  f.splash = approach(f.splash, target.splash, step);
  f.login = approach(f.login, target.login, step);
  f.popup = approach(f.popup, target.popup, step);
  return f.splash !== target.splash || f.login !== target.login || f.popup !== target.popup;
}

// Realistic MK3: black, the boot screen and the login image faded in over it, and on top the
// "Expansion Module not detected" window (a photo of the real unit) faded in over the login.
function paintRealistic(ctx, W, H, fade, time) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#05090c";
  ctx.fillRect(0, 0, W, H);
  if (fade.splash > 0) {
    ctx.globalAlpha = smooth(fade.splash);
    paintBootScreen(ctx, W, H, fade.elapsed);
  }
  if (fade.login > 0) {
    ctx.globalAlpha = smooth(fade.login);
    if (mk3.login) ctx.drawImage(mk3.login, 0, 0, W, H);
    else {
      ctx.fillStyle = "#1f4553";
      ctx.fillRect(0, 0, W, H);
    }
  }
  if (fade.popup > 0) {
    ctx.globalAlpha = smooth(fade.popup) * smooth(fade.login); // never visible before the login
    paintConnectingWindow(ctx, W, H, time);
  }
  ctx.globalAlpha = 1;
}

// The boot screen, as in the capture of the real unit (732 px wide, so measures are x 1.093 on the 800 px
// screen): a near-black gradient, "FLEET" in wide white letters, "iQ360" right-aligned under it with "iQ" in
// light steel, and "System is loading, please wait" with 1-3 dots that go . .. ... . ... .. . and repeat.
export const BOOT_DOTS = [1, 2, 3, 1, 3, 2, 1];
export const BOOT_DOT_STEP = 0.3; // 7 steps = 2.1 s: the whole . .. ... . ... .. . is seen once
const BOOT = {
  fleet: { right: 694, left: 115, baseline: 215 },
  iq360: { right: 697, left: 339, baseline: 326 },
  stretchY: 1.25, // the capture's letters are wide and tall: Arial is stretched to match
  message: { x: 260, baseline: 396, width: 255 },
};
const BOOT_FONT = "bold 100px Arial, Helvetica, sans-serif";
function wide(ctx, parts, left, right, baseline) {
  // Draws coloured parts in one line, stretched horizontally so that it spans left..right.
  ctx.font = BOOT_FONT;
  const widths = parts.map(([text]) => ctx.measureText(text).width),
    sx = (right - left) / widths.reduce((a, b) => a + b, 0);
  ctx.save();
  ctx.translate(left, baseline);
  ctx.scale(sx, BOOT.stretchY);
  let x = 0;
  parts.forEach(([text, color], n) => {
    ctx.fillStyle = color;
    ctx.fillText(text, x, 0);
    x += widths[n];
  });
  ctx.restore();
}
function paintBootScreen(ctx, W, H, elapsed) {
  const k = W / 800;
  ctx.save();
  ctx.scale(k, k);
  const bg = ctx.createLinearGradient(0, 0, 0, 480);
  bg.addColorStop(0, "#09090a");
  bg.addColorStop(1, "#1b1c1e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 800, 480);
  ctx.textAlign = "left";
  wide(ctx, [["FLEET", "#f3f3f3"]], BOOT.fleet.left, BOOT.fleet.right, BOOT.fleet.baseline);
  wide(ctx, [["iQ", "#b7c0cc"], ["360", "#f6f6f6"]], BOOT.iq360.left, BOOT.iq360.right, BOOT.iq360.baseline);
  const english = "System is loading, please wait",
    text = tr("El sistema está cargando, por favor espere", english),
    dots = ".".repeat(BOOT_DOTS[Math.floor(Math.max(0, elapsed) / BOOT_DOT_STEP) % BOOT_DOTS.length]);
  ctx.font = "17px Arial, Helvetica, sans-serif";
  const size = (17 * BOOT.message.width) / Math.max(1, ctx.measureText(english).width);
  ctx.font = `${Math.min(size, 20).toFixed(1)}px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = "#e9e9e9";
  ctx.fillText(`${text} ${dots}`, BOOT.message.x, BOOT.message.baseline);
  ctx.restore();
}

// The "connecting" window, as photographed on the real unit (the photo is about 1600 px wide for the 800 px
// screen, so every number below is half of what was measured on it): a cream window with rounded corners,
// a ring of blue dots on the left whose size decreases against the direction of rotation, and the message
// in three dark grey lines on the right.
const WINDOW = { x: 162, y: 142, w: 475, h: 212, radius: 8, fill: "#f0ede4" };
const SPINNER = { x: 269, y: 251, ring: 44, dots: 8, color: "#2f6fb0", big: 9.5, small: 2.5 };
const MESSAGE = { x: 487, baselines: [233, 263, 292], font: "25px Arial, Helvetica, sans-serif", color: "#434b54" };
function messageLines() {
  return tr(["Espera mientras nos", "conectamos al", "Expansion Module"], ["Please wait while we", "connect to the", "expansion module"]);
}
function paintConnectingWindow(ctx, W, H, time) {
  const k = W / 800,
    { x, y, w, h, radius: r } = WINDOW;
  ctx.save();
  ctx.scale(k, k);
  ctx.fillStyle = WINDOW.fill;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
  // Ring of dots, the head one the biggest.
  ctx.fillStyle = SPINNER.color;
  const head = (time * 3.2) % SPINNER.dots;
  for (let n = 0; n < SPINNER.dots; n++) {
    const a = (n / SPINNER.dots) * Math.PI * 2 - Math.PI / 2,
      behind = ((head - n + SPINNER.dots) % SPINNER.dots) / SPINNER.dots,
      dot = SPINNER.small + (SPINNER.big - SPINNER.small) * Math.pow(1 - behind, 1.6);
    ctx.beginPath();
    ctx.arc(SPINNER.x + Math.cos(a) * SPINNER.ring, SPINNER.y + Math.sin(a) * SPINNER.ring, dot, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = MESSAGE.color;
  ctx.font = MESSAGE.font;
  ctx.textAlign = "center";
  messageLines().forEach((line, n) => ctx.fillText(line, MESSAGE.x, MESSAGE.baselines[n]));
  ctx.restore();
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
