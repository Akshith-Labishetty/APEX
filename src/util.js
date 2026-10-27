// Small shared helpers.
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function damp(a, b, k, dt) { return lerp(a, b, 1 - Math.exp(-k * dt)); }

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// 1:23.456 style
export function formatTime(ms) {
  if (ms == null || !isFinite(ms) || ms <= 0) return '--:--.---';
  const total = Math.floor(ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const t = total % 1000;
  return `${m}:${String(s).padStart(2, '0')}.${String(t).padStart(3, '0')}`;
}

export function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
