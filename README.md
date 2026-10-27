# 🏎️ GP MONTE-CARLO

> **A high-octane, browser-based 3D Formula 1 arcade racer set on Monaco's legendary street circuit.**  
> Built with pure **Three.js** & vanilla JavaScript — zero dependencies, zero build steps, 100% procedurally generated.

---

## ⚡ Quick Start

Launch the local zero-dependency server:

```bash
npm start
```
Then open **[http://localhost:5173](http://localhost:5173)** in any modern browser.

*(Alternatively: `python -m http.server 5173` — requires an HTTP server for ES modules).*

---

## 🎮 Controls

| Key | Action |
|:---:|---|
| <kbd>W</kbd> | Throttle / Accelerate |
| <kbd>S</kbd> | Brake / Reverse |
| <kbd>A</kbd> / <kbd>D</kbd> | Steer Left / Right |
| <kbd>Space</kbd> | Handbrake (Drift) |
| <kbd>Shift</kbd> | ERS Overtake Boost |
| <kbd>C</kbd> | Switch Camera *(Chase · Far · Cockpit)* |
| <kbd>R</kbd> | Reset Car to Track |
| <kbd>M</kbd> | Mute / Unmute Audio |
| <kbd>Esc</kbd> | Return to Menu |

---

## 🏆 Game Modes

- ⏱️ **Time Trial**: Clean air, infinite laps. Chase personal records with live sector deltas and local persistent leaderboards.
- 🏁 **Grand Prix**: 3-lap wheel-to-wheel race against 3 aggressive AI rivals with full grid positions and podium results.

---

## ✨ Features & Highlights

- 🏙️ **Authentic Monaco Street Circuit**: 3.3 km layout featuring Sainte Dévote, Massenet, the Casino climb, Loews Hairpin, the Tunnel, and Swimming Pool chicane.
- 🎨 **100% Procedural**: Track ribbons, 3D buildings, yachts, kerbs, barriers, and textures are dynamically generated in-code — zero external asset downloads.
- 🏎️ **Arcade-Sim Physics**: Slip angles, kerb vibrations, tyre smoke particles, wall damage collisions, and active ERS battery deployment.
- 🔊 **Procedural WebAudio**: Real-time synthesized engine roar mapped directly to throttle and RPM harmonics.
- 📊 **F1 Broadcast HUD**: Live mini-map radar, gear & RPM gauges, ERS energy bar, and delta timing tracker.

---

## 🛠️ Tech Stack

- **Graphics**: [Three.js](https://threejs.org/) (r160 vendored)
- **Audio**: Web Audio API (real-time synthesis)
- **Architecture**: Modular ES6 modules & vanilla HTML5 / CSS3
- **Storage**: Browser `localStorage` for fastest lap persistence
