// Lightweight sprite-based particle pool for tyre smoke and dust.
import * as THREE from 'three';
import { glowTexture } from './textures.js';

export class ParticleSystem {
  constructor(scene, max = 80) {
    this.pool = [];
    this.cursor = 0;
    const map = glowTexture();
    for (let i = 0; i < max; i++) {
      const material = new THREE.SpriteMaterial({
        map, transparent: true, opacity: 0, depthWrite: false,
        color: 0xffffff,
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      scene.add(sprite);
      this.pool.push({ sprite, life: 0, ttl: 1, vel: new THREE.Vector3(), grow: 1, startSize: 1 });
    }
    this._lastEmit = 0;
  }

  emit(x, y, z, vx, vy, vz, { color = 0xd8d8d8, size = 0.8, life = 0.8, grow = 2.4, jitter = 0.5 } = {}) {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    p.sprite.visible = true;
    p.sprite.position.set(
      x + (Math.random() - 0.5) * jitter,
      y + Math.random() * jitter * 0.5,
      z + (Math.random() - 0.5) * jitter,
    );
    p.vel.set(vx, vy, vz);
    p.life = p.ttl = life * (0.75 + Math.random() * 0.5);
    p.grow = grow;
    p.startSize = size;
    p.sprite.material.color.setHex(color);
    p.sprite.material.opacity = 0.5;
    p.sprite.scale.setScalar(size);
  }

  update(dt) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        p.sprite.material.opacity = 0;
        continue;
      }
      const k = p.life / p.ttl;
      p.sprite.position.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(1 - 1.6 * dt);
      p.vel.y += 0.5 * dt;
      p.sprite.scale.setScalar(p.startSize * (1 + (1 - k) * p.grow));
      p.sprite.material.opacity = 0.5 * k * k;
    }
  }

  clear() {
    for (const p of this.pool) {
      p.life = 0;
      p.sprite.visible = false;
      p.sprite.material.opacity = 0;
    }
  }
}
