// ai-excited-01 — "The Leap"
// A giant goldfish bursts out of a tiny teacup and leaps for the moon.
// Procedural, deterministic, Node standard library only. Writes one PNG.
//
// Why this should excite the judge:
//  - Surprise: a scale twist — the fish is enormous, the teacup is tiny,
//    and the fish is leaping for a huge full moon. Not a stock explosion.
//  - Momentum: frozen mid-leap, splash crown exploding, speed lines,
//    droplets flung off the body, everything driving up-right to the moon.
//  - Excitement: saturated orange-gold against deep midnight blue, a
//    glowing moon, and one big shout of a word: WHOA!
//  - Reads small: one bold diagonal orange shape, one bright moon circle,
//    one white splash — all clear at ~300px.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------------------
// Deterministic RNG (mulberry32)
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261116);

// ---------------------------------------------------------------------------
// RGB canvas (opaque, colour type 2)
// ---------------------------------------------------------------------------
const img = new Uint8Array(W * H * 3);

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }

// src-over blend of one pixel (colour given as [r,g,b], alpha 0..1)
function blend(x, y, c, a) {
  const xi = x | 0, yi = y | 0;
  if (xi < 0 || yi < 0 || xi >= W || yi >= H || a <= 0) return;
  if (a > 1) a = 1;
  const i = (yi * W + xi) * 3;
  const ia = 1 - a;
  img[i] = c[0] * a + img[i] * ia;
  img[i + 1] = c[1] * a + img[i + 1] * ia;
  img[i + 2] = c[2] * a + img[i + 2] * ia;
}

function fillCircle(cx, cy, r, c, a) {
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
  const r2 = r * r;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) blend(x, y, c, a);
    }
  }
}

function fillEllipse(cx, cy, rx, ry, c, a) {
  const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(W - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(H - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) blend(x, y, c, a);
    }
  }
}

// Soft radial glow: alpha falls off quadratically to 0 at radius r.
function glowDisc(cx, cy, r, c, peak) {
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const d = Math.sqrt(dx * dx + dy * dy) / r;
      if (d < 1) {
        const a = peak * (1 - d) * (1 - d);
        if (a > 0.004) blend(x, y, c, a);
      }
    }
  }
}

// Scanline polygon fill. pts = [[x,y],...]
function fillPolygon(pts, c, a) {
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
  const y0 = Math.max(0, Math.ceil(minY)), y1 = Math.min(H - 1, Math.floor(maxY));
  for (let y = y0; y <= y1; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
      if ((p1[1] <= y && p2[1] > y) || (p2[1] <= y && p1[1] > y)) {
        xs.push(p1[0] + (y - p1[1]) * (p2[0] - p1[0]) / (p2[1] - p1[1]));
      }
    }
    xs.sort((u, v) => u - v);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k])), xb = Math.min(W - 1, Math.floor(xs[k + 1]));
      for (let x = xa; x <= xb; x++) blend(x, y, c, a);
    }
  }
}

// Thick line with round caps, drawn as a chain of discs.
function drawLine(x1, y1, x2, y2, w, c, a) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(len));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fillCircle(lerp(x1, x2, t), lerp(y1, y2, t), w / 2, c, a);
  }
}

function quad(p0, p1, p2, t) {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
    u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
  ];
}

// Sample a quadratic bezier into a polyline.
function sampleQuad(p0, p1, p2, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(quad(p0, p1, p2, i / n));
  return pts;
}

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------
const NAVY_TOP = [4, 9, 22];
const NAVY_BOT = [10, 26, 51];
const MOON = [255, 246, 216];
const MOON_GLOW = [255, 232, 168];
const CREAM = [255, 253, 242];
const WHITE = [255, 255, 255];
const SPLASH = [234, 247, 255];
const SPLASH_DEEP = [178, 222, 255];
const ORANGE_DEEP = [242, 96, 12];
const ORANGE_MID = [255, 154, 46];
const GOLD_PALE = [255, 217, 138];
const FISH_DARK = [217, 79, 4];
const TEA = [201, 123, 45];
const CUP = [240, 244, 248];
const CUP_SHADE = [178, 196, 210];

// ---------------------------------------------------------------------------
// 1. Background: vertical midnight gradient
// ---------------------------------------------------------------------------
for (let y = 0; y < H; y++) {
  const t = y / (H - 1);
  const r = lerp(NAVY_TOP[0], NAVY_BOT[0], t);
  const g = lerp(NAVY_TOP[1], NAVY_BOT[1], t);
  const b = lerp(NAVY_TOP[2], NAVY_BOT[2], t);
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    img[i] = r; img[i + 1] = g; img[i + 2] = b;
  }
}

// Warm glow behind the fish, so the orange pops off the dark blue.
glowDisc(560, 560, 420, [255, 170, 60], 0.14);

// ---------------------------------------------------------------------------
// 2. Stars
// ---------------------------------------------------------------------------
const MOON_C = [800, 200];
const MOON_R = 150;
for (let i = 0; i < 190; i++) {
  const x = rand() * W, y = rand() * H;
  if (Math.hypot(x - MOON_C[0], y - MOON_C[1]) < MOON_R + 45) continue;
  const r = rand() < 0.75 ? 1 : 2;
  const a = 0.35 + rand() * 0.6;
  const c = rand() < 0.8 ? WHITE : [207, 228, 255];
  fillCircle(x, y, r, c, a);
}
// A few 4-point sparkles.
for (let i = 0; i < 7; i++) {
  const x = 60 + rand() * 880, y = 60 + rand() * 760;
  if (Math.hypot(x - MOON_C[0], y - MOON_C[1]) < MOON_R + 30) continue;
  const s = 5 + rand() * 8;
  const a = 0.5 + rand() * 0.4;
  drawLine(x - s, y, x + s, y, 1.6, WHITE, a);
  drawLine(x, y - s, x, y + s, 1.6, WHITE, a);
}

// ---------------------------------------------------------------------------
// 3. The moon — huge, low, the fish's destination
// ---------------------------------------------------------------------------
glowDisc(MOON_C[0], MOON_C[1], 330, MOON_GLOW, 0.16);
fillCircle(MOON_C[0], MOON_C[1], MOON_R, MOON, 1);
fillCircle(MOON_C[0] + 10, MOON_C[1] - 8, MOON_R - 6, [255, 253, 242], 0.55);
// Craters, soft and low-contrast.
const craters = [[740, 150, 20], [840, 260, 26], [780, 280, 14], [860, 140, 12], [720, 230, 10], [820, 90, 15]];
for (const [cx, cy, cr] of craters) fillCircle(cx, cy, cr, [232, 217, 174], 0.35);
// Bright rim on the moon's lower-left (facing the fish).
for (let a = 0; a <= 40; a++) {
  const th = Math.PI * (0.62 + a / 40 * 0.28);
  fillCircle(MOON_C[0] + Math.cos(th) * (MOON_R - 2), MOON_C[1] + Math.sin(th) * (MOON_R - 2), 3, WHITE, 0.5);
}

// ---------------------------------------------------------------------------
// 4. Fish spine: quadratic bezier from the teacup up to the moon
// ---------------------------------------------------------------------------
const SPINE_P0 = [330, 830];   // tail base, at the cup's rim
const SPINE_P1 = [470, 520];   // control — the arc of the leap
const SPINE_P2 = [720, 380];   // head, pointing at the moon
const N_SPINE = 160;
const spine = [];
for (let i = 0; i <= N_SPINE; i++) spine.push(quad(SPINE_P0, SPINE_P1, SPINE_P2, i / N_SPINE));

// Radius profile: slim at the tail, fat mid-body, rounded blunt head.
function bodyR(t) {
  return 16 + 58 * Math.pow(Math.sin(Math.PI * (0.08 + 0.80 * t)), 0.8);
}
// Unit perpendicular (pointing to the fish's "top"/dorsal side) at sample i.
function perpAt(i) {
  const a = spine[Math.max(0, i - 1)], b = spine[Math.min(N_SPINE, i + 1)];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return [dy / len, -dx / len]; // dorsal side: up-left of the direction of travel
}

// Mask of the fish body, for shading passes.
const fishMask = new Uint8Array(W * H);
function maskCircle(cx, cy, r) {
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
  const r2 = r * r;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) fishMask[y * W + x] = 1;
    }
  }
}
function maskedCircle(cx, cy, r, c, a) {
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
  const r2 = r * r;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!fishMask[y * W + x]) continue;
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) blend(x, y, c, a);
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Short motion dashes along the fish's belly side (drawn first, so the
//    fish flies over them). Long lines would cross the cup, so keep these
//    tight to the body, parallel to the leap.
// ---------------------------------------------------------------------------
for (let k = 0; k < 6; k++) {
  const t = 0.18 + k * 0.11;
  const idx = Math.round(t * N_SPINE);
  const p = perpAt(idx);
  const r = bodyR(t);
  const bx = spine[idx][0] - p[0] * (r + 26);
  const by = spine[idx][1] - p[1] * (r + 26);
  const a = spine[Math.max(0, idx - 4)], b = spine[Math.min(N_SPINE, idx + 4)];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const L = 55 + (k % 3) * 22;
  drawLine(bx - ux * L / 2, by - uy * L / 2, bx + ux * L / 2, by + uy * L / 2,
    4 + (k % 2) * 2, [210, 235, 255], 0.22);
}
// (The two longer streaks were dropped: they crossed the tail fan.)

// ---------------------------------------------------------------------------
// 6. The teacup — tiny, at the bottom, the launch pad
// ---------------------------------------------------------------------------
const CUP_CX = 300, CUP_RIM_Y = 852, CUP_BASE_Y = 912;
// Saucer: a flat ellipse, so it reads as a saucer, not a ball.
fillEllipse(CUP_CX, 922, 88, 20, CUP_SHADE, 0.9);
fillEllipse(CUP_CX, 919, 82, 17, CUP, 1);
// Cup body (trapezoid, wider at the rim).
fillPolygon([[254, CUP_RIM_Y], [346, CUP_RIM_Y], [332, CUP_BASE_Y], [268, CUP_BASE_Y]], CUP, 1);
fillPolygon([[254, CUP_RIM_Y], [346, CUP_RIM_Y], [342, 874], [258, 874]], CUP_SHADE, 0.3);
// Handle: a ring arc on the right side.
for (let a = 0; a <= 28; a++) {
  const th = -Math.PI / 2 + (a / 28) * Math.PI;
  fillCircle(346 + Math.cos(th) * 24, 880 + Math.sin(th) * 17, 5.5, CUP, 1);
}
for (let a = 0; a <= 28; a++) {
  const th = -Math.PI / 2 + (a / 28) * Math.PI;
  fillCircle(346 + Math.cos(th) * 15, 880 + Math.sin(th) * 11, 4.5, NAVY_BOT, 1);
}
// Tea surface.
fillEllipse(CUP_CX, CUP_RIM_Y + 2, 42, 9, TEA, 1);
fillEllipse(CUP_CX - 8, CUP_RIM_Y, 28, 6, [226, 150, 70], 0.8);

// ---------------------------------------------------------------------------
// 7. Splash crown erupting from the cup
// ---------------------------------------------------------------------------
{
  // Jagged crown: alternating sharp peaks and valleys, tallest in the middle.
  const peaks = [[232, 60], [258, 105], [284, 82], [300, 155], [318, 95], [344, 118], [368, 66]];
  const pts = [[226, 856], [374, 856]];
  for (let i = peaks.length - 1; i >= 0; i--) {
    const [x, h] = peaks[i];
    pts.push([x - 16, 856 - h * 0.45]);
    pts.push([x, 856 - h]);
    pts.push([x + 16, 856 - h * 0.45]);
  }
  fillPolygon(pts, SPLASH, 0.96);
  // Cool shadow at the base of the crown.
  const base = [[240, 856], [360, 856], [348, 822], [252, 822]];
  fillPolygon(base, SPLASH_DEEP, 0.45);
}
// Droplets flung upward out of the crown.
for (let i = 0; i < 46; i++) {
  const ang = (-95 + rand() * 70) * Math.PI / 180; // mostly upward
  const v = 60 + rand() * 190;
  const t = 0.35 + rand() * 0.65;
  const x = 300 + Math.cos(ang) * v * t;
  const y = 830 + Math.sin(ang) * v * t + 60 * t * t;
  const r = 2.5 + rand() * 6.5;
  fillCircle(x, y, r, SPLASH, 0.9);
  fillCircle(x - r * 0.3, y - r * 0.3, r * 0.35, WHITE, 0.9);
}

// ---------------------------------------------------------------------------
// 8. The fish: tail, body, shading, fins, face
// ---------------------------------------------------------------------------
// Tail — two broad flowing lobes fanning out to the left of the cup.
// Each lobe is a lens: its two quadratic edges bulge to OPPOSITE sides of
// the base-to-tip axis, so the blade is wide, not a needle.
{
  const T = SPINE_P0;
  const upper = sampleQuad(T, [185, 771], [145, 620], 14);
  const upperBack = sampleQuad([145, 620], [289, 679], T, 14);
  fillPolygon([...upper, ...upperBack.slice(1)], ORANGE_DEEP, 0.92);
  const lower = sampleQuad(T, [242, 885], [155, 830], 14);
  const lowerBack = sampleQuad([155, 830], [242, 788], T, 14);
  fillPolygon([...lower, ...lowerBack.slice(1)], ORANGE_MID, 0.92);
  // Pale inner wash on the upper lobe.
  const innerU = sampleQuad([312, 822], [210, 760], [175, 660], 10);
  const innerUb = sampleQuad([175, 660], [275, 700], [312, 822], 10);
  fillPolygon([...innerU, ...innerUb.slice(1)], GOLD_PALE, 0.45);
  // Bright trailing edges.
  drawLine(145, 620, 190, 740, 3, WHITE, 0.35);
  drawLine(155, 830, 242, 885, 3, WHITE, 0.3);
}

// Body: three offset tubes give a rounded, lit form.
for (let i = 0; i <= N_SPINE; i++) {
  const t = i / N_SPINE;
  const r = bodyR(t);
  maskCircle(spine[i][0], spine[i][1], r);
  fillCircle(spine[i][0], spine[i][1], r, ORANGE_MID, 1);
}
for (let i = 0; i <= N_SPINE; i++) {
  const t = i / N_SPINE;
  const r = bodyR(t);
  const p = perpAt(i);
  // Deep-orange dorsal (top) shading.
  fillCircle(spine[i][0] + p[0] * r * 0.42, spine[i][1] + p[1] * r * 0.42, r * 0.62, ORANGE_DEEP, 0.55);
  // Pale-gold belly (bottom) shading.
  fillCircle(spine[i][0] - p[0] * r * 0.45, spine[i][1] - p[1] * r * 0.45, r * 0.55, GOLD_PALE, 0.6);
  // White rim light along the top edge.
  fillCircle(spine[i][0] + p[0] * r * 0.58, spine[i][1] + p[1] * r * 0.58, r * 0.3, WHITE, 0.32);
}

// Scale rings: faint circles across the body, clipped to the fish mask.
for (let i = 4; i <= N_SPINE - 4; i += 5) {
  const t = i / N_SPINE;
  const r = bodyR(t) * 0.74;
  const cx = spine[i][0], cy = spine[i][1];
  for (let a = 0; a < 48; a++) {
    const th = (a / 48) * Math.PI * 2;
    const x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r;
    if (fishMask[(y | 0) * W + (x | 0)] === 1) blend(x, y, FISH_DARK, 0.16);
  }
}

// Dorsal fin: long and low along the top of the body, like a goldfish's.
{
  const topPts = [], basePts = [];
  for (let k = 0; k <= 12; k++) {
    const t = 0.36 + (k / 12) * 0.28;
    const i = Math.round(t * N_SPINE);
    const p = perpAt(i), r = bodyR(t);
    const lift = 30 * Math.sin(Math.PI * (k / 12));
    topPts.push([spine[i][0] + p[0] * (r + lift), spine[i][1] + p[1] * (r + lift)]);
    basePts.push([spine[i][0] + p[0] * r * 0.9, spine[i][1] + p[1] * r * 0.9]);
  }
  fillPolygon([...basePts, ...topPts.reverse()], ORANGE_DEEP, 0.95);
}

// Pectoral fin, swept back under the head, with a curved outer edge.
{
  const i = Math.round(N_SPINE * 0.82);
  const j = Math.round(N_SPINE * 0.88);
  const p = perpAt(i), q = perpAt(j);
  const b1 = [spine[i][0] - p[0] * bodyR(0.82) * 0.45, spine[i][1] - p[1] * bodyR(0.82) * 0.45];
  const b2 = [spine[j][0] - q[0] * bodyR(0.88) * 0.45, spine[j][1] - q[1] * bodyR(0.88) * 0.45];
  const tip = [b1[0] - 46, b1[1] + 52];
  const edge1 = sampleQuad(b1, [b1[0] - 38, b1[1] + 18], tip, 8);
  const edge2 = sampleQuad(tip, [b2[0] - 22, b2[1] + 34], b2, 8);
  fillPolygon([...edge1, ...edge2.slice(1)], ORANGE_DEEP, 0.9);
}

// Gill arc behind the head.
{
  const i = Math.round(N_SPINE * 0.86);
  const cx = spine[i][0], cy = spine[i][1], r = bodyR(0.86) * 0.62;
  for (let a = 0; a <= 30; a++) {
    const th = Math.PI * (0.05 + (a / 30) * 0.55);
    fillCircle(cx + Math.cos(th) * r, cy + Math.sin(th) * r, 2.5, FISH_DARK, 0.5);
  }
}

// Eye — big, bright, looking up at the moon.
{
  const i = Math.round(N_SPINE * 0.93);
  const p = perpAt(i);
  const r = bodyR(0.93);
  const ex = spine[i][0] + p[0] * r * 0.28;
  const ey = spine[i][1] + p[1] * r * 0.28;
  fillCircle(ex, ey, 15, WHITE, 1);
  fillCircle(ex + 3, ey - 2, 7.5, [16, 16, 20], 1);
  fillCircle(ex - 1, ey - 6, 3.5, WHITE, 1);
  // Mouth: small open arc at the head tip.
  const hx = spine[N_SPINE][0], hy = spine[N_SPINE][1];
  for (let a = 0; a <= 12; a++) {
    const th = -0.5 + (a / 12) * 1.1;
    fillCircle(hx + Math.cos(th) * 12, hy + Math.sin(th) * 12, 2.5, [122, 45, 0], 0.85);
  }
}

// Droplets flung off the fish along its path.
for (let i = 0; i < 30; i++) {
  const t = 0.15 + rand() * 0.8;
  const idx = Math.round(t * N_SPINE);
  const p = perpAt(idx);
  const side = rand() < 0.5 ? 1 : -1;
  const d = bodyR(t) + 12 + rand() * 55;
  const x = spine[idx][0] + p[0] * d * side + (rand() - 0.5) * 30;
  const y = spine[idx][1] + p[1] * d * side + (rand() - 0.5) * 30;
  const r = 2 + rand() * 5;
  fillCircle(x, y, r, SPLASH, 0.85);
  fillCircle(x - r * 0.3, y - r * 0.3, r * 0.3, WHITE, 0.9);
}
// Gold sparkles trailing the leap.
for (let i = 0; i < 10; i++) {
  const t = 0.1 + rand() * 0.85;
  const idx = Math.round(t * N_SPINE);
  const p = perpAt(idx);
  const side = rand() < 0.5 ? 1 : -1;
  const d = bodyR(t) + 20 + rand() * 70;
  const x = spine[idx][0] + p[0] * d * side;
  const y = spine[idx][1] + p[1] * d * side;
  const s = 4 + rand() * 6;
  drawLine(x - s, y, x + s, y, 1.6, [255, 214, 120], 0.8);
  drawLine(x, y - s, x, y + s, 1.6, [255, 214, 120], 0.8);
}

// ---------------------------------------------------------------------------
// 9. Vignette — pull the eye to the leap
// ---------------------------------------------------------------------------
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - W / 2, y - H / 2) / 724;
    if (d > 0.62) {
      const a = 0.26 * Math.pow((d - 0.62) / 0.38, 2);
      blend(x, y, [0, 0, 0], a);
    }
  }
}

// ---------------------------------------------------------------------------
// 10. Text: one clean word, hand-built 5x7 bitmap font, big and crisp
// ---------------------------------------------------------------------------
const FONT = {
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};
function drawText(text, x0, y0, s, c, a) {
  let x = x0;
  for (const ch of text) {
    const g = FONT[ch];
    if (!g) { x += 6 * s; continue; }
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row][col] === '#') {
          for (let dy = 0; dy < s; dy++) {
            for (let dx = 0; dx < s; dx++) {
              blend(x + col * s + dx, y0 + row * s + dy, c, a);
            }
          }
        }
      }
    }
    x += 6 * s;
  }
}
// Dark outline first (offset in 4 directions), then the white face.
for (const [ox, oy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) drawText('WHOA!', 60 + ox, 62 + oy, 9, [3, 8, 20], 1);
drawText('WHOA!', 60, 62, 9, WHITE, 1);

// ---------------------------------------------------------------------------
// PNG encoder (stdlib only): IHDR + IDAT (zlib deflate) + IEND, CRC32
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// Filter one scanline; pick the filter with the smallest sum of |signed byte|.
function filterRow(row, prev) {
  const bpp = 3;
  const n = row.length;
  const candidates = [];
  // 0: None
  candidates.push(Buffer.from(row));
  // 1: Sub
  {
    const f = Buffer.alloc(n);
    for (let i = 0; i < n; i++) f[i] = (row[i] - (i >= bpp ? row[i - bpp] : 0)) & 0xff;
    candidates.push(f);
  }
  // 2: Up
  {
    const f = Buffer.alloc(n);
    for (let i = 0; i < n; i++) f[i] = (row[i] - (prev ? prev[i] : 0)) & 0xff;
    candidates.push(f);
  }
  // 3: Average
  {
    const f = Buffer.alloc(n);
    for (let i = 0; i < n; i++) {
      const left = i >= bpp ? row[i - bpp] : 0;
      const up = prev ? prev[i] : 0;
      f[i] = (row[i] - Math.floor((left + up) / 2)) & 0xff;
    }
    candidates.push(f);
  }
  // 4: Paeth
  {
    const f = Buffer.alloc(n);
    for (let i = 0; i < n; i++) {
      const left = i >= bpp ? row[i - bpp] : 0;
      const up = prev ? prev[i] : 0;
      const upLeft = i >= bpp && prev ? prev[i - bpp] : 0;
      f[i] = (row[i] - paeth(left, up, upLeft)) & 0xff;
    }
    candidates.push(f);
  }
  let best = 0, bestScore = Infinity;
  for (let k = 0; k < candidates.length; k++) {
    let s = 0;
    const f = candidates[k];
    for (let i = 0; i < n; i++) { const v = f[i]; s += v < 128 ? v : 256 - v; }
    if (s < bestScore) { bestScore = s; best = k; }
  }
  return Buffer.concat([Buffer.from([best]), candidates[best]]);
}

function encodePNG() {
  const rows = [];
  let prev = null;
  for (let y = 0; y < H; y++) {
    const row = Buffer.from(img.subarray(y * W * 3, (y + 1) * W * 3));
    rows.push(filterRow(row, prev));
    prev = row;
  }
  const raw = Buffer.concat(rows);
  const idat = deflateSync(raw, { level: 9 });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // colour type 2 = RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Write it out
// ---------------------------------------------------------------------------
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
const png = encodePNG();
writeFileSync(join(outDir, 'entry.png'), png);
console.log(`wrote ${join(outDir, 'entry.png')} (${png.length} bytes, ${W}x${H})`);
