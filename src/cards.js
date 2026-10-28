// widget-style cards drawn on canvas, 1024 x 1280 each
import * as THREE from "three";

const W = 1024, H = 1280;

function blobs(g, base, list) {
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  g.save();
  g.filter = "blur(110px)";
  for (const [x, y, r, c] of list) {
    g.fillStyle = c;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  // fine grain so gradients don't band
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

function title(g, a, b) {
  g.fillStyle = "rgba(255,255,255,.92)";
  g.font = "500 50px -apple-system, 'Segoe UI', system-ui, sans-serif";
  g.fillText(a, 92, 160);
  g.fillText(b, 92, 224);
}

function big(g, value, unit, y, fill) {
  g.font = "600 330px -apple-system, 'Segoe UI', system-ui, sans-serif";
  const w = g.measureText(value).width;
  g.font = "500 90px -apple-system, 'Segoe UI', system-ui, sans-serif";
  const uw = g.measureText(unit).width;
  const x = (W - w - uw - 14) / 2;
  g.font = "600 330px -apple-system, 'Segoe UI', system-ui, sans-serif";
  g.fillStyle = fill;
  g.fillText(value, x, y);
  g.font = "500 90px -apple-system, 'Segoe UI', system-ui, sans-serif";
  g.fillStyle = "rgba(255,255,255,.9)";
  g.fillText(unit, x + w + 14, y - 200);
}

function foot(g, text) {
  g.fillStyle = "rgba(255,255,255,.92)";
  g.font = "500 52px -apple-system, 'Segoe UI', system-ui, sans-serif";
  g.fillText(text, 92, H - 110);
}

function grad(g, y0, y1, a, b) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, a); gr.addColorStop(1, b);
  return gr;
}

const CARDS = [
  {
    name: "roast",
    draw(g) {
      blobs(g, "#1b1238", [[880, 300, 330, "#6a3ee0"], [230, 1000, 380, "#d98a3a"], [900, 1150, 260, "#9a3f6a"], [120, 260, 220, "#140b2a"]]);
      title(g, "Coffee roast", "Batch 27");
      big(g, "212", "°C", 760, grad(g, 480, 760, "#fff3dc", "#e7a24f"));
      for (let i = 0; i < 24; i++) {
        g.fillStyle = i < 15 ? "rgba(240,170,90,.9)" : "rgba(255,255,255,.18)";
        g.beginPath(); g.roundRect(100 + i * 35, 860, 26, 14, 5); g.fill();
      }
      g.font = "500 34px -apple-system, 'Segoe UI', system-ui, sans-serif";
      g.fillStyle = "rgba(255,255,255,.55)"; g.fillText("Drying", 100, 940);
      g.fillStyle = "rgba(255,255,255,.9)"; g.fillText("Maillard", 445, 940);
      g.fillStyle = "rgba(255,255,255,.55)"; g.fillText("Develop", 800, 940);
      foot(g, "First crack in 3:40");
    },
  },
  {
    name: "heart",
    draw(g) {
      blobs(g, "#7a1426", [[160, 600, 340, "#e0652e"], [900, 200, 300, "#d23a5a"], [800, 1100, 320, "#5a0d22"]]);
      title(g, "Heart rate", "Morning run");
      g.fillStyle = "#fff"; g.beginPath(); g.arc(104, 312, 9, 0, 7); g.fill();
      g.font = "500 30px system-ui, sans-serif"; g.fillStyle = "rgba(255,255,255,.8)"; g.fillText("Live", 126, 322);
      big(g, "148", "bpm", 760, grad(g, 480, 760, "#ffffff", "#ffd2d8"));
      g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = 4; g.beginPath();
      let x = 90; g.moveTo(x, 900);
      for (const [dx, dy] of [[160, 0], [20, -60], [20, 90], [20, -30], [130, 0], [20, -110], [20, 140], [20, -30], [200, 0], [20, -40], [20, 40], [160, 0]]) { x += dx; g.lineTo(x, 900 + dy); }
      g.stroke();
      foot(g, "Zone 4 · 38 min");
    },
  },
  {
    name: "tide",
    draw(g) {
      blobs(g, "#1f5a45", [[700, 300, 320, "#7fe0b8"], [200, 900, 340, "#2e7d63"], [850, 1100, 260, "#a8f0d4"]]);
      title(g, "Tide height", "Harbour");
      g.font = "500 30px system-ui, sans-serif";
      g.fillStyle = "rgba(255,255,255,.25)"; g.beginPath(); g.roundRect(780, 120, 150, 50, 25); g.fill();
      g.fillStyle = "#fff"; g.fillText("Offshore", 797, 155);
      big(g, "2.8", "m", 760, grad(g, 480, 760, "#ffffff", "#9ef5d0"));
      g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 4;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        for (let i = 0; i <= 840; i += 8) g.lineTo(92 + i, 920 + Math.sin(i / 90 + k) * (40 - k * 10) + k * 18);
        g.stroke();
      }
      foot(g, "High tide 16:05");
    },
  },
  {
    name: "focus",
    draw(g) {
      blobs(g, "#0b1446", [[300, 300, 320, "#2b47d6"], [900, 1150, 300, "#9fd3ff"], [800, 500, 260, "#1a2a8a"]]);
      title(g, "Deep focus", "This week");
      big(g, "18.5", "h", 700, grad(g, 420, 700, "#ffffff", "#9ec8ff"));
      const hs = [180, 230, 200, 300, 260, 120, 110];
      hs.forEach((h, i) => {
        g.fillStyle = i === 3 ? "rgba(200,225,255,.9)" : "rgba(170,200,255,.45)";
        g.beginPath(); g.roundRect(110 + i * 120, 1080 - h, 60, h, 14); g.fill();
      });
      foot(g, "Best day, Thursday");
    },
  },
  {
    name: "moon",
    draw(g) {
      blobs(g, "#2a0e5a", [[800, 250, 340, "#8b4ff0"], [200, 1000, 340, "#4b1a8a"], [600, 700, 200, "#c08bff"]]);
      title(g, "Night sky", "Moon phase");
      const mg = g.createRadialGradient(540, 470, 20, 512, 500, 170);
      mg.addColorStop(0, "#fff"); mg.addColorStop(1, "#c7a6ff");
      g.fillStyle = mg; g.beginPath(); g.arc(512, 500, 160, 0, 7); g.fill();
      g.fillStyle = "rgba(42,14,90,.85)"; g.beginPath(); g.arc(440, 500, 150, 0, 7); g.fill();
      big(g, "84", "%", 1000, grad(g, 760, 1000, "#ffffff", "#e0c8ff"));
      foot(g, "Waxing gibbous · Rises 18:42");
    },
  },
  {
    name: "solar",
    draw(g) {
      blobs(g, "#8a3a06", [[750, 250, 340, "#ffc24a"], [200, 1000, 360, "#ff6a1a"], [900, 1100, 240, "#ffe2a0"]]);
      title(g, "Solar roof", "Today");
      big(g, "31.2", "kWh", 760, grad(g, 480, 760, "#ffffff", "#ffe3a6"));
      g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = 5; g.beginPath();
      for (let i = 0; i <= 840; i += 6) g.lineTo(92 + i, 1010 - Math.exp(-Math.pow((i - 420) / 200, 2)) * 120);
      g.stroke();
      foot(g, "Peak at 13:10 · 4.8 kW");
    },
  },
];

export function makeCards(renderer) {
  return CARDS.map((c) => {
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    c.draw(cv.getContext("2d"));
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

export const CARD_ASPECT = W / H;
