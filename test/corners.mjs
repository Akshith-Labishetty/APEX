import './dom-stub.mjs';
import { Track } from '../src/track.js';

const track = new Track({ add() {}, remove() {} });
let maxC = 0, maxI = 0;
const corners = [];
let inCorner = false, start = 0, peak = 0, peakI = 0;
for (let i = 0; i < track.n; i++) {
  const c = track.curv[i];
  if (Math.abs(c) > 0.004) {
    if (!inCorner) { inCorner = true; start = i; peak = 0; }
    if (Math.abs(c) > Math.abs(peak)) { peak = c; peakI = i; }
  } else if (inCorner) {
    inCorner = false;
    corners.push({ start, peak, peakI, radius: 1 / Math.abs(peak) });
  }
  if (Math.abs(c) > Math.abs(maxC)) { maxC = c; maxI = i; }
}
console.log(`tightest: R=${(1 / Math.abs(maxC)).toFixed(1)} m at d=${(maxI * track.ds).toFixed(0)} (curv=${maxC.toFixed(4)})`);
console.log(`corners found: ${corners.length}`);
for (const c of corners) {
  console.log(`  d=${(c.start * track.ds).toFixed(0).padStart(4)}  R=${c.radius.toFixed(0).padStart(4)} m  ${(c.peak > 0 ? 'RIGHT' : 'LEFT ')}  vMax=${Math.sqrt(32 / Math.abs(c.peak)).toFixed(0)} m/s (${(Math.sqrt(32 / Math.abs(c.peak)) * 3.6).toFixed(0)} km/h)`);
}
