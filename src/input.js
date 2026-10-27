// Keyboard input.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set(); // one-shot: true only on the frame the key went down
    this._onKey = null;

    this._down = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const code = e.code;
      if (!this.keys.has(code)) this.pressed.add(code);
      this.keys.add(code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(code)) {
        e.preventDefault();
      }
      if (this._onKey) this._onKey(code, e);
    };
    this._up = (e) => { this.keys.delete(e.code); };
    this._blur = () => { this.keys.clear(); this.pressed.clear(); };

    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup', this._up);
    window.addEventListener('blur', this._blur);
  }

  onKey(fn) { this._onKey = fn; }

  has(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }

  // Analogue-ish controls from WASD / arrows.
  get throttle() { return (this.has('KeyW') || this.has('ArrowUp')) ? 1 : 0; }
  get brake() { return (this.has('KeyS') || this.has('ArrowDown')) ? 1 : 0; }
  get steer() {
    const l = this.has('KeyA') || this.has('ArrowLeft');
    const r = this.has('KeyD') || this.has('ArrowRight');
    return (r ? 1 : 0) - (l ? 1 : 0);
  }
  get handbrake() { return this.has('Space'); }
  get boost() { return this.has('ShiftLeft') || this.has('ShiftRight'); }

  endFrame() { this.pressed.clear(); }
}
