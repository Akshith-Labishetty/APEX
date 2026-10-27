// HUD: timing panel, position, speedo gauge, minimap, toasts, start lights, results.
import { clamp, formatTime } from './util.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'),
      lap: $('hudLap'),
      current: $('hudCurrent'),
      last: $('hudLast'),
      best: $('hudBest'),
      delta: $('hudDelta'),
      status: $('hudStatus'),
      posWrap: $('hudTopright'),
      pos: $('hudPos'),
      posSub: $('hudPosSub'),
      gap: $('hudGap'),
      lights: $('lights'),
      toast: $('toast'),
      results: $('results'),
      resultsKicker: $('resultsKicker'),
      resultsTitle: $('resultsTitle'),
      resultsBody: $('resultsBody'),
      ers: $('ersFill'),
      gauge: $('gauge'),
      minimap: $('minimap'),
    };
    this.gctx = this.el.gauge.getContext('2d');
    this.mctx = this.el.minimap.getContext('2d');
    this.track = null;
    this.mmPath = null;
    this.toastTimer = null;
    this._lastStatus = '';
  }

  setTrack(track) {
    this.track = track;
    const b = track.bounds;
    const size = 250, pad = 26;
    const w = b.maxX - b.minX, h = b.maxZ - b.minZ;
    const scale = Math.min((size - 2 * pad) / w, (size - 2 * pad) / h);
    const ox = pad + ((size - 2 * pad) - w * scale) / 2 - b.minX * scale;
    const oz = pad + ((size - 2 * pad) - h * scale) / 2 - b.minZ * scale;
    this.mm = { scale, ox, oz, size };
    this.mmPath = track.minimapPath.map(([x, z]) => [x * scale + ox, z * scale + oz]);
    const s0 = track.samples[0];
    this.mmStart = [
      [s0.x * scale + ox, s0.z * scale + oz],
      [(s0.x + s0.rx * track.wallOffset) * scale + ox, (s0.z + s0.rz * track.wallOffset) * scale + oz],
      [(s0.x - s0.rx * track.wallOffset) * scale + ox, (s0.z - s0.rz * track.wallOffset) * scale + oz],
    ];
  }

  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }

  showPositions(v) {
    this.el.posWrap.classList.toggle('hidden', !v);
  }

  setLap(lap, total) {
    this.el.lap.textContent = total ? `${lap}/${total}` : `${lap}`;
  }

  setTimes(current, last, best, delta) {
    this.el.current.textContent = formatTime(current);
    this.el.last.textContent = formatTime(last);
    this.el.best.textContent = formatTime(best);
    const d = this.el.delta;
    if (delta == null) {
      d.textContent = '-';
      d.className = '';
    } else {
      const s = (delta / 1000).toFixed(3);
      d.textContent = (delta >= 0 ? '+' : '-') + Math.abs(s) + 's';
      d.className = delta >= 0 ? 'bad' : 'good';
    }
  }

  setStatus(text, warn = false) {
    if (text === this._lastStatus && this.el.status.classList.contains('warn') === warn) return;
    this._lastStatus = text;
    this.el.status.textContent = text;
    this.el.status.classList.toggle('warn', warn);
  }

  setErs(v) {
    const el = this.el.ers;
    el.style.width = `${Math.round(clamp(v, 0, 1) * 100)}%`;
    el.classList.toggle('low', v < 0.25);
  }

  /* ---------------- start lights ---------------- */
  showLights() { this.el.lights.classList.remove('hidden'); }
  setLights(n) {
    this.el.lights.querySelectorAll('.light').forEach((l, i) => l.classList.toggle('on', i < n));
  }
  hideLights() { this.el.lights.classList.add('hidden'); this.setLights(0); }

  /* ---------------- toast ---------------- */
  toast(text, cls = '', ms = 2400) {
    const t = this.el.toast;
    t.className = 'hidden';
    void t.offsetWidth; // restart the slide-in animation
    t.textContent = text;
    t.className = cls;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
  }

  /* ---------------- results ---------------- */
  showResults(kicker, title, rowsHtml) {
    this.el.resultsKicker.textContent = kicker;
    this.el.resultsTitle.textContent = title;
    this.el.resultsBody.innerHTML = rowsHtml;
    this.el.results.classList.remove('hidden');
  }
  hideResults() { this.el.results.classList.add('hidden'); }

  /* ---------------- gauge ---------------- */
  drawGauge({ speedKmh, rpm, gear, boost }) {
    const ctx = this.gctx;
    const W = 280, H = 200;
    ctx.clearRect(0, 0, W, H);
    const cx = 140, cy = 152, R = 108;
    const A0 = 160 * Math.PI / 180, A1 = 380 * Math.PI / 180;
    const ang = (t) => A0 + clamp(t, 0, 1) * (A1 - A0);

    // outer track
    ctx.beginPath();
    ctx.arc(cx, cy, R, A0, A1);
    ctx.lineWidth = 13;
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineCap = 'butt';
    ctx.stroke();

    // speed arc
    const maxKmh = 340;
    const t = clamp(speedKmh / maxKmh, 0, 1);
    if (t > 0.002) {
      const grad = ctx.createLinearGradient(cx - R, cy, cx + R, cy);
      grad.addColorStop(0, '#22d3ee');
      grad.addColorStop(0.55, '#7bff5c');
      grad.addColorStop(0.8, '#ffd23f');
      grad.addColorStop(1, '#ff2d55');
      ctx.beginPath();
      ctx.arc(cx, cy, R, A0, ang(t));
      ctx.lineWidth = 13;
      ctx.strokeStyle = grad;
      ctx.stroke();
    }

    // shift lights along the outside
    const segs = 12;
    for (let i = 0; i < segs; i++) {
      const s0 = 0.62 + (i / segs) * 0.38;
      const s1 = s0 + (0.38 / segs) * 0.72;
      const lit = rpm > s0;
      ctx.beginPath();
      ctx.arc(cx, cy, R + 13, ang(s0), ang(s1));
      ctx.lineWidth = 7;
      if (!lit) ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      else if (i < 5) ctx.strokeStyle = '#7bff5c';
      else if (i < 9) ctx.strokeStyle = '#ffd23f';
      else ctx.strokeStyle = boost ? '#22d3ee' : '#ff2d55';
      ctx.stroke();
    }

    // ticks
    ctx.font = '600 10px Bahnschrift, Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let v = 0; v <= maxKmh; v += 50) {
      const a = ang(v / maxKmh);
      const x0 = cx + Math.cos(a) * (R - 10), y0 = cy + Math.sin(a) * (R - 10);
      const x1 = cx + Math.cos(a) * (R - 18), y1 = cy + Math.sin(a) * (R - 18);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.stroke();
      const tx = cx + Math.cos(a) * (R - 32), ty = cy + Math.sin(a) * (R - 32);
      ctx.fillText(String(v), tx, ty);
    }

    // needle
    const a = ang(t);
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(a) * 12, cy - Math.sin(a) * 12);
    ctx.lineTo(cx + Math.cos(a) * (R - 22), cy + Math.sin(a) * (R - 22));
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#ff2d55';
    ctx.lineCap = 'round';
    ctx.stroke();

    // digital readout
    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 800 44px Bahnschrift, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(Math.max(0, speedKmh))), cx, cy - 26);
    ctx.font = '700 10px Bahnschrift, Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('KM/H', cx, cy - 4);

    // gear
    ctx.fillStyle = boost ? '#22d3ee' : '#ffffff';
    ctx.font = 'italic 800 30px Bahnschrift, Segoe UI, sans-serif';
    ctx.fillText(gear === 0 ? 'R' : String(gear), cx, cy + 26);
    ctx.font = '700 9px Bahnschrift, Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('GEAR', cx, cy + 44);
  }

  /* ---------------- minimap ---------------- */
  drawMinimap(cars, playerIndex, colors) {
    const ctx = this.mctx;
    const size = this.mm ? this.mm.size : 250;
    ctx.clearRect(0, 0, size, size);
    if (!this.mmPath) return;

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.mmPath[0][0], this.mmPath[0][1]);
    for (let i = 1; i < this.mmPath.length; i++) ctx.lineTo(this.mmPath[i][0], this.mmPath[i][1]);
    ctx.closePath();
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(34,211,238,0.28)';
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.stroke();

    // start / finish
    ctx.beginPath();
    ctx.moveTo(this.mmStart[1][0], this.mmStart[1][1]);
    ctx.lineTo(this.mmStart[2][0], this.mmStart[2][1]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ff2d55';
    ctx.stroke();

    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      const [x, y] = [c.pos.x * this.mm.scale + this.mm.ox, c.pos.y * this.mm.scale + this.mm.oz];
      const me = i === playerIndex;
      ctx.beginPath();
      ctx.arc(x, y, me ? 5.5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = colors[i];
      ctx.fill();
      if (me) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.stroke();
      }
    }
  }
}
