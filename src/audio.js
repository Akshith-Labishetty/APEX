// Synthesised engine + environment audio (no samples needed).
export class GameAudio {
  constructor() {
    this.ready = false;
    this.muted = false;
    this.ctx = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.0;
    master.connect(ctx.destination);
    this.master = master;

    // --- engine: three detuned saws through a lowpass ---
    const engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 3;
    engineGain.connect(filter);
    filter.connect(master);

    const oscs = [];
    const types = ['sawtooth', 'sawtooth', 'square'];
    const gains = [0.5, 0.3, 0.16];
    const detunes = [0, 7, -5];
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      o.type = types[i];
      o.frequency.value = 80;
      o.detune.value = detunes[i];
      const g = ctx.createGain();
      g.gain.value = gains[i];
      o.connect(g); g.connect(engineGain);
      o.start();
      oscs.push(o);
    }
    this.oscs = oscs;
    this.engineGain = engineGain;
    this.filter = filter;

    // --- tyre screech: filtered noise ---
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = noiseBuf;

    const screechSrc = ctx.createBufferSource();
    screechSrc.buffer = noiseBuf; screechSrc.loop = true;
    const screechFilter = ctx.createBiquadFilter();
    screechFilter.type = 'bandpass';
    screechFilter.frequency.value = 2400;
    screechFilter.Q.value = 6;
    this.screechGain = ctx.createGain();
    this.screechGain.gain.value = 0;
    screechSrc.connect(screechFilter); screechFilter.connect(this.screechGain);
    this.screechGain.connect(master);
    screechSrc.start();

    // --- wind ---
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noiseBuf; windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 600;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    windSrc.connect(windFilter); windFilter.connect(this.windGain);
    this.windGain.connect(master);
    windSrc.start();

    this.ready = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
    }
  }

  /**
   * @param {number} rpm 0..1
   * @param {number} load 0..1 throttle
   * @param {number} speed 0..1 normalised speed
   * @param {number} slip 0..1 wheel slip
   */
  update(rpm, load, speed, slip, dt) {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime;
    const base = 48 + rpm * 205;
    this.oscs[0].frequency.setTargetAtTime(base, t, 0.02);
    this.oscs[1].frequency.setTargetAtTime(base * 1.5, t, 0.02);
    this.oscs[2].frequency.setTargetAtTime(base * 2.01, t, 0.02);
    this.filter.frequency.setTargetAtTime(420 + rpm * 2600 + load * 900, t, 0.04);
    this.engineGain.gain.setTargetAtTime(0.10 + load * 0.16 + rpm * 0.10, t, 0.04);
    this.screechGain.gain.setTargetAtTime(Math.min(1, slip) * 0.14, t, 0.05);
    this.windGain.gain.setTargetAtTime(speed * speed * 0.10, t, 0.1);
  }

  silence() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(0, t, 0.08);
    this.screechGain.gain.setTargetAtTime(0, t, 0.05);
    this.windGain.gain.setTargetAtTime(0, t, 0.1);
  }

  beep(freq = 680, dur = 0.12, vol = 0.25, type = 'square') {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = 0;
    o.connect(g); g.connect(this.master);
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  thud(strength = 1) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 260;
    const g = ctx.createGain();
    src.connect(f); f.connect(g); g.connect(this.master);
    const t = ctx.currentTime;
    g.gain.setValueAtTime(Math.min(0.5, 0.22 * strength), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    src.start(t);
    src.stop(t + 0.3);
  }
}
