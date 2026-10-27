// The circuit: layout, geometry (road / kerbs / runoff / walls / tunnel), lap data.
import * as THREE from 'three';
import {
  asphaltTexture, kerbTexture, runoffTexture, barrierTexture,
  checkerTexture, bannerTexture, tunnelTextures,
} from './textures.js';
import { clamp } from './util.js';

// Monaco-inspired street circuit, metres. x = east, z = south. Index 0 is start/finish.
const LAYOUT = [
  [-160, 0], [-20, 0], [100, 0], [190, 3],        // start / finish straight
  [238, 26], [258, 62], [252, 104],               // Ste Dévote
  [240, 152], [252, 200], [244, 248],             // Beau Rivage climb
  [258, 292], [296, 318],                         // Massenet
  [352, 330], [408, 334],                         // Casino straight
  [448, 352], [462, 386],                         // Casino
  [452, 424], [416, 444],                         // Mirabeau
  [368, 452], [300, 456], [232, 456], [180, 460], // harbour straight
  [150, 466], [128, 492], [134, 522], [162, 542], [196, 548], // Loews hairpin
  [270, 550], [350, 552], [430, 556],             // eastbound
  [478, 574], [494, 610],                         // Portier
  [488, 654], [462, 690], [400, 704], [330, 706], [262, 710], // tunnel
  [222, 726], [178, 712],                         // Nouvelle chicane
  [120, 706], [62, 716],                          // Tabac
  [4, 730], [-52, 716], [-104, 726],              // Swimming Pool
  [-156, 720], [-208, 700], [-238, 664],          // Rascasse
  [-250, 604], [-238, 546], [-252, 486], [-240, 424],
  [-254, 362], [-242, 300], [-256, 236], [-244, 172], // west side bends
  [-246, 120], [-248, 76], [-232, 38], [-196, 12],    // Anthony Noghes
];

const TUNNEL_START = LAYOUT[31]; // [488, 654]
const TUNNEL_END = LAYOUT[37];   // [178, 712]

function smooth(arr, window) {
  const n = arr.length;
  const out = new Float32Array(n);
  const half = Math.floor(window / 2);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = -half; k <= half; k++) s += arr[(((i + k) % n) + n) % n];
    out[i] = s / (half * 2 + 1);
  }
  return out;
}

/** Quad strip between two "edge curves" defined by lateral offset + height. */
function buildRibbon(samples, edgeA, edgeB, vRepeat) {
  const n = samples.length;
  const pos = new Float32Array(n * 2 * 3);
  const uvs = new Float32Array(n * 2 * 2);
  const idx = new Array(n * 6);
  let p = 0, u = 0, q = 0;
  for (let i = 0; i < n; i++) {
    const s = samples[i];
    const v = (i / n) * vRepeat;
    pos[p++] = s.x + s.rx * edgeA.off; pos[p++] = edgeA.y; pos[p++] = s.z + s.rz * edgeA.off;
    pos[p++] = s.x + s.rx * edgeB.off; pos[p++] = edgeB.y; pos[p++] = s.z + s.rz * edgeB.off;
    uvs[u++] = 0; uvs[u++] = v;
    uvs[u++] = 1; uvs[u++] = v;
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2, b = a + 1, a2 = ((i + 1) % n) * 2, b2 = a2 + 1;
    idx[q++] = a; idx[q++] = b; idx[q++] = b2;
    idx[q++] = a; idx[q++] = b2; idx[q++] = a2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class Track {
  constructor(scene) {
    this.scene = scene;

    this.halfWidth = 6.5;      // asphalt half width
    this.kerbWidth = 1.6;
    this.runoffWidth = 2.6;
    this.wallOffset = this.halfWidth + this.kerbWidth + this.runoffWidth; // 10.7
    this.wallHeight = 1.15;
    this.limitOffset = this.wallOffset - 1.1;   // car centre clamp (body width)
    this.validOffset = this.halfWidth + this.kerbWidth + 0.5; // beyond this = off limits
    this.driveOffset = this.halfWidth + 0.3;    // beyond this = reduced grip

    const pts = LAYOUT.map((p) => new THREE.Vector3(p[0], 0, p[1]));
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
    this.length = this.curve.getLength();
    this.n = 1400;
    this.ds = this.length / this.n;

    const spaced = this.curve.getSpacedPoints(this.n);
    this.samples = [];
    for (let i = 0; i < this.n; i++) {
      const p = spaced[i];
      const t = this.curve.getTangentAt(i / this.n);
      const l = Math.hypot(t.x, t.z) || 1;
      const tx = t.x / l, tz = t.z / l;
      this.samples.push({ x: p.x, z: p.z, tx, tz, rx: -tz, rz: tx, d: i * this.ds });
    }

    // signed curvature, +1 = turning right (1/m) — central difference of tangents
    const raw = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) {
      const a = this.samples[(i - 1 + this.n) % this.n];
      const c = this.samples[(i + 1) % this.n];
      raw[i] = (a.tx * c.tz - a.tz * c.tx) / (2 * this.ds);
    }
    this.curv = smooth(raw, 9);

    // racing line: lateral offset that cuts toward the apex
    const rlRaw = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) rlRaw[i] = clamp(this.curv[i] * 130, -4.2, 4.2);
    this.racingLine = smooth(rlRaw, 46);

    this._buildRoad();
    this._buildKerbs();
    this._buildRunoff();
    this._buildWalls();
    this._buildStartLine();
    this._buildGantry();
    this._buildTunnel();

    // 7 sector checkpoints between the start line and the next pass
    this.checkpointCount = 7;
    this.checkpoints = [];
    for (let k = 1; k <= this.checkpointCount; k++) this.checkpoints.push((k / 8) * this.length);

    const tunnelA = this._nearestIndex(TUNNEL_START[0], TUNNEL_START[1]);
    const tunnelB = this._nearestIndex(TUNNEL_END[0], TUNNEL_END[1]);
    this.tunnelRange = [tunnelA, tunnelB];

    this._buildMinimapData();
  }

  /* ------------------------------------------------ static geometry */

  _mat(opts) {
    return new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...opts });
  }

  _addRibbon(edgeA, edgeB, vRepeat, material, { shadows = false } = {}) {
    const g = buildRibbon(this.samples, edgeA, edgeB, vRepeat);
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = shadows;
    m.castShadow = false;
    this.scene.add(m);
    return m;
  }

  _buildRoad() {
    const tex = asphaltTexture();
    const mat = this._mapMat(tex);
    this._addRibbon(
      { off: -this.halfWidth, y: 0 },
      { off: this.halfWidth, y: 0 },
      Math.round(this.length / 8),
      mat,
      { shadows: true },
    );
  }

  _mapMat(tex, extra = {}) {
    return new THREE.MeshStandardMaterial({
      map: tex, side: THREE.DoubleSide, roughness: 0.92, metalness: 0.02, ...extra,
    });
  }

  _buildKerbs() {
    const tex = kerbTexture();
    const mat = this._mapMat(tex, { roughness: 0.6 });
    const rep = Math.round(this.length / 2);
    this._addRibbon(
      { off: this.halfWidth, y: 0.015 },
      { off: this.halfWidth + this.kerbWidth, y: 0.07 },
      rep, mat,
    );
    this._addRibbon(
      { off: -this.halfWidth, y: 0.015 },
      { off: -(this.halfWidth + this.kerbWidth), y: 0.07 },
      rep, mat,
    );
  }

  _buildRunoff() {
    const tex = runoffTexture();
    const mat = this._mapMat(tex, { roughness: 1 });
    const rep = Math.round(this.length / 6);
    this._addRibbon(
      { off: this.halfWidth + this.kerbWidth, y: 0.01 },
      { off: this.wallOffset, y: 0.01 },
      rep, mat,
    );
    this._addRibbon(
      { off: -(this.halfWidth + this.kerbWidth), y: 0.01 },
      { off: -this.wallOffset, y: 0.01 },
      rep, mat,
    );
  }

  _buildWalls() {
    const tex = barrierTexture();
    const mat = this._mapMat(tex, { roughness: 0.55, metalness: 0.15 });
    const rep = Math.round(this.length / 12);
    this._addRibbon(
      { off: this.wallOffset, y: 0 },
      { off: this.wallOffset, y: this.wallHeight },
      rep, mat,
    );
    this._addRibbon(
      { off: -this.wallOffset, y: this.wallHeight },
      { off: -this.wallOffset, y: 0 },
      rep, mat,
    );
  }

  _buildStartLine() {
    const s = this.samples[0];
    const tex = checkerTexture();
    tex.wrapS = THREE.RepeatWrapping;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
    const g = new THREE.PlaneGeometry(this.halfWidth * 2, 3);
    const m = new THREE.Mesh(g, mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(s.tx, s.tz);
    m.position.set(s.x, 0.035, s.z);
    m.receiveShadow = true;
    this.scene.add(m);
    this.startLine = m;
  }

  _buildGantry() {
    const s = this.samples[0];
    const yaw = Math.atan2(s.tx, s.tz);
    const group = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2b2f38, roughness: 0.6, metalness: 0.5 });
    const span = this.wallOffset + 2.2;
    const postGeo = new THREE.CylinderGeometry(0.35, 0.45, 8.6, 12);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(side * span, 4.3, 0);
      post.castShadow = true;
      group.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(span * 2 + 1, 2.0, 1.0), postMat);
    beam.position.y = 8.2;
    beam.castShadow = true;
    group.add(beam);

    const bannerMat = new THREE.MeshStandardMaterial({
      map: bannerTexture('GP MONTE-CARLO', '#101318', '#ff3b2f'),
      roughness: 0.7,
    });
    for (const dz of [0.53, -0.53]) {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(span * 2 + 0.6, 1.7), bannerMat);
      face.position.set(0, 8.2, dz);
      face.rotation.y = dz > 0 ? 0 : Math.PI;
      group.add(face);
    }
    // start lights hanging under the gantry
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0x111111, emissive: 0x330000, roughness: 0.4,
    });
    const lampGeo = new THREE.SphereGeometry(0.22, 10, 8);
    for (let i = -2; i <= 2; i++) {
      const lamp = new THREE.Mesh(lampGeo, lightMat);
      lamp.position.set(i * 1.5, 7.1, 0);
      group.add(lamp);
    }
    group.position.set(s.x, 0, s.z);
    group.rotation.y = yaw;
    this.scene.add(group);
  }

  _buildTunnel() {
    const a = this._nearestIndex(TUNNEL_START[0], TUNNEL_START[1]);
    const b = this._nearestIndex(TUNNEL_END[0], TUNNEL_END[1]);
    const steps = Math.max(12, Math.round((b - a + this.n) % this.n / 2));
    const arch = 12; // segments across the arch
    const R = this.wallOffset + 1.6;
    const H = 6.4;

    const pos = [];
    const uvs = [];
    const idx = [];
    for (let k = 0; k <= steps; k++) {
      const i = (((a + Math.round((k / steps) * ((b - a + this.n) % this.n))) % this.n) + this.n) % this.n;
      const s = this.samples[i];
      for (let j = 0; j <= arch; j++) {
        const ang = (j / arch) * Math.PI;
        const ox = Math.cos(ang) * R;
        const oy = Math.sin(ang) * H + 0.2;
        pos.push(s.x + s.rx * ox, oy, s.z + s.rz * ox);
        uvs.push(k / 4, j / arch);
      }
    }
    for (let k = 0; k < steps; k++) {
      for (let j = 0; j < arch; j++) {
        const a0 = k * (arch + 1) + j;
        const b0 = a0 + 1;
        const a1 = (k + 1) * (arch + 1) + j;
        const b1 = a1 + 1;
        idx.push(a0, a1, b1, a0, b1, b0);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    const { map, emissive } = tunnelTextures();
    const mat = new THREE.MeshStandardMaterial({
      map, emissiveMap: emissive, emissive: 0xffd9a0, emissiveIntensity: 1.6,
      side: THREE.DoubleSide, roughness: 0.95,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = false;
    mesh.castShadow = false;
    this.scene.add(mesh);

    // dark mouth frames at both ends
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.9, side: THREE.DoubleSide });
    for (const [idx2, dir] of [[a, 1], [b, -1]]) {
      const s = this.samples[((idx2 % this.n) + this.n) % this.n];
      const shape = new THREE.Shape();
      shape.moveTo(-R, 0);
      shape.lineTo(-R, 0.2);
      shape.absarc(0, 0.2, R, Math.PI, 0, true);
      shape.lineTo(R, 0);
      const hole = new THREE.Path();
      hole.moveTo(-(R - 1.4), 0);
      hole.absarc(0, 0.2, R - 1.4, Math.PI, 0, true);
      hole.lineTo(R - 1.4, 0);
      shape.holes.push(hole);
      const g2 = new THREE.ShapeGeometry(shape, 24);
      const m2 = new THREE.Mesh(g2, mouthMat);
      m2.position.set(s.x, 0, s.z);
      m2.rotation.y = Math.atan2(s.tx, s.tz) + (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      this.scene.add(m2);
    }
  }

  /* ------------------------------------------------ queries */

  _nearestIndex(x, z, hint = -1) {
    if (hint >= 0) {
      let best = hint, bd = Infinity;
      for (let k = -50; k <= 50; k++) {
        const i = (((hint + k) % this.n) + this.n) % this.n;
        const s = this.samples[i];
        const d = (s.x - x) ** 2 + (s.z - z) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      if (bd < 1600) return best;
    }
    let best = 0, bd = Infinity;
    for (let i = 0; i < this.n; i++) {
      const s = this.samples[i];
      const d = (s.x - x) ** 2 + (s.z - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  /** Full state of the track at a world position. */
  locate(x, z, hint = -1) {
    const i = this._nearestIndex(x, z, hint);
    const s = this.samples[i];
    const off = (x - s.x) * s.rx + (z - s.z) * s.rz;
    const along = (x - s.x) * s.tx + (z - s.z) * s.tz;
    let dist = i * this.ds + along;
    dist = ((dist % this.length) + this.length) % this.length;
    return { i, off, dist, s };
  }

  /** Interpolated sample at arc-length position s (metres from the line). */
  sampleAt(s) {
    let f = (((s % this.length) + this.length) % this.length) / this.ds;
    const i = Math.floor(f) % this.n;
    const t = f - Math.floor(f);
    const a = this.samples[i];
    const b = this.samples[(i + 1) % this.n];
    return {
      x: a.x + (b.x - a.x) * t,
      z: a.z + (b.z - a.z) * t,
      tx: a.tx + (b.tx - a.tx) * t,
      tz: a.tz + (b.tz - a.tz) * t,
      rx: a.rx + (b.rx - a.rx) * t,
      rz: a.rz + (b.rz - a.rz) * t,
      curv: this.curv[i],
      racing: this.racingLine[i],
    };
  }

  curvatureAt(dist) {
    const i = Math.floor((((dist % this.length) + this.length) % this.length) / this.ds) % this.n;
    return this.curv[i];
  }

  /** Car starts a few metres before the line so the first crossing starts lap 1. */
  startPose(offsetLateral = 0) {
    const s = this.sampleAt(this.length - 12);
    return {
      x: s.x + s.rx * offsetLateral,
      z: s.z + s.rz * offsetLateral,
      yaw: Math.atan2(s.tx, s.tz),
    };
  }

  _buildMinimapData() {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const s of this.samples) {
      minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x);
      minZ = Math.min(minZ, s.z); maxZ = Math.max(maxZ, s.z);
    }
    this.bounds = { minX, maxX, minZ, maxZ };
    const path = [];
    for (let i = 0; i < this.n; i += 6) {
      const s = this.samples[i];
      path.push([s.x, s.z]);
    }
    this.minimapPath = path;
  }
}
