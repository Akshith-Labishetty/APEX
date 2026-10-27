// Debug: trace a bot lap frame by frame.
import './dom-stub.mjs';
import { Track } from '../src/track.js';
import { Car, LIVERIES } from '../src/car.js';
import { AIDriver } from '../src/ai.js';

const scene = { add() {}, remove() {} };
const track = new Track(scene);
const car = new Car(track, { livery: LIVERIES[0], maxSpeed: 94, power: 34 });
const pose = track.startPose(0);
car.place(pose.x, pose.z, pose.yaw);
const ai = new AIDriver(car, track, { name: 'BOT', skill: 1, lane: 0 });

const dt = 1 / 60;
let prevYaw = car.yaw;
let t = 0;
const step = Number(process.argv[2] || 10); // frames between log lines
for (let f = 0; f < 60 * 80; f++) {
  t += dt;
  const ctrl = ai.drive(dt, [car]);
  car.update(dt, ctrl);
  if (f % step === 0) {
    const curv = track.curvatureAt(car.dist).toFixed(4);
    const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
    const vl = car.vel.x * -fz + car.vel.y * fx;
    let dyaw = car.yaw - prevYaw; if (dyaw > 3) dyaw -= 6.283; if (dyaw < -3) dyaw += 6.283;
    const rate = dyaw / (step * dt);
    prevYaw = car.yaw;
    const expected = (25 / Math.max(1, Math.abs(car.forwardSpeed))).toFixed(3);
    console.log(
      `t=${t.toFixed(2).padStart(6)}  d=${car.dist.toFixed(0).padStart(4)}  v=${car.forwardSpeed.toFixed(1).padStart(6)}  lat=${car.lateral.toFixed(2).padStart(6)}  curv=${curv}  yawR=${rate.toFixed(3)} (max ${expected}) vl=${vl.toFixed(2).padStart(6)} str=${ctrl.steer.toFixed(2)} ${car.offTrack ? 'OFF' : ''}${car.hit > 1 ? ' HIT' : ''}`,
    );
  }
}
