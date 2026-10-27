// Measure steady-state cornering safely: short accel, then full lock.
import './dom-stub.mjs';
import { Track } from '../src/track.js';
import { Car, LIVERIES } from '../src/car.js';

const track = new Track({ add() {}, remove() {} });
const car = new Car(track, { livery: LIVERIES[0], maxSpeed: 94, power: 34 });
const pose = track.startPose(0);
car.place(pose.x, pose.z, pose.yaw);

const dt = 1 / 60;
const ctrl = (throttle, steer) => ({ throttle, brake: 0, steer, handbrake: false, boost: false });

for (let i = 0; i < 60 * 2.2; i++) car.update(dt, ctrl(1, 0));   // ~40 m/s
console.log('v after accel:', car.forwardSpeed.toFixed(1));

let yawPrev = car.yaw;
for (let i = 0; i < 60 * 1.5; i++) {
  car.update(dt, ctrl(1, -1));
  if (i % 12 === 0) {
    const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
    const rx = -fz, rz = fx;
    const vl = car.vel.x * rx + car.vel.y * rz;
    let dyaw = car.yaw - yawPrev; if (dyaw > 3) dyaw -= 6.283; if (dyaw < -3) dyaw += 6.283;
    const rate = dyaw / (12 * dt);
    console.log(`i=${String(i).padStart(3)} v=${car.forwardSpeed.toFixed(1).padStart(5)} vl=${vl.toFixed(2).padStart(6)} yawRate=${rate.toFixed(3).padStart(6)} steer=${car.steer.toFixed(2)} lat=${car.lateral.toFixed(2).padStart(6)} d=${car.dist.toFixed(0)}`);
    yawPrev = car.yaw;
  }
}
