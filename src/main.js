import * as THREE from "three";
import { makeCards, CARD_ASPECT } from "./cards.js";
import { cardVert, cardFrag, lensVert, lensFrag } from "./shader.js";
import { buildPanel } from "./panel.js";

// ---- every tunable; the side panel edits these live ----
export const DEFAULTS = {
  vertical: 1,        // 1 = scroll top to bottom, 0 = left to right
  // layout (flat row, before the lens). "along" = the scroll axis, "across" = the other one
  cardHeight: 0.565,  // centre card max size across, fraction of the viewport
  cardMaxW: 0.37,     // centre card max size along, fraction of the viewport
  spacing: 0.57,      // centre-to-neighbour distance, fraction of the viewport along
  sideScale: 0.79,    // neighbour card size relative to the centre card
  lift: 0,            // offset across the scroll axis, fraction of the viewport
  farPush: 1.35,      // how fast cards beyond the sides slide away
  fadeStart: 1.51,
  fadeEnd: 2.2,
  radius: 0.066,      // corner radius, fraction of card height
  edgeLight: 0.065,
  // lens (screen space)
  lensStart: 0.785,   // where the lens begins, 0 centre .. 1 screen edge
  reach: 0.945,       // how far out the edge pulls content from (1 = screen edge)
  stretch: 3.75,      // smear curve toward the edge
  fill: 1,            // 1 = the nearest card edge always smears out to the screen edge
  flare: 0.11,
  flareShape: 2.3,
  flareReach: 3.15,
  // look
  split: 0.013,
  blur: 4.6,
  smear: 0.28,
  sat: 0.67,
  bright: 0.47,
  // rim
  rimGlow: 1.31,
  rimWidth: 0.02,
  rimHue: 52,
  hueSpread: 0.61,
  rimWhite: 0.48,
  halo: 0.86,
  haloSize: 0.8,
  // motion
  stiffness: 7,
  dragFollow: 34,
  motionBlur: 1.81,
  wheel: 1,
  drag: 1,
  flick: 1,
  autoplay: 0,        // seconds per card, 0 = off
  // scene
  bg: "#f2f2f2",
};

const STORE = "stretch-carousel";
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORE) || "{}"); } catch { saved = {}; }
export const P = { ...DEFAULTS };
for (const k in saved) if (k in DEFAULTS) P[k] = saved[k];
export function persist() {
  try { localStorage.setItem(STORE, JSON.stringify(P)); } catch { /* storage off */ }
}

// ---- renderer ----
const stage = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
const dpr = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(dpr);
stage.appendChild(renderer.domElement);
const canvas = renderer.domElement;

// pass 1: flat row, ortho camera where 1 unit = 1 css px
const rowScene = new THREE.Scene();
const rowCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
const fbo = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });

const textures = makeCards(renderer);
const N = textures.length;
const plane = new THREE.PlaneGeometry(1, 1);
const cards = textures.map((tex) => {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: tex }, uSize: { value: new THREE.Vector2(1, 1) },
      uRadius: { value: 0 }, uEdgeLight: { value: 0 }, uFade: { value: 1 },
    },
    vertexShader: cardVert, fragmentShader: cardFrag,
    transparent: true, depthTest: false, depthWrite: false,
  });
  const mesh = new THREE.Mesh(plane, mat);
  rowScene.add(mesh);
  return { mesh, u: mat.uniforms };
});

// pass 2: the lens over the whole frame
const LENS_MAP = {
  uStart: "lensStart", uReach: "reach", uStretch: "stretch", uFill: "fill",
  uFlare: "flare", uFlareShape: "flareShape", uFlareReach: "flareReach",
  uSplit: "split", uBlur: "blur", uSmear: "smear", uSat: "sat", uBright: "bright",
  uRimGlow: "rimGlow", uRimWidth: "rimWidth", uRimHue: "rimHue", uHueSpread: "hueSpread",
  uRimWhite: "rimWhite", uHalo: "halo", uHaloSize: "haloSize",
};
const lensU = {
  tScene: { value: fbo.texture }, uBg: { value: new THREE.Color() },
  uRes: { value: new THREE.Vector2() }, uDpr: { value: dpr },
  uCenterY: { value: 0.5 }, uMB: { value: 0 }, uVertical: { value: 1 },
};
for (const k in LENS_MAP) lensU[k] = { value: 0 };
const lensScene = new THREE.Scene();
const lensCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const lensMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({ uniforms: lensU, vertexShader: lensVert, fragmentShader: lensFrag, depthTest: false, depthWrite: false }),
);
lensMesh.frustumCulled = false;
lensScene.add(lensMesh);

// ---- layout ----
let W = 1, H = 1;
function resize() {
  W = stage.clientWidth || innerWidth;
  H = stage.clientHeight || innerHeight;
  renderer.setSize(W, H, false);
  fbo.setSize(Math.round(W * dpr), Math.round(H * dpr));  // device px, or it goes soft
  Object.assign(rowCam, { left: -W / 2, right: W / 2, top: H / 2, bottom: -H / 2 });
  rowCam.updateProjectionMatrix();
  lensU.uRes.value.set(W * dpr, H * dpr);
}
new ResizeObserver(resize).observe(stage);
resize();

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / Math.max(1e-4, b - a))); return t * t * (3 - 2 * t); };
const wrap = (x) => ((x % N) + N) % N;

const isV = () => P.vertical > 0.5;

function place(t, c, cardW, cardH, spacing) {
  const at = Math.abs(t), s = Math.sign(t);
  const d = at <= 1 ? t * spacing : s * (spacing + (at - 1) * spacing * P.farPush);
  const scale = 1 - (1 - P.sideScale) * Math.min(at, 1);
  const w = cardW * scale, h = cardH * scale;
  // vertical: the next card sits below; horizontal: to the right
  if (isV()) c.mesh.position.set(P.lift * W, -d, 0);
  else c.mesh.position.set(d, P.lift * H, 0);
  c.mesh.scale.set(w, h, 1);
  c.u.uSize.value.set(w, h);
  c.u.uRadius.value = P.radius * h;
  c.u.uEdgeLight.value = P.edgeLight;
  c.u.uFade.value = 1 - smooth(P.fadeStart, P.fadeEnd, at);
  c.mesh.visible = c.u.uFade.value > 0.001;
  c.mesh.renderOrder = -Math.round(at * 100);         // centre card on top
}

// ---- motion: a float index springs toward an integer target ----
let cur = 0, target = 0, speed = 0, dragging = false, lastInput = 0;
let last = performance.now(), autoT = 0;
// ?pos=0.5 holds the row between cards (handy for checking transitions)
const pos = parseFloat(new URLSearchParams(location.search).get("pos"));
if (Number.isFinite(pos)) cur = target = pos;
const bgCol = new THREE.Color();
const hint = document.querySelector(".hint");

function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;

  // autoplay steps forward when nobody has touched it for a moment
  if (P.autoplay > 0 && !dragging && now - lastInput > 1500) {
    autoT += dt;
    if (autoT >= P.autoplay) { autoT = 0; target = Math.round(target) + 1; }
  } else autoT = 0;

  const prev = cur;
  const k = dragging ? P.dragFollow : P.stiffness;
  cur += (target - cur) * (1 - Math.exp(-dt * k));
  if (!dragging && Math.abs(target - cur) < 1e-4) cur = target;
  const v = Math.abs(cur - prev) / dt;
  speed += (Math.min(v * 0.12, 1.5) - speed) * (1 - Math.exp(-dt * 12));

  const V = isV();
  const L = V ? H : W;                                  // length along the scroll axis
  const cardH = V
    ? Math.min(H * P.cardMaxW, (W * P.cardHeight) / CARD_ASPECT)
    : Math.min(H * P.cardHeight, (W * P.cardMaxW) / CARD_ASPECT);
  const cardW = cardH * CARD_ASPECT;
  const spacing = Math.max(L * P.spacing, (V ? cardH : cardW) * 0.6);
  hint.textContent = V ? "Drag, scroll or use ↑ ↓" : "Drag, scroll or use ← →";
  for (let i = 0; i < N; i++) {
    let t = wrap(i - cur);
    if (t >= N / 2) t -= N;
    place(t, cards[i], cardW, cardH, spacing);
  }

  for (const key in LENS_MAP) lensU[key].value = P[LENS_MAP[key]];
  lensU.uCenterY.value = 0.5 + P.lift;
  lensU.uVertical.value = V ? 1 : 0;
  lensU.uMB.value = P.motionBlur * speed * 0.02;
  lensU.uBg.value.set(P.bg);
  bgCol.set(P.bg);
  document.body.style.background = P.bg;

  renderer.setRenderTarget(fbo);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(rowScene, rowCam);
  renderer.setRenderTarget(null);
  renderer.setClearColor(bgCol, 1);
  renderer.render(lensScene, lensCam);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- input ----
const go = (n) => { target = Math.round(target) + n; lastInput = performance.now(); };
const pxPerCard = () => Math.max(120, (isV() ? H : W) * P.spacing * 0.9);
const along = (e) => (isV() ? e.clientY : e.clientX);  // pointer position on the scroll axis
let startX = 0, startT = 0, lastX = 0, lastT = 0, vel = 0, travel = 0;

canvas.addEventListener("pointerdown", (e) => {
  dragging = true; travel = 0; vel = 0; lastInput = performance.now();
  startX = lastX = along(e); lastT = e.timeStamp; startT = target;
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add("grabbing");
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const p = along(e), dx = p - startX;
  travel = Math.max(travel, Math.abs(dx));
  target = startT - (dx * P.drag) / pxPerCard();
  const dt = e.timeStamp - lastT;
  if (dt > 0) vel = vel * 0.6 + ((p - lastX) / dt) * 0.4;
  lastX = p; lastT = e.timeStamp;
});
const release = (e) => {
  if (!dragging) return;
  dragging = false; lastInput = performance.now();
  canvas.classList.remove("grabbing");
  if (e.timeStamp - lastT > 90) vel = 0;               // held still: no flick
  if (travel < 6) {
    const r = canvas.getBoundingClientRect();
    const fx = isV() ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
    target = Math.round(target) + (fx < 0.33 ? -1 : fx > 0.67 ? 1 : 0);
  } else {
    const flick = Math.abs(vel) < 0.25 ? 0 : Math.max(-2, Math.min(2, ((-vel * 1000) / pxPerCard()) * 0.16 * P.flick));
    target = Math.round(target + flick);
  }
};
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);

let wheelTimer = 0;
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  lastInput = performance.now();
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? H : 1;
  const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
  target += (d * P.wheel) / pxPerCard();
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => { target = Math.round(target); }, 130);
}, { passive: false });

addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); go(1); }
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); go(-1); }
  if (e.key === "g" || e.key === "G") document.body.classList.toggle("panel-open");  // G = parameters on/off
});

buildPanel(P, DEFAULTS, persist);
