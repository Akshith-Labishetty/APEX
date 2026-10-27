// Every texture in the game is generated on a canvas at load time.
import * as THREE from 'three';
import { mulberry32 } from './util.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toTexture(canvas, { rx = 1, ry = 1, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function noise(ctx, w, h, amount, alpha, rnd) {
  for (let i = 0; i < amount; i++) {
    const v = Math.floor(rnd() * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

/* ---------------- road ---------------- */
export function asphaltTexture() {
  const w = 512, h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(7);

  ctx.fillStyle = '#2f3140';
  ctx.fillRect(0, 0, w, h);
  noise(ctx, w, h, 26000, 0.16, rnd);

  // subtle darker racing groove
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0.0, 'rgba(0,0,0,0.18)');
  grad.addColorStop(0.25, 'rgba(0,0,0,0.02)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.10)');
  grad.addColorStop(0.75, 'rgba(0,0,0,0.02)');
  grad.addColorStop(1.0, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // white edge lines
  ctx.fillStyle = '#e9edf3';
  ctx.fillRect(w * 0.015, 0, w * 0.016, h);
  ctx.fillRect(w * 0.969, 0, w * 0.016, h);

  // faint seams
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const y = rnd() * h;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  return toTexture(c);
}

/* ---------------- kerbs ---------------- */
export function kerbTexture() {
  const w = 64, h = 64;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  // stripes run along the track (v axis = canvas y)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h / 2);
  ctx.fillStyle = '#f01b2c';
  ctx.fillRect(0, h / 2, w, h / 2);
  // grubby edges
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 0, w, 3);
  ctx.fillRect(0, h - 3, w, 3);
  return toTexture(c);
}

/* ---------------- painted runoff ---------------- */
export function runoffTexture() {
  const w = 128, h = 128;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(21);
  ctx.fillStyle = '#c9a04e';
  ctx.fillRect(0, 0, w, h);
  noise(ctx, w, h, 4000, 0.14, rnd);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let i = 0; i < 6; i++) ctx.fillRect(0, i * 22, w, 6);
  return toTexture(c);
}

/* ---------------- barriers ---------------- */
const SPONSORS = [
  ['VELOCE', '#e10600', '#ffffff'],
  ['APEX TYRES', '#f5a700', '#111318'],
  ['TURBOFUEL', '#00a08a', '#ffffff'],
  ['GRAND PRIX STORE', '#1f4fd8', '#ffffff'],
  ['SCUDERIA', '#14161c', '#ff5a4d'],
];

export function barrierTexture() {
  const w = 1024, h = 64;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#e8ebf0';
  ctx.fillRect(0, 0, w, h);
  // red/white top strip
  for (let i = 0; i < 32; i++) {
    ctx.fillStyle = i % 2 ? '#d81b27' : '#f4f6f9';
    ctx.fillRect(i * (w / 32), 0, w / 32, 9);
  }
  // sponsor blocks
  const n = SPONSORS.length;
  const bw = w / n;
  for (let i = 0; i < n; i++) {
    const [text, bg, fg] = SPONSORS[i];
    ctx.fillStyle = bg;
    ctx.fillRect(i * bw + 3, 12, bw - 6, h - 18);
    ctx.fillStyle = fg;
    ctx.font = 'italic 700 26px Bahnschrift, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, i * bw + bw / 2, h / 2 + 3);
  }
  // panel seams
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= n; i++) {
    ctx.beginPath(); ctx.moveTo(i * bw, 10); ctx.lineTo(i * bw, h); ctx.stroke();
  }
  return toTexture(c);
}

/* ---------------- start line ---------------- */
export function checkerTexture() {
  const w = 512, h = 64;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const cols = 16, rows = 2;
  const cw = w / cols, ch = h / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#12141a' : '#f4f6f9';
      ctx.fillRect(x * cw, y * ch, cw, ch);
    }
  }
  return toTexture(c, { ry: 1 });
}

/* ---------------- generic banner ---------------- */
export function bannerTexture(text, bg = '#14161c', fg = '#ff3b2f') {
  const w = 1024, h = 128;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, bg);
  g.addColorStop(0.5, '#20242e');
  g.addColorStop(1, bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.fillRect(0, 0, w, 8);
  ctx.fillRect(0, h - 8, w, 8);
  ctx.fillStyle = fg;
  ctx.font = 'italic 800 74px Bahnschrift, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 4);
  return toTexture(c);
}

/* ---------------- tunnel ---------------- */
export function tunnelTextures() {
  const w = 512, h = 256;
  const c = makeCanvas(w, h);
  const e = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const ect = e.getContext('2d');
  const rnd = mulberry32(5);

  ctx.fillStyle = '#5a5e66';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) {
    const v = Math.floor(rnd() * 120 + 60);
    ctx.fillStyle = `rgba(${v},${v},${v},0.10)`;
    ctx.fillRect(rnd() * w, rnd() * h, 3, 2);
  }
  // tile seams
  ctx.strokeStyle = 'rgba(0,0,0,0.30)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= w; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y <= h; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  ect.fillStyle = '#000';
  ect.fillRect(0, 0, w, h);
  // ceiling light strips (bright band near the crown of the arch)
  ect.fillStyle = '#fff6dc';
  for (let x = 10; x < w; x += 78) ect.fillRect(x, h * 0.06, 46, 10);
  ect.fillStyle = 'rgba(255,220,160,0.30)';
  for (let x = 10; x < w; x += 78) ect.fillRect(x - 8, h * 0.03, 70, 26);

  const map = toTexture(c);
  const emissive = toTexture(e);
  return { map, emissive };
}

/* ---------------- ground ---------------- */
export function groundTexture() {
  const w = 512, h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(99);
  ctx.fillStyle = '#3b3548';
  ctx.fillRect(0, 0, w, h);
  noise(ctx, w, h, 30000, 0.10, rnd);
  // city blocks / pavement
  ctx.strokeStyle = 'rgba(255,220,190,0.08)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 8; i++) {
    ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(w, i * 64); ctx.stroke();
  }
  return toTexture(c, { rx: 40, ry: 40 });
}

/* ---------------- building facades ---------------- */
export function facadeTexture(seed, base, glass) {
  const w = 128, h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const cols = 6, rows = 14;
  const cw = w / cols, ch = h / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rnd();
      ctx.fillStyle = lit > 0.72 ? glass : `rgba(10,14,22,${0.55 + rnd() * 0.35})`;
      ctx.fillRect(x * cw + 5, y * ch + 6, cw - 12, ch - 14);
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  for (let y = 0; y < rows; y++) ctx.fillRect(0, y * ch, w, 3);
  return toTexture(c, { rx: 1, ry: 1 });
}

/* ---------------- grandstand crowd ---------------- */
export function crowdTexture() {
  const w = 256, h = 128;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(4242);
  ctx.fillStyle = '#181b22';
  ctx.fillRect(0, 0, w, h);
  const rows = 12;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < 60; x++) {
      if (rnd() > 0.88) continue;
      const palette = ['#ffffff', '#ff2d55', '#ffd23f', '#3a8bff', '#22d3ee', '#a855f7', '#7bff5c', '#ff8a2b'];
      ctx.fillStyle = palette[(rnd() * palette.length) | 0];
      ctx.fillRect(x * 4 + rnd() * 1.5, y * (h / rows) + 2, 3, 5);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, y * (h / rows) + 8, w, 2);
  }
  return toTexture(c, { rx: 1, ry: 1 });
}

/* ---------------- misc ---------------- */
export function glowTexture() {
  const s = 64;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return toTexture(c);
}

export function grassTexture() {
  const w = 256, h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(1234);
  ctx.fillStyle = '#3f8f3f';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 8000; i++) {
    ctx.fillStyle = `rgba(${50 + rnd() * 70},${120 + rnd() * 90},${50 + rnd() * 50},0.6)`;
    ctx.fillRect(rnd() * w, rnd() * h, 2, 3);
  }
  return toTexture(c, { rx: 60, ry: 60 });
}
