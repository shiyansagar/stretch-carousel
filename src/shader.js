// two passes, like the liquid-glass carousel:
//  1. cards are drawn flat into a full-screen framebuffer (premultiplied, transparent bg)
//  2. that frame goes through a screen-space lens: clear in the middle, and toward
//     the left/right edges it stretches, flares, splits colour and grows a rainbow rim.
// the lens only depends on screen position, so cards slide through it continuously.

export const cardVert = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export const cardFrag = /* glsl */ `
uniform sampler2D uMap;
uniform vec2 uSize;        // card size, px
uniform float uRadius;     // px
uniform float uEdgeLight;
uniform float uFade;
varying vec2 vUv;

float rbox(vec2 p, vec2 b, float r){
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main(){
  vec2 p = (vUv - 0.5) * uSize;
  float d = rbox(p, uSize * 0.5, uRadius);
  float aa = max(fwidth(d), 1e-4);
  float a = 1.0 - smoothstep(-aa, aa, d);
  vec3 c = texture2D(uMap, vUv).rgb;
  c += uEdgeLight * (1.0 - smoothstep(0.0, 2.5, -d));
  gl_FragColor = vec4(c, a * uFade);
  #include <colorspace_fragment>
}`;

export const lensVert = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export const lensFrag = /* glsl */ `
uniform sampler2D tScene;   // premultiplied cards, transparent background
uniform vec3 uBg;
uniform vec2 uRes;          // px
uniform float uDpr;
uniform float uCenterY;     // 0..1, centre across the scroll axis
uniform float uVertical;    // 1 = cards scroll top to bottom
uniform float uMB;          // motion blur, uv units
uniform float uStart, uReach, uStretch, uFill;
uniform float uFlare, uFlareShape, uFlareReach;
uniform float uSplit, uBlur, uSmear, uSat, uBright;
uniform float uRimGlow, uRimWidth, uRimHue, uHueSpread, uRimWhite, uHalo, uHaloSize;
varying vec2 vUv;

vec3 hue2rgb(float h){
  vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return k * k * (3.0 - 2.0 * k);
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

// where on the flat frame does this screen point look? returns uv, and e (0 centre .. 1 edge)
vec2 lensMap(vec2 uv, out float e, out float grow){
  float nx = (uv.x - 0.5) * 2.0;                     // -1..1 across the screen
  float s = sign(nx), a = abs(nx);
  e = clamp((a - uStart) / max(1.0 - uStart, 1e-3), 0.0, 1.0);
  float src = a;
  if (a > uStart) {
    // edge content is pulled from up to uReach, smeared hardest near the edge
    src = uStart + (uReach - uStart) * (1.0 - pow(1.0 - e, uStretch));
  }
  grow = 1.0 + uFlare * uFlareReach * pow(e, uFlareShape);
  float y = uCenterY + (uv.y - uCenterY) / grow;    // flare opens the image vertically
  return vec2(0.5 + s * src * 0.5, y);
}

// everything below works in "axis space": x = scroll axis, y = across it.
// vertical mode just swaps the two (the swap is its own inverse).
vec2 toA(vec2 p){ return uVertical > 0.5 ? p.yx : p; }

vec4 sceneAt(vec2 q){
  vec2 uv = toA(q);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
  return texture2D(tScene, uv);
}

// in the lens zone an empty sample walks back toward the centre until it hits a card,
// so the nearest card edge is always smeared out to the screen edge (like refraction)
// card sides are vertical, so the search runs once along the centre row for the column
vec2 fillInward(vec2 uv, float e){
  float cy = uCenterY;
  if (e <= 0.0 || sceneAt(vec2(uv.x, cy)).a > 0.5) return uv;
  float startX = 0.5 + sign(uv.x - 0.5) * uStart * 0.5;
  float lo = uv.x, hi = uv.x;
  bool hit = false;
  for (int i = 1; i <= 28; i++) {
    float x = mix(uv.x, startX, float(i) / 28.0);
    if (sceneAt(vec2(x, cy)).a > 0.5) { hi = x; hit = true; break; }
    lo = x;
  }
  if (!hit) return uv;
  for (int i = 0; i < 5; i++) {                       // refine the edge
    float m = 0.5 * (lo + hi);
    if (sceneAt(vec2(m, cy)).a > 0.5) hi = m; else lo = m;
  }
  // step a hair inside so we sample colour, not the anti-aliased border
  return vec2(hi + (startX - hi) * 0.004, uv.y);
}

void main(){
  float e, grow;
  vec2 q0 = toA(vUv);
  vec2 uv = lensMap(q0, e, grow);
  vec2 mapped = uv;
  uv = fillInward(uv, e * uFill);
  float side = sign(q0.x - 0.5);
  bool filled = uv.x != mapped.x;

  // smear + colour split along x, measured in flat-frame uv
  float spread = (uBlur * 0.004 + uSmear * 0.12) * e + uMB;
  float split = uSplit * e * 0.5 * side;
  if (filled) split = -abs(split) * side * 0.5;      // keep taps on the card
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 9; i++) {
    float o = (float(i) / 8.0 - 0.5) * spread;
    if (filled) o = -abs(o) * side - abs(split);
    vec4 r = sceneAt(uv + vec2(o + split, 0.0));
    vec4 g = sceneAt(uv + vec2(o, 0.0));
    vec4 b = sceneAt(uv + vec2(o - split, 0.0));
    acc.rgb += vec3(r.r, g.g, b.b);
    acc.a += g.a;
  }
  acc /= 9.0;
  vec3 col = acc.rgb;                                 // premultiplied
  float A = acc.a;

  // saturation / brightness push toward the edges
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, 1.0 + uSat * 1.6 * e);
  col *= 1.0 + uBright * e;

  // rim: find the card silhouette edge in screen space via vertical alpha difference
  float px = 1.0 / toA(uRes).y;
  float rw = max(uRimWidth, 0.01) * 90.0 * uDpr;
  float dyUv = rw * px / grow;                        // same on-screen width everywhere
  float aU = sceneAt(uv + vec2(0.0, dyUv)).a;
  float aD = sceneAt(uv - vec2(0.0, dyUv)).a;
  float edge = clamp(abs(aU - aD), 0.0, 1.0);
  float rimOn = smoothstep(0.0, 0.25, e);
  float distHue = (A - 0.5);
  vec3 rimCol = mix(vec3(1.0), hue2rgb(uRimHue / 360.0 + e * uHueSpread + distHue * 0.25), 1.0 - uRimWhite);
  float rim = edge * uRimGlow * rimOn;

  // halo: soft spread of the silhouette beyond the edge
  float hs = rw * max(uHaloSize, 0.05) * 4.0 * px / grow;
  float halo = 0.0, wsum = 0.0;
  for (int i = 1; i <= 4; i++) {
    float o = float(i) * hs, w = 1.0 / float(i);      // nearer samples count more
    // uv.x is already on the card edge, so straight vertical taps see the silhouette
    halo += (sceneAt(uv + vec2(0.0, o)).a + sceneAt(uv - vec2(0.0, o)).a) * w;
    wsum += 2.0 * w;
  }
  halo = clamp(halo / wsum - A, 0.0, 1.0);
  halo = halo * halo * uHalo * uRimGlow * rimOn;

  // composite over the page background
  vec3 outc = uBg * (1.0 - A) + col;
  outc += rimCol * rim * mix(1.0, 0.6, A);
  outc = mix(outc, rimCol, clamp(halo, 0.0, 1.0) * (1.0 - A));
  outc += (hash(gl_FragCoord.xy) - 0.5) / 255.0;    // dither

  gl_FragColor = vec4(outc, 1.0);
  #include <colorspace_fragment>
}`;
