import './dom-stub.mjs';
import { Track } from '../src/track.js';
import { Car, LIVERIES } from '../src/car.js';
import { AIDriver } from '../src/ai.js';

const track = new Track({ add() {}, remove() {} });
const car = new Car(track, { livery: LIVERIES[0], maxSpeed: 94, power: 34 });
const pose = track.startPose(0);
car.place(pose.x, pose.z, pose.yaw);
const ai = new AIDriver(car, track, { name: 'BOT', skill: 1, lane: 0 });

const dt = 1 / 60;
for (let f = 0; f < 60 * 8; f++) {
  car.update(dt, ai.drive(dt, [car]));
  if (f % 30 === 0 && f > 60 * 7 && f < 60 * 8.2) {
    const loc = track.locate(car.pos.x, car.pos.y, car.sampleHint);
    const s = loc.s;
    const tangentYaw = Math.atan2(s.tx, s.tz);
    let dy = car.yaw - tangentYaw;
    while (dy > Math.PI) dy -= 2 * Math.PI;
    while (dy < -Math.PI) dy += 2 * Math.PI;
    console.log(
      `d=${car.dist.toFixed(0).padStart(4)} car=(${car.pos.x.toFixed(1)},${car.pos.y.toFixed(1)}) sample=(${s.x.toFixed(1)},${s.z.toFixed(1)}) right=(${s.rx.toFixed(2)},${s.rz.toFixed(2)}) off=${loc.off.toFixed(2)} carYaw=${car.yaw.toFixed(3)} tanYaw=${tangentYaw.toFixed(3)} dYaw=${dy.toFixed(3)} curv=${track.curv[loc.i].toFixed(4)}`,
    );
  }
}
