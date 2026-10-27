// F1 car: procedural mesh + arcade physics.
import * as THREE from 'three';
import { clamp, damp } from './util.js';

export const LIVERIES = [
  { body: 0xff8000, accent: 0xffffff, wing: 0x1a1206, name: 'PAPAYA', num: '4' },
  { body: 0x1756d1, accent: 0x9fe8ff, wing: 0x0d1b34, name: 'BLUEBULL', num: '11' },
  { body: 0x00d2be, accent: 0xffffff, wing: 0x0b2b26, name: 'AQUA', num: '14' },
  { body: 0xf5c400, accent: 0x1a1a1a, wing: 0x2a2400, name: 'PENSILE', num: '63' },
  { body: 0x6f34c8, accent: 0xffffff, wing: 0x1b1030, name: 'VIOLET', num: '10' },
];

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3, ...opts });
}

export function buildCarMesh(livery) {
  const g = new THREE.Group();
  const bodyMat = mat(livery.body, { roughness: 0.3, metalness: 0.45 });
  const accentMat = mat(livery.accent, { roughness: 0.35, metalness: 0.3 });
  const darkMat = mat(livery.wing, { roughness: 0.5, metalness: 0.4 });
  const carbon = mat(0x15171c, { roughness: 0.65, metalness: 0.2 });

  const add = (geo, m, x, y, z, cast = true) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    g.add(mesh);
    return mesh;
  };

  // floor / plank
  add(new THREE.BoxGeometry(1.55, 0.12, 4.7), carbon, 0, 0.16, -0.1);
  // chassis
  add(new THREE.BoxGeometry(0.95, 0.36, 3.5), bodyMat, 0, 0.38, -0.15);
  // nose
  add(new THREE.BoxGeometry(0.62, 0.26, 1.5), bodyMat, 0, 0.36, 1.95);
  const tip = add(new THREE.ConeGeometry(0.31, 0.85, 4), bodyMat, 0, 0.36, 3.05);
  tip.rotation.x = Math.PI / 2;
  tip.rotation.y = Math.PI / 4;
  // sidepods
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.52, 0.44, 1.8), bodyMat, s * 0.64, 0.4, 0.0);
    add(new THREE.BoxGeometry(0.2, 0.3, 0.7), accentMat, s * 0.5, 0.52, 0.95);
  }
  // engine cover + fin
  add(new THREE.BoxGeometry(0.5, 0.5, 1.9), bodyMat, 0, 0.6, -0.85);
  const fin = add(new THREE.BoxGeometry(0.07, 0.5, 1.5), accentMat, 0, 0.82, -1.05);
  fin.rotation.x = 0.06;
  // airbox
  add(new THREE.BoxGeometry(0.34, 0.3, 0.6), accentMat, 0, 0.86, 0.25);

  // halo
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.045, 8, 22), carbon);
  halo.rotation.x = -Math.PI / 2;
  halo.position.set(0, 0.78, 0.45);
  halo.castShadow = true;
  g.add(halo);
  add(new THREE.BoxGeometry(0.07, 0.07, 0.6), carbon, 0, 0.82, 0.95).rotation.x = 0.25;

  // driver
  const helmet = add(new THREE.SphereGeometry(0.21, 14, 12), accentMat, 0, 0.72, 0.45);
  helmet.scale.set(1, 0.95, 1.05);
  add(new THREE.BoxGeometry(0.28, 0.08, 0.06), darkMat, 0, 0.74, 0.63, false);

  // front wing
  add(new THREE.BoxGeometry(2.0, 0.07, 0.55), darkMat, 0, 0.13, 2.8);
  add(new THREE.BoxGeometry(1.72, 0.06, 0.32), accentMat, 0, 0.26, 2.66);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.06, 0.34, 0.72), bodyMat, s * 0.98, 0.24, 2.78);

  // rear wing
  add(new THREE.BoxGeometry(1.12, 0.07, 0.45), darkMat, 0, 1.0, -2.05);
  const flap = add(new THREE.BoxGeometry(1.06, 0.06, 0.3), accentMat, 0, 1.17, -2.16);
  flap.rotation.x = -0.35;
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.06, 0.72, 0.66), bodyMat, s * 0.58, 0.92, -2.05);
    add(new THREE.BoxGeometry(0.08, 0.55, 0.12), carbon, s * 0.2, 0.78, -2.02);
  }
  // diffuser + rear light
  add(new THREE.BoxGeometry(1.3, 0.28, 0.4), carbon, 0, 0.25, -2.25);
  const light = add(new THREE.BoxGeometry(0.12, 0.16, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2200, emissiveIntensity: 2.2 }),
    0, 0.56, -2.32, false);
  g.userData.rearLight = light;

  // wheels
  const wheels = [];
  const tyreGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.44, 22);
  const rimGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.46, 14);
  const tyreMat = mat(0x0d0e11, { roughness: 0.9, metalness: 0.05 });
  const rimMat = mat(0xb9c2cf, { roughness: 0.3, metalness: 0.85 });
  for (const [sx, sz, front] of [[-1, 1.62, true], [1, 1.62, true], [-1, -1.66, false], [1, -1.66, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.88, 0.37, sz);
    const spin = new THREE.Group();
    const tyre = new THREE.Mesh(tyreGeo, tyreMat);
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    spin.add(tyre, rim);
    pivot.add(spin);
    g.add(pivot);
    wheels.push({ pivot, spin, front, radius: front ? 0.37 : 0.39 });
  }
  g.userData.wheels = wheels;
  return g;
}

export class Car {
  /**
   * @param {import('./track.js').Track} track
   */
  constructor(track, { livery, maxSpeed = 92, power = 34, latGrip = 32 }) {
    this.track = track;
    this.livery = livery;
    this.mesh = buildCarMesh(livery);
    this.params = { maxSpeed, power, latGrip, brake: 46 };

    this.pos = new THREE.Vector2();  // x, z
    this.vel = new THREE.Vector2();
    this.yaw = 0;
    this.steer = 0;
    this.forwardSpeed = 0;
    this.slip = 0;
    this.ers = 1;
    this.boosting = false;

    this.sampleHint = -1;
    this.dist = 0;
    this.lateral = 0;
    this.onKerb = false;
    this.offTrack = false;
    this.outOfBounds = false;
    this.hit = 0;

    // lap state
    this.lap = 0;
    this.nextCheckpoint = 0;
    this.lapStart = 0;
    this.lastLap = 0;
    this.bestLap = 0;
    this.lapValid = true;
    this.splits = [];
    this.finished = false;
    this.finishTime = 0;
    this.prevDist = 0;
  }

  place(x, z, yaw) {
    this.pos.set(x, z);
    this.yaw = yaw;
    this.vel.set(0, 0);
    this.steer = 0;
    this.forwardSpeed = 0;
    this.sampleHint = -1;
    const loc = this.track.locate(x, z);
    this.sampleHint = loc.i;
    this.dist = this.prevDist = loc.dist;
    this.lateral = loc.off;
    this.syncMesh();
  }

  /** Respawn on the racing line at the current track position. */
  respawn() {
    const s = this.track.sampleAt(this.dist);
    this.place(s.x + s.rx * (s.racing || 0), s.z + s.rz * (s.racing || 0), Math.atan2(s.tx, s.tz));
  }

  get totalDistance() { return this.lap * this.track.length + this.dist; }

  update(dt, ctrl) {
    const tr = this.track;
    const p = this.params;

    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const rx = -fz, rz = fx; // right vector (matches track convention)

    let vf = this.vel.x * fx + this.vel.y * fz;
    let vl = this.vel.x * rx + this.vel.y * rz;

    const surface = this._surface();

    // engine / brakes
    if (ctrl.throttle > 0) {
      if (vf >= -0.5) {
        const boost = ctrl.boost && this.ers > 0.02 ? 1.28 : 1;
        vf += p.power * boost * (1 - Math.min(1, Math.abs(vf) / p.maxSpeed)) * ctrl.throttle * dt;
        if (ctrl.boost && this.ers > 0.02) this.ers = Math.max(0, this.ers - dt * 0.34);
        this.boosting = !!ctrl.boost && this.ers > 0.02;
      } else {
        vf += 26 * dt; // unwind reverse
      }
    } else {
      this.boosting = false;
    }
    if (ctrl.brake > 0) {
      if (vf > 0.5) vf -= p.brake * ctrl.brake * dt;
      else vf = Math.max(-14, vf - 16 * ctrl.brake * dt);
    }
    if (ctrl.throttle === 0 && ctrl.brake === 0) {
      const drag = 0.7 + 0.0016 * vf * Math.abs(vf) + (surface.off ? 6 : 0);
      vf -= Math.sign(vf) * Math.min(Math.abs(vf), drag * dt);
    }
    if (!ctrl.boost) this.ers = Math.min(1, this.ers + dt * 0.085);

    // steering
    this.steer = damp(this.steer, clamp(ctrl.steer, -1, 1), 9, dt);
    const speedAbs = Math.abs(vf);
    const latGrip = p.latGrip * surface.gripMul * (ctrl.handbrake ? 0.42 : 1);
    const maxYaw = Math.min(3.4, latGrip / Math.max(speedAbs, 7));
    const dir = vf >= 0 ? 1 : -1;
    this.yaw += this.steer * maxYaw * dir * dt;

    // lateral grip — this is what makes the car grip or slide
    const gripK = ctrl.handbrake ? 1.15 : (surface.off ? 2.6 : surface.onKerb ? 6.5 : 10.5);
    vl *= Math.exp(-gripK * dt);
    if (ctrl.handbrake) vl += this.steer * speedAbs * 0.9 * dt;

    vf = clamp(vf, -14, p.maxSpeed * (this.boosting ? 1.07 : 1));
    const nfx = Math.sin(this.yaw), nfz = Math.cos(this.yaw);
    const nrx = -nfz, nrz = nfx;
    this.vel.set(nfx * vf + nrx * vl, nfz * vf + nrz * vl);
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    this.forwardSpeed = vf;
    this.slip = clamp((Math.abs(vl) - 3.5) / 14, 0, 1);

    this._resolveTrack();
    this.syncMesh(dt);
    return surface;
  }

  _surface() {
    const t = this.track;
    const a = Math.abs(this.lateral);
    return {
      onKerb: this.onKerb,
      off: this.offTrack,
      gripMul: this.offTrack ? 0.72 : this.onKerb ? 0.92 : 1,
      valid: a <= t.validOffset,
    };
  }

  _resolveTrack() {
    const tr = this.track;
    const loc = tr.locate(this.pos.x, this.pos.y, this.sampleHint);
    this.sampleHint = loc.i;
    this.dist = loc.dist;
    this.lateral = loc.off;
    this.onKerb = Math.abs(loc.off) > tr.halfWidth && Math.abs(loc.off) <= tr.halfWidth + tr.kerbWidth + 0.4;
    this.offTrack = Math.abs(loc.off) > tr.driveOffset;
    this.outOfBounds = Math.abs(loc.off) > tr.validOffset;

    // wall
    const lim = tr.limitOffset;
    const a = Math.abs(loc.off);
    this.hit = 0;
    if (a > lim) {
      const s = Math.sign(loc.off);
      const smp = loc.s;
      this.pos.x -= smp.rx * s * (a - lim);
      this.pos.y -= smp.rz * s * (a - lim);
      const vn = this.vel.x * smp.rx * s + this.vel.y * smp.rz * s;
      if (vn > 0) {
        this.vel.x -= smp.rx * s * vn * 1.35;
        this.vel.y -= smp.rz * s * vn * 1.35;
        this.vel.multiplyScalar(0.92);
        this.hit = vn;
      }
    }
  }

  syncMesh(dt = 0.016) {
    const m = this.mesh;
    const bump = this.onKerb ? Math.sin(this.dist * 9) * 0.028 : 0;
    m.position.set(this.pos.x, bump, this.pos.y);
    m.rotation.y = this.yaw;
    m.rotation.z = clamp(-this.steer * this.forwardSpeed * 0.0016, -0.09, 0.09);
    m.rotation.x = clamp(this.slip * 0.01, -0.02, 0.02);

    const wheels = m.userData.wheels;
    for (const w of wheels) {
      if (w.front) w.pivot.rotation.y = this.steer * 0.42;
      w.spin.rotation.x += (this.forwardSpeed / w.radius) * dt;
    }
  }
}
