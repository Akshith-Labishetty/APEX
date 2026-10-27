// AI driver: follows the racing line, brakes for corners, avoids a car directly ahead.
import { clamp, wrapAngle } from './util.js';

export class AIDriver {
  constructor(car, track, { name = 'RIVAL', skill = 1, lane = 0 }) {
    this.car = car;
    this.track = track;
    this.name = name;
    this.skill = skill;
    this.baseLane = lane;
    this.lane = lane;
    this.wobblePhase = Math.random() * 6.28;
    this.aggression = 0.6 + Math.random() * 0.4;
  }

  /** @returns driving controls for Car.update */
  drive(dt, others) {
    const car = this.car;
    const tr = this.track;
    const speed = Math.max(0, car.forwardSpeed);

    // lane discipline + gentle wander + avoidance
    let wantLane = this.baseLane + Math.sin(performance.now() * 0.0004 + this.wobblePhase) * 0.4;
    for (const o of others) {
      if (o === car) continue;
      let gap = o.dist - car.dist;
      if (gap < -tr.length / 2) gap += tr.length;
      if (gap > tr.length / 2) gap -= tr.length;
      if (gap > 2 && gap < 20 && Math.abs(o.lateral - car.lateral) < 3.2) {
        wantLane = car.lateral > 0 ? -3.0 : 3.0;
      }
    }
    this.lane += clamp(wantLane - this.lane, -2.5 * dt, 2.5 * dt);

    // aim at a point down the racing line
    const look = 15 + speed * 0.5;
    const ahead = tr.sampleAt(car.dist + look);
    const aimX = ahead.x + ahead.rx * (ahead.racing + this.lane);
    const aimZ = ahead.z + ahead.rz * (ahead.racing + this.lane);
    const desired = Math.atan2(aimX - car.pos.x, aimZ - car.pos.y);
    const err = wrapAngle(desired - car.yaw);
    const steer = clamp(err * 3.2, -1, 1);

    // corner speed from the curvature ahead (with a safety margin)
    let maxC = 1e-5;
    const span = 34 + speed * 1.7;
    for (let d = 0; d < span; d += 5) {
      const c = Math.abs(tr.curvatureAt(car.dist + d));
      if (c > maxC) maxC = c;
    }
    const grip = 32 * this.skill * 0.86;
    const corner = Math.sqrt(grip / maxC);
    const wobble = 1 + Math.sin(performance.now() * 0.001 + this.wobblePhase * 3) * 0.02;
    const target = Math.min(car.params.maxSpeed * this.skill * wobble, corner);

    const throttle = speed < target - 0.4 ? 1 : (speed < target ? 0.35 : 0);
    let brake = 0;
    if (speed > target + 0.8) brake = clamp((speed - target) / 9, 0.2, 1);
    const boost = throttle === 1 && target > speed + 6 && car.ers > 0.45;

    return { throttle, brake, steer, handbrake: false, boost };
  }
}
