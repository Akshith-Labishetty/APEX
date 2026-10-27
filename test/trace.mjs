import './dom-stub.mjs';
import { Track } from '../src/track.js';
import { Car, LIVERIES } from '../src/car.js';

const track = new Track({ add() {}, remove() {} });
const car = new Car(track, { livery: LIVERIES[0], maxSpeed: 94, power: 34 });
console.log('params:', car.params);
const pose = track.startPose(0);
car.place(pose.x, pose.z, pose.yaw);
console.log('placed at', car.pos.x.toFixed(2), car.pos.y.toFixed(2), 'yaw', car.yaw.toFixed(3), 'dist', car.dist.toFixed(1), 'lat', car.lateral.toFixed(2));

const dt = 1 / 60;
for (let i = 0; i < 12; i++) {
  const s = car.update(dt, { throttle: 1, brake: 0, steer: 0, handbrake: false, boost: false });
  console.log(`f=${i} vf=${car.forwardSpeed.toFixed(3)} vel=(${car.vel.x.toFixed(2)},${car.vel.y.toFixed(2)}) lat=${car.lateral.toFixed(2)} off=${car.offTrack} hit=${car.hit.toFixed(2)} surface=${JSON.stringify(s)}`);
}
