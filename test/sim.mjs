// Headless smoke test: can an AI-driven car lap the circuit?
import './dom-stub.mjs';
import { Track } from '../src/track.js';
import { Car, LIVERIES } from '../src/car.js';
import { AIDriver } from '../src/ai.js';

const scene = { add() {}, remove() {} };
const track = new Track(scene);

console.log(`track length : ${(track.length / 1000).toFixed(3)} km`);
console.log(`samples      : ${track.n}, ds = ${track.ds.toFixed(2)} m`);
console.log(`start pose   : x=${track.startPose().x.toFixed(1)} z=${track.startPose().z.toFixed(1)}`);
console.log(`tunnel range : ${track.tunnelRange[0]} -> ${track.tunnelRange[1]}`);
console.log(`racing line  : max |offset| = ${Math.max(...track.racingLine).toFixed(2)} m`);

const car = new Car(track, { livery: LIVERIES[0], maxSpeed: 94, power: 34 });
const pose = track.startPose(0);
car.place(pose.x, pose.z, pose.yaw);
const ai = new AIDriver(car, track, { name: 'BOT', skill: 1, lane: 0 });

// --- lap logic mirrored from main.js ---
let raceTime = 0;
let lapStarted = false, nextCheckpoint = 0, lapValid = true;
let prevDist = car.dist, lapStart = 0;
const laps = [];
const dt = 1 / 60;
let wallHits = 0, maxLat = 0, minSpeed = 1e9, offTrackFrames = 0, stuckFrames = 0;

for (let step = 0; step < 60 * 400; step++) {
  raceTime += dt;
  const ctrl = ai.drive(dt, [car]);
  car.update(dt, ctrl);

  maxLat = Math.max(maxLat, Math.abs(car.lateral));
  minSpeed = Math.min(minSpeed, car.forwardSpeed);
  if (car.offTrack) offTrackFrames++;
  if (car.hit > 1) { wallHits++; }
  if (Math.abs(car.forwardSpeed) < 1.5) stuckFrames++;

  const prev = prevDist, now = car.dist;
  const wrapped = now < prev - track.length * 0.5;

  if (nextCheckpoint < track.checkpointCount) {
    const cp = track.checkpoints[nextCheckpoint];
    const hit = wrapped ? (cp > prev || cp <= now) : (cp > prev && cp <= now);
    if (hit) nextCheckpoint++;
  }
  if (car.outOfBounds && lapStarted) lapValid = false;

  if (wrapped) {
    if (!lapStarted) {
      lapStarted = true; lapStart = raceTime; prevDist = now; continue;
    }
    const t = raceTime - lapStart;
    laps.push({ t, valid: lapValid && nextCheckpoint >= track.checkpointCount });
    if (laps.length >= 3) break;
    nextCheckpoint = 0; lapStart = raceTime; lapValid = true;
  }
  prevDist = car.dist;
}

laps.forEach((l, i) => {
  const m = Math.floor(l.t / 60), s = (l.t % 60).toFixed(3).padStart(6, '0');
  console.log(`lap ${i + 1}: ${m}:${s}  ${l.valid ? 'VALID' : 'INVALID'}`);
});
console.log(`max |lateral| = ${maxLat.toFixed(2)} m (limit ${track.limitOffset})`);
console.log(`wall hits     = ${wallHits} frames`);
console.log(`off track     = ${offTrackFrames} frames`);
console.log(`stuck frames  = ${stuckFrames}`);
console.log(`min speed     = ${minSpeed.toFixed(1)} m/s`);
