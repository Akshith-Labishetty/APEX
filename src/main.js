// GP MONTE-CARLO — game bootstrap, state machine, race logic.
import * as THREE from 'three';
import { Track } from './track.js';
import { buildEnvironment } from './environment.js';
import { Car, LIVERIES } from './car.js';
import { AIDriver } from './ai.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { HUD } from './hud.js';
import { ParticleSystem } from './particles.js';
import * as LB from './leaderboard.js';
import { clamp, formatTime, formatDate } from './util.js';

const $ = (id) => document.getElementById(id);
const RACE_LAPS = 3;
// Seconds off-track before a lap is voided. validOffset (8.6m) sits only 0.5m past
// the kerb and a metre short of the wall clamp (9.6m), so voiding on a single frame
// killed every lap on the first graze of the runoff.
const OOB_LIMIT = 1.5;
const AI_DRIVERS = [
  { name: 'M. VERSTRA', skill: 0.985, lane: -3.0 },
  { name: 'L. HAMILTONOV', skill: 0.972, lane: 3.0 },
  { name: 'C. LECLERCQ', skill: 0.958, lane: -1.6 },
];

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

class Game {
  constructor() {
    this.state = 'menu';
    this.mode = 'tt';
    this.raceTime = 0;
    this.countdown = 0;
    this.lightsOn = -1;
    this.finishDelay = -1;
    this.camMode = 0;
    this.shake = 0;
    this.sessionBest = null;
    this.thudCooldown = 0;
    this.wrongWay = 0;
    this.menuAngle = 0;
    this.playerDelta = null;
    this.driver = 'PLAYER';
    this.clock = new THREE.Clock();
    this.cars = [];
    this.ai = [];
  }

  /* ------------------------------------------------------------------ setup */
  init() {
    const canvas = $('c');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xaecbe8, 0.00060);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 6000);

    this._buildSky();
    this._buildLights();

    this.track = new Track(this.scene);
    buildEnvironment(this.scene, this.track);
    this.track.turnCount = this._countTurns();
    this.particles = new ParticleSystem(this.scene);

    this._buildCars();

    this.input = new Input();
    this.audio = new GameAudio();
    this.hud = new HUD();
    this.hud.setTrack(this.track);

    // menu camera target
    const b = this.track.bounds;
    this.menuCenter = new THREE.Vector3((b.minX + b.maxX) / 2, 30, (b.minZ + b.maxZ) / 2);

    this._wireUI();
    this.renderLeaderboard();
    $('menuLength').textContent = `${(this.track.length / 1000).toFixed(2)}\u00A0KM · ${this.track.turnCount} TURNS`;
    $('loadhint')?.remove();
    // index.html ships #menu as "overlay hidden" — it has to be shown here or the
    // boot state is just the orbiting menu camera with no UI to click.
    $('menu').classList.remove('hidden');

    window.addEventListener('resize', () => this.onResize());
    this.clock.start();
    this.loop();
  }

  _buildSky() {
    const geo = new THREE.SphereGeometry(3200, 32, 20);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x1a5fd0) },
        mid: { value: new THREE.Color(0xa8d8ff) },
        bottom: { value: new THREE.Color(0x6f9dc4) },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP;
        void main(){
          float h = normalize(vP).y;
          vec3 c = mix(mid, top, smoothstep(0.02, 0.6, h));
          c = mix(bottom, c, smoothstep(-0.3, 0.03, h));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(geo, mat);
    sky.frustumCulled = false;
    this.scene.add(sky);
  }

  _buildLights() {
    this.scene.add(new THREE.HemisphereLight(0x9ecbff, 0x4f6b45, 0.70));
    this.scene.add(new THREE.AmbientLight(0x8fa8c8, 0.32));

    const sun = new THREE.DirectionalLight(0xfff4e2, 3.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera;
    c.left = -95; c.right = 95; c.top = 95; c.bottom = -95;
    c.near = 20; c.far = 700;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.6;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    this.sunOffset = new THREE.Vector3(-190, 150, -160);
  }

  _countTurns() {
    const curv = this.track.curv;
    const n = this.track.n;
    let turns = 0, lastIdx = -999;
    for (let i = 0; i < n; i++) {
      const c = Math.abs(curv[i]);
      const a = Math.abs(curv[(i - 1 + n) % n]);
      const b = Math.abs(curv[(i + 1) % n]);
      if (c > 0.0035 && c >= a && c > b && i - lastIdx > 25) { turns++; lastIdx = i; }
    }
    return turns;
  }

  _buildCars() {
    const tr = this.track;
    // latGrip is the steering-sensitivity dial: yaw rate ~= latGrip / speed
    // (car.js: maxYaw = min(3.4, latGrip / speed)). Default is 25.
    const player = new Car(tr, { livery: LIVERIES[0], maxSpeed: 94, power: 34, latGrip: 33 });
    this.cars.push(player);
    this.scene.add(player.mesh);            // Car builds its mesh but takes no scene
    this.playerIndex = 0;

    for (let i = 0; i < AI_DRIVERS.length; i++) {
      const d = AI_DRIVERS[i];
      const car = new Car(tr, {
        livery: LIVERIES[i + 1],
        maxSpeed: 94 - i * 0.8,
        power: 33.5,
      });
      this.cars.push(car);
      this.scene.add(car.mesh);
      this.ai.push(new AIDriver(car, tr, d));
    }
    this.colors = this.cars.map((c, i) => (i === this.playerIndex ? '#ff8000' : '#' + c.livery.body.toString(16).padStart(6, '0')));
    this.resetGrid();
  }

  resetGrid() {
    const tr = this.track;
    const player = this.cars[this.playerIndex];
    const pose = tr.startPose(0);
    player.place(pose.x, pose.z, pose.yaw);
    for (let i = 1; i < this.cars.length; i++) {
      const car = this.cars[i];
      const s = tr.sampleAt(tr.length - 12 - i * 8);
      const lane = i % 2 === 0 ? -3.2 : 3.2;
      car.place(s.x + s.rx * lane, s.z + s.rz * lane, Math.atan2(s.tx, s.tz));
    }
    for (const car of this.cars) {
      car.lap = 0; car.lapStarted = false; car.lapValid = true;
      car.nextCheckpoint = 0; car.splits = []; car.lastLap = 0; car.bestLap = 0;
      car.bestSplits = []; car.finished = false; car.finishTime = 0;
      car.ers = 1; car.hit = 0; car.oobTime = 0; car.oobPeak = 0;
    }
    this.particles.clear();
  }

  /* ------------------------------------------------------------------ UI */
  _wireUI() {
    $('driverName').value = localStorage.getItem('f1-mc-name') || 'PLAYER';
    $('btnTT').addEventListener('click', () => this.start('tt'));
    $('btnRace').addEventListener('click', () => this.start('race'));
    $('btnClear').addEventListener('click', () => {
      LB.clear();
      this.renderLeaderboard();
    });
    $('btnAgain').addEventListener('click', () => {
      this.hud.hideResults();
      this.start(this.mode);
    });
    $('btnMenu2').addEventListener('click', () => {
      this.hud.hideResults();
      this.backToMenu();
    });

    this.input.onKey((code) => {
      if (code === 'KeyM') {
        this.audio.setMuted(!this.audio.muted);
        this.hud.toast(this.audio.muted ? 'SOUND OFF' : 'SOUND ON', '', 1200);
      }
      if (this.state === 'menu') return;
      if (code === 'KeyC') {
        this.camMode = (this.camMode + 1) % 3;
        this.hud.toast(['CHASE CAMERA', 'FAR CAMERA', 'COCKPIT CAMERA'][this.camMode], '', 1200);
      }
      if (code === 'KeyR' && (this.state === 'racing' || this.state === 'countdown')) {
        this.cars[this.playerIndex].respawn();
        this.hud.toast('CAR RESET', '', 1000);
      }
      if (code === 'Escape') this.backToMenu();
    });
  }

  renderLeaderboard() {
    const list = LB.top(10);
    const ol = $('lbList');
    if (!list.length) {
      ol.innerHTML = '<li class="empty">No records yet — set the first lap.</li>';
      return;
    }
    ol.innerHTML = list.map((e, i) => `
      <li>
        <span class="pos">${i + 1}</span>
        <span class="who">${escapeHtml(e.name)}</span>
        <span class="t">${formatTime(e.ms)}</span>
        <span class="when">${formatDate(e.date)}</span>
      </li>`).join('');
  }

  driverName() {
    const n = ($('driverName').value || 'PLAYER').trim().toUpperCase().slice(0, 12);
    try { localStorage.setItem('f1-mc-name', n); } catch { /* ignore */ }
    return n;
  }

  /* ------------------------------------------------------------------ states */
  start(mode) {
    this.audio.init();
    this.audio.resume();
    this.audio.setMuted(this.audio.muted);
    this.mode = mode;
    this.driver = this.driverName();

    // hide rival cars in time trial
    this.cars.forEach((c, i) => { c.mesh.visible = mode === 'race' || i === this.playerIndex; });
    this.aiActive = mode === 'race';

    this.resetGrid();
    this.raceTime = 0;
    this.sessionBest = null;
    this.finishDelay = -1;
    this.wrongWay = 0;

    this.state = 'countdown';
    this.countdown = 0;
    this.lightsOn = -1;

    $('menu').classList.add('hidden');
    this.hud.hideResults();
    this.hud.show();
    this.hud.showPositions(mode === 'race');
    this.hud.setLap(1, mode === 'race' ? RACE_LAPS : 0);
    this.hud.setTimes(0, 0, 0, null);
    this.hud.setStatus('');
    this.hud.showLights();
    this.hud.setLights(0);

    const player = this.cars[this.playerIndex];
    this.hud.toast(mode === 'race' ? 'FORM UP — 3 LAPS' : 'TIME TRIAL — PUSH!', '', 1800);
    this.camMode = 0;
    this.camera.fov = 55;
    this.camera.updateProjectionMatrix();
    this.snapCamera();
    void player;
  }

  backToMenu() {
    this.state = 'menu';
    this.audio.silence();
    this.hud.hide();
    this.hud.hideLights();
    this.hud.hideResults();
    $('menu').classList.remove('hidden');
    this.renderLeaderboard();
  }

  /* ------------------------------------------------------------------ loop */
  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(0.05, this.clock.getDelta());
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  update(dt) {
    if (this.state === 'menu') {
      this.menuAngle += dt * 0.045;
      const r = 640, a = this.menuAngle;
      this.camera.position.set(
        this.menuCenter.x + Math.cos(a) * r,
        230 + Math.sin(a * 0.7) * 40,
        this.menuCenter.z + Math.sin(a) * r,
      );
      this.camera.lookAt(this.menuCenter);
      this.audio.silence();
      return;
    }

    if (this.state === 'countdown') {
      this.countdown += dt;
      const step = Math.floor(this.countdown);
      if (step >= 1 && step <= 5 && step > this.lightsOn) {
        this.lightsOn = step;
        this.hud.setLights(step);
        this.audio.beep(560, 0.18, 0.22);
      }
      if (this.countdown >= 5.9) {
        this.hud.hideLights();
        this.state = 'racing';
        this.raceTime = 0;
        for (const car of this.cars) car.lapStart = 0;
        this.audio.beep(980, 0.5, 0.28, 'sawtooth');
        this.hud.toast('GO! GO! GO!', '', 1400);
      }
    }

    const racing = this.state === 'racing' || this.state === 'finished';
    // ms, not seconds: the HUD's formatTime, the leaderboard's {ms} entries and
    // the `lapTime > 3000` sanity gate all read this clock in milliseconds.
    if (racing) this.raceTime += dt * 1000;

    // ---- driving ----
    const player = this.cars[this.playerIndex];
    let playerSurface = null;
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      if (!car.mesh.visible) continue; // hidden rivals sit out time trial
      let ctrl;
      if (this.state === 'countdown') {
        // brake: 0, not 1 — car.js treats brake-at-standstill as "go into
        // reverse", so pinning the grid with brake:1 rolled the whole field
        // back down the straight at -14 m/s before the lights went out.
        ctrl = { throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false };
      } else if (i === this.playerIndex) {
        if (this.state === 'finished') ctrl = { throttle: 0, brake: 0.5, steer: 0, handbrake: false, boost: false };
        else ctrl = {
          throttle: this.input.throttle,
          brake: this.input.brake,
          // input.js gives D=+1 ("right"), but car.js's +steer turns left
          // (`yaw += steer*maxYaw` rotates forward toward +X, and forward at
          // yaw 0 is +Z, so the car's right is -X). ai.js closes its loop on
          // that same convention, so flip it here rather than in car.js.
          steer: -this.input.steer,
          handbrake: this.input.handbrake,
          boost: this.input.boost,
        };
      } else {
        ctrl = this.state === 'finished'
          ? { throttle: 0, brake: 0.5, steer: 0, handbrake: false, boost: false }
          : this.ai[i - 1].drive(dt, this.cars);   // ai[] is 0-based; cars[0] is the player
      }
      const surface = car.update(dt, ctrl);
      if (i === this.playerIndex) playerSurface = surface;
      if (racing) this.updateLaps(car, i === this.playerIndex, dt);
      this.emitSmoke(car, dt, surface, i === this.playerIndex);
    }

    if (racing) this.resolveContacts(dt);
    if (this.state === 'finished' && this.finishDelay > 0) {
      this.finishDelay -= dt;
      if (this.finishDelay <= 0) this.showRaceResults();
    }

    // ---- camera ----
    this.updateCamera(dt);

    // ---- sun follows the player ----
    this.sun.target.position.set(player.pos.x, 0, player.pos.y);
    this.sun.target.updateMatrixWorld();
    this.sun.position.set(
      player.pos.x + this.sunOffset.x,
      this.sunOffset.y,
      player.pos.y + this.sunOffset.z,
    );

    // ---- hud / audio ----
    this.updateHud(dt, player, playerSurface);
    this.particles.update(dt);
    this.thudCooldown = Math.max(0, this.thudCooldown - dt);
  }

  /* ------------------------------------------------------------------ laps */
  updateLaps(car, isPlayer, dt) {
    const tr = this.track;
    const prev = car.prevDist;
    const now = car.dist;
    const wrapped = now < prev - tr.length * 0.5;          // crossed the line, forwards
    const wrappedBack = now > prev + tr.length * 0.5;      // reversed over the line
    const crossedForward = wrapped;

    // checkpoints
    if (car.nextCheckpoint < tr.checkpointCount) {
      const cp = tr.checkpoints[car.nextCheckpoint];
      const hit = wrapped ? (cp > prev || cp <= now) : (cp > prev && cp <= now);
      if (hit) {
        car.splits[car.nextCheckpoint] = this.raceTime - car.lapStart;
        car.nextCheckpoint++;
        if (isPlayer && car.bestSplits.length) {
          const b = car.bestSplits[car.nextCheckpoint - 1];
          if (b != null) this.playerDelta = car.splits[car.nextCheckpoint - 1] - b;
        }
      }
    }

    // track limits — a graze is not a cut. Accumulate time off the road (and let it
    // decay back on it) so only a sustained excursion voids the lap.
    car.oobTime = car.oobTime || 0;
    car.oobPeak = car.oobPeak || 0;
    if (car.outOfBounds) {
      car.oobTime += dt;
      if (car.oobTime > car.oobPeak) car.oobPeak = car.oobTime;
    } else {
      car.oobTime = Math.max(0, car.oobTime - dt * 2);
    }
    if (car.oobTime > OOB_LIMIT && car.lapStarted) car.lapValid = false;

    if (crossedForward) {
      if (!car.lapStarted) {
        car.lapStarted = true;
        car.lapStart = this.raceTime;
        car.prevDist = now;
        return;
      }
      const lapTime = this.raceTime - car.lapStart;
      const hitAllSectors = car.nextCheckpoint >= tr.checkpointCount;
      const valid = car.lapValid && hitAllSectors;
      const why = car.lapValid ? 'MISSED SECTOR' : `OFF TRACK ${(car.oobPeak || 0).toFixed(1)}s`;
      const splits = car.splits.slice();
      car.lap++;
      car.splits = [];
      car.nextCheckpoint = 0;
      car.lapStart = this.raceTime;
      car.lapValid = true;
      car.oobTime = 0;
      car.oobPeak = 0;
      if (isPlayer) this.playerDelta = null;

      if (valid && lapTime > 3000) {
        car.lastLap = lapTime;
        if (!car.bestLap || lapTime < car.bestLap) {
          car.bestLap = lapTime;
          car.bestSplits = splits;
        }
        if (isPlayer) this.onPlayerLap(lapTime);
      } else if (isPlayer) {
        this.hud.toast(`LAP INVALIDATED — ${why}`, 'warn');
      }

      const total = this.mode === 'race' ? RACE_LAPS : 0;
      if (isPlayer) this.hud.setLap(Math.min(car.lap + 1, total || car.lap + 1), total);
      if (this.mode === 'race' && car.lap >= RACE_LAPS && !car.finished) {
        car.finished = true;
        car.finishTime = this.raceTime;
        if (isPlayer) {
          this.state = 'finished';
          this.finishDelay = 1.4;
          this.audio.beep(760, 0.6, 0.3, 'sawtooth');
        }
      }
    } else if (wrappedBack) {
      car.lap = Math.max(0, car.lap - 1);
    }
    car.prevDist = now;
  }

  onPlayerLap(lapTime) {
    const player = this.cars[this.playerIndex];
    this.hud.toast(`LAP ${formatTime(lapTime)}`, lapTime <= player.bestLap ? 'record' : '');
    const board = LB.top(10);
    const threshold = board.length === 10 ? board[9].ms : Infinity;
    if (lapTime < threshold) {
      const rank = LB.add(this.driver, lapTime);
      if (rank > 0) {
        this.renderLeaderboard();
        this.hud.toast(`P${rank} ON THE LEADERBOARD — ${formatTime(lapTime)}`, 'record', 3200);
      }
    }
  }

  resolveContacts(dt) {
    const p = this.cars[this.playerIndex];
    for (let i = 1; i < this.cars.length; i++) {
      const o = this.cars[i];
      // A car that is not on track is not solid. In time trial the rivals are
      // parked on the grid at the start line and skipped by the physics loop
      // (mesh.visible false), so without this the player ploughed into three
      // invisible stationary cars every time they crossed the line.
      if (!o.mesh.visible) continue;
      const dx = o.pos.x - p.pos.x;
      const dz = o.pos.y - p.pos.y;
      const d = Math.hypot(dx, dz);
      const min = 4.4;
      if (d < min && d > 0.0001) {
        const nx = dx / d, nz = dz / d;
        const push = (min - d) / 2;
        p.pos.x -= nx * push; p.pos.y -= nz * push;
        o.pos.x += nx * push; o.pos.y += nz * push;
        const rel = Math.abs((p.vel.x - o.vel.x) * nx + (p.vel.y - o.vel.y) * nz);
        p.vel.multiplyScalar(0.96);
        o.vel.multiplyScalar(0.98);
        if (rel > 6 && this.thudCooldown <= 0) {
          this.audio.thud(clamp(rel / 20, 0.3, 1.6));
          this.shake = Math.max(this.shake, clamp(rel / 40, 0.1, 0.5));
          this.thudCooldown = 0.35;
        }
      }
    }
    void dt;
  }

  emitSmoke(car, dt, surface, isPlayer) {
    car._smokeAcc = (car._smokeAcc || 0) + dt;
    const speed = Math.abs(car.forwardSpeed);
    const want = (car.slip > 0.3 && speed > 6) || (surface.off && speed > 8);
    if (!want) return;
    if (car._smokeAcc < 0.03) return;
    car._smokeAcc = 0;
    const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
    const rx = -fz, rz = fx;
    for (const side of [-1, 1]) {
      const x = car.pos.x - fx * 1.7 + rx * 0.9 * side;
      const z = car.pos.y - fz * 1.7 + rz * 0.9 * side;
      this.particles.emit(x, 0.25, z, -fx * speed * 0.12 + (Math.random() - 0.5), 0.6,
        -fz * speed * 0.12 + (Math.random() - 0.5), {
          color: surface.off ? 0xc4a783 : 0xd9d9de,
          size: surface.off ? 0.9 : 0.65,
          life: surface.off ? 1.0 : 0.7,
          grow: 2.6,
        });
    }
    void isPlayer;
  }

  /* ------------------------------------------------------------------ camera */
  snapCamera() {
    const car = this.cars[this.playerIndex];
    const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
    this.camera.position.set(car.pos.x - fx * 9, 3.1, car.pos.y - fz * 9);
    this.camera.lookAt(car.pos.x, 1.2, car.pos.y);
  }

  updateCamera(dt) {
    const car = this.cars[this.playerIndex];
    const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
    const rx = -fz, rz = fx;
    const speedT = clamp(Math.abs(car.forwardSpeed) / 94, 0, 1);
    const target = new THREE.Vector3();
    let look = new THREE.Vector3();

    if (this.camMode === 2) {
      // cockpit
      target.set(car.pos.x + fx * 0.2, 1.08, car.pos.y + fz * 0.2);
      this.camera.position.lerp(target, 1 - Math.exp(-30 * dt));
      look.set(car.pos.x + fx * 40, 1.4 + car.slip * 0.6, car.pos.y + fz * 40);
      this.camera.up.set(rx * car.slip * 0.25, 1, rz * car.slip * 0.25).normalize();
      this.camera.lookAt(look);
      this.camera.fov = 62 + speedT * 10;
    } else {
      const dist = this.camMode === 1 ? 15 : 8.6 + speedT * 1.8;
      const height = this.camMode === 1 ? 6.4 : 3.0 + speedT * 0.5;
      // lead the cornering slightly
      const lead = car.lateral * 0.12;
      target.set(
        car.pos.x - fx * dist + rx * lead,
        height,
        car.pos.y - fz * dist + rz * lead,
      );
      this.camera.position.lerp(target, 1 - Math.exp(-6.5 * dt));
      look.set(car.pos.x + fx * 8, 1.3, car.pos.y + fz * 8);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(look);
      this.camera.fov = (this.camMode === 1 ? 52 : 56) + speedT * 14;
    }

    // shake: kerbs, hits, speed
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const rumble = (car.onKerb ? 0.10 : 0) + this.shake + speedT * car.slip * 0.06;
    if (rumble > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * rumble * 0.7;
      this.camera.position.y += (Math.random() - 0.5) * rumble * 0.5;
      this.camera.position.z += (Math.random() - 0.5) * rumble * 0.7;
    }
    if (car.hit > 3 && this.thudCooldown <= 0.05) {
      this.shake = Math.max(this.shake, clamp(car.hit / 30, 0.15, 0.6));
      this.audio.thud(clamp(car.hit / 25, 0.3, 1.5));
      this.thudCooldown = 0.4;
    }
    this.camera.updateProjectionMatrix();
  }

  /* ------------------------------------------------------------------ hud */
  updateHud(dt, player, surface) {
    const started = player.lapStarted;
    const current = started ? this.raceTime - player.lapStart : 0;
    this.hud.setTimes(current, player.lastLap, player.bestLap, this.playerDelta ?? null);
    this.hud.setErs(player.ers);

    // status text
    let status = '';
    let warn = false;
    if (player.outOfBounds) { status = 'OFF TRACK — LAP VOID'; warn = true; }
    else if (this.wrongWay > 0.9) { status = '⚠ WRONG WAY'; warn = true; }
    else if (player.boosting) { status = 'ERS DEPLOYED'; }
    this.hud.setStatus(status, warn);

    // wrong way
    const s = this.track.sampleAt(player.dist);
    const dot = player.vel.x * s.tx + player.vel.y * s.tz;
    if (dot < -4) this.wrongWay += dt; else this.wrongWay = 0;

    // speedo
    const maxSpeed = player.params.maxSpeed;
    const gearSpan = maxSpeed / 7;
    const gear = player.forwardSpeed < -0.5 ? 0 : clamp(Math.floor(Math.abs(player.forwardSpeed) / gearSpan) + 1, 1, 7);
    const rpm = clamp(0.22 + (Math.abs(player.forwardSpeed) % gearSpan) / gearSpan * 0.78, 0, 1);
    this.hud.drawGauge({
      speedKmh: Math.abs(player.forwardSpeed) * 3.6,
      rpm: clamp(rpm + (player.boosting ? 0.15 : 0), 0, 1),
      gear,
      boost: player.boosting,
    });

    // position + gaps
    if (this.mode === 'race') {
      const order = this.order();
      const pos = order.indexOf(player) + 1;
      this.hud.el.pos.textContent = `P${pos}`;
      this.hud.el.posSub.textContent = pos === 1 ? 'LEADER' : 'POSITION';
      const refLap = player.lastLap || 62000;
      const secsFor = (dist) => (dist / this.track.length) * (refLap / 1000);
      let gapText = '';
      if (pos > 1) {
        const ahead = order[pos - 2];
        gapText = `+${secsFor(ahead.totalDistance - player.totalDistance).toFixed(3)}s to ${this.nameOf(ahead)}`;
      } else if (order.length > 1) {
        const behind = order[1];
        gapText = `+${secsFor(player.totalDistance - behind.totalDistance).toFixed(3)}s to ${this.nameOf(behind)}`;
      }
      this.hud.el.gap.textContent = gapText;
    }

    // minimap
    this.hud.drawMinimap(this.cars.filter((c) => c.mesh.visible), this.playerIndex, this.colors);

    // audio
    const gearRPM = clamp(0.22 + (Math.abs(player.forwardSpeed) % gearSpan) / gearSpan * 0.78, 0, 1);
    this.audio.update(
      this.state === 'racing' || this.state === 'finished' ? gearRPM : 0.12,
      this.input.throttle,
      clamp(Math.abs(player.forwardSpeed) / 94, 0, 1),
      surface ? clamp(player.slip + (surface.off ? 0.4 : 0), 0, 1) : player.slip,
      dt,
    );
  }

  nameOf(car) {
    if (car === this.cars[this.playerIndex]) return this.driver || 'YOU';
    const i = this.cars.indexOf(car);
    return AI_DRIVERS[i - 1]?.name || 'RIVAL';
  }

  order() {
    return [...this.cars]
      .filter((c) => c.mesh.visible)
      .sort((a, b) => {
        if (a.finished && b.finished) return a.finishTime - b.finishTime;
        if (a.finished) return -1;
        if (b.finished) return 1;
        return b.totalDistance - a.totalDistance;
      });
  }

  showRaceResults() {
    const order = this.order();
    const player = this.cars[this.playerIndex];
    const refLap = player.lastLap || 62000;
    const rows = order.map((car, i) => {
      const me = car === player;
      let time;
      if (car.finished) time = formatTime(car.finishTime);
      else {
        const gap = player.totalDistance - car.totalDistance;
        time = `+${((gap / this.track.length) * (refLap / 1000)).toFixed(3)}s`;
      }
      return `<div class="rrow ${me ? 'me' : ''}">
        <span class="rp">${i + 1}</span>
        <span class="rn">${escapeHtml(this.nameOf(car))}${me ? ' (YOU)' : ''}</span>
        <span class="rt">${time}</span>
      </div>`;
    }).join('');
    const playerPos = order.indexOf(player) + 1;
    const note = `<div class="note">Best lap: ${formatTime(player.bestLap)} · Total: ${formatTime(player.finishTime)}</div>`;
    this.hud.showResults(
      playerPos === 1 ? 'P1 — VICTORY' : `FINISHED P${playerPos}`,
      'CLASSIFICATION',
      rows + note,
    );
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

const game = new Game();
game.init();
window.game = game;
