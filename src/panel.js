// side panel: one slider per tunable, grouped, live-editing P

const SCHEMA = [
  ["Layout", [
    ["vertical", "Vertical scroll", 0, 1, 1],
    ["cardHeight", "Card size across", 0.2, 0.95, 0.005],
    ["cardMaxW", "Card size along", 0.15, 0.8, 0.005],
    ["spacing", "Neighbour distance", 0.2, 0.6, 0.002],
    ["sideScale", "Neighbour size", 0.3, 1, 0.01],
    ["lift", "Offset across", -0.2, 0.2, 0.002],
    ["radius", "Corner radius", 0, 0.12, 0.001],
    ["edgeLight", "Card edge light", 0, 0.4, 0.005],
    ["farPush", "Off-screen push", 0.5, 3, 0.05],
    ["fadeStart", "Fade starts", 1, 3, 0.01],
    ["fadeEnd", "Fade ends", 1.1, 3.5, 0.01],
  ]],
  ["Lens", [
    ["lensStart", "Lens starts at", 0, 0.98, 0.005],
    ["reach", "Pulls from", 0.5, 2, 0.005],
    ["stretch", "Stretch", 1, 6, 0.05],
    ["fill", "Edge fill", 0, 1, 1],
    ["flare", "Flare", 0, 1.5, 0.01],
    ["flareShape", "Flare shape", 0.5, 5, 0.05],
    ["flareReach", "Flare reach", 0.5, 5, 0.05],
  ]],
  ["Look", [
    ["split", "Colour split", 0, 0.12, 0.001],
    ["blur", "Blur", 0, 12, 0.1],
    ["smear", "Smear", 0, 0.6, 0.01],
    ["sat", "Saturation", 0, 1.5, 0.01],
    ["bright", "Edge brightness", -0.5, 1, 0.01],
  ]],
  ["Rim", [
    ["rimGlow", "Rim glow", 0, 2.5, 0.01],
    ["rimWidth", "Rim width", 0.02, 1, 0.01],
    ["rimHue", "Rim hue", 0, 360, 1, "°"],
    ["hueSpread", "Hue spread", 0, 2, 0.01],
    ["rimWhite", "Rim whiteness", 0, 1, 0.01],
    ["halo", "Outer halo", 0, 2, 0.01],
    ["haloSize", "Halo size", 0.05, 3, 0.01],
  ]],
  ["Motion", [
    ["stiffness", "Snap", 2, 30, 0.5],
    ["dragFollow", "Drag follow", 5, 60, 1],
    ["motionBlur", "Motion blur", 0, 3, 0.01],
    ["wheel", "Scroll speed", 0.2, 3, 0.05],
    ["drag", "Drag speed", 0.2, 3, 0.05],
    ["flick", "Flick strength", 0, 3, 0.05],
    ["autoplay", "Autoplay", 0, 10, 0.5, "s"],
  ]],
  ["Scene", [
    ["bg", "Background", "color"],
  ]],
];

export function buildPanel(P, DEFAULTS, persist) {
  const box = document.getElementById("controls");
  const refreshers = [];
  const changed = () => persist();

  for (const [group, rows] of SCHEMA) {
    const det = document.createElement("details");
    det.open = true;
    det.innerHTML = `<summary>${group}</summary>`;
    for (const [key, label, min, max, step, unit = ""] of rows) {
      const el = document.createElement("div");
      el.className = "row";
      if (min === "color") {
        el.innerHTML = `<label>${label}<input type="color"></label>`;
        const input = el.querySelector("input");
        const sync = () => { input.value = P[key]; };
        input.addEventListener("input", () => { P[key] = input.value; changed(); });
        sync(); refreshers.push(sync);
      } else {
        el.innerHTML = `<label>${label}<output></output></label><input type="range" min="${min}" max="${max}" step="${step}">`;
        const input = el.querySelector("input"), out = el.querySelector("output");
        const dec = step >= 1 ? 0 : step < 0.01 ? 3 : 2;
        const sync = () => { input.value = P[key]; out.textContent = Number(P[key]).toFixed(dec) + unit; };
        input.addEventListener("input", () => { P[key] = parseFloat(input.value); sync(); changed(); });
        // double-click a slider to reset just that value
        input.addEventListener("dblclick", () => { P[key] = DEFAULTS[key]; sync(); changed(); });
        sync(); refreshers.push(sync);
      }
      det.appendChild(el);
    }
    box.appendChild(det);
  }

  document.getElementById("reset").addEventListener("click", () => {
    Object.assign(P, DEFAULTS);
    refreshers.forEach((f) => f());
    changed();
  });

  const copyBtn = document.getElementById("copy");
  copyBtn.addEventListener("click", async () => {
    const text = JSON.stringify(P, null, 2);
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      t.remove();
    }
    copyBtn.textContent = "Copied";
    setTimeout(() => { copyBtn.textContent = "Copy"; }, 1200);
  });

  // the panel starts hidden; press G (handled in main.js) to show or hide it
}
