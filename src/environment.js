// The city around the circuit: ground, harbour, buildings, grandstands, trees, yachts.
import * as THREE from 'three';
import { groundTexture, facadeTexture, crowdTexture, glowTexture } from './textures.js';
import { mulberry32 } from './util.js';

const HARBOUR = { x0: 55, x1: 445, z0: 582, z1: 678 };

export function buildEnvironment(scene, track) {
  const rnd = mulberry32(2026);

  /* ---------------- ground ---------------- */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(5200, 5200),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);

  /* ---------------- harbour water ---------------- */
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(HARBOUR.x1 - HARBOUR.x0, HARBOUR.z1 - HARBOUR.z0),
    new THREE.MeshStandardMaterial({
      color: 0x0d7fb8, roughness: 0.08, metalness: 0.85,
      transparent: true, opacity: 0.96,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set((HARBOUR.x0 + HARBOUR.x1) / 2, -0.35, (HARBOUR.z0 + HARBOUR.z1) / 2);
  scene.add(water);

  // quay wall around the harbour so the water reads as a marina
  const quayMat = new THREE.MeshStandardMaterial({ color: 0xa89b82, roughness: 0.95 });
  const quayGeo = new THREE.BoxGeometry(1, 1.4, 1);
  const quay = [
    [(HARBOUR.x0 + HARBOUR.x1) / 2, HARBOUR.z0 - 1.5, HARBOUR.x1 - HARBOUR.x0 + 6, 3],
    [(HARBOUR.x0 + HARBOUR.x1) / 2, HARBOUR.z1 + 1.5, HARBOUR.x1 - HARBOUR.x0 + 6, 3],
  ];
  for (const [cx, cz, w, d] of quay) {
    const m = new THREE.Mesh(quayGeo, quayMat);
    m.scale.set(w, 1, d);
    m.position.set(cx, 0.2, cz);
    m.receiveShadow = true;
    scene.add(m);
  }

  /* ---------------- track proximity helper ---------------- */
  const coarse = track.samples.filter((_, i) => i % 4 === 0);
  const distToTrack = (x, z) => {
    let best = Infinity;
    for (const s of coarse) {
      const d = (s.x - x) ** 2 + (s.z - z) ** 2;
      if (d < best) best = d;
      if (best < 100) return 0;
    }
    return Math.sqrt(best);
  };
  const onWater = (x, z, pad = 0) =>
    x > HARBOUR.x0 - pad && x < HARBOUR.x1 + pad && z > HARBOUR.z0 - pad && z < HARBOUR.z1 + pad;

  /* ---------------- buildings ---------------- */
  const classes = [
    // repeatX/Y chosen so windows stay roughly the same size per class
    { size: [7, 14], h: [8, 16], tex: facadeTexture(11, '#cfc4ad', '#8fd0e6'), rep: [2, 3] },
    { size: [12, 22], h: [16, 34], tex: facadeTexture(23, '#e4e0d6', '#9fd8ea'), rep: [3, 5] },
    { size: [20, 38], h: [26, 64], tex: facadeTexture(37, '#2f3a49', '#6fd2ff'), rep: [4, 8] },
  ];
  const candidates = { 0: [], 1: [], 2: [] };
  for (let x = -1000; x <= 1150; x += 42) {
    for (let z = -650; z <= 1300; z += 42) {
      const px = x + (rnd() - 0.5) * 22;
      const pz = z + (rnd() - 0.5) * 22;
      if (distToTrack(px, pz) < 21) continue;
      if (onWater(px, pz, 14)) continue;
      // pit complex + grandstand apron along the main straight
      if (px > -300 && px < 260 && pz > -60 && pz < 70) continue;
      const d = distToTrack(px, pz);
      const r = rnd();
      const cls = d > 260 ? (r > 0.55 ? 2 : 1) : d > 60 ? (r > 0.4 ? 1 : 0) : 0;
      candidates[cls].push([px, pz, d]);
    }
  }

  const box = new THREE.BoxGeometry(1, 1, 1);
  const dummy = new THREE.Object3D();
  classes.forEach((cls, ci) => {
    const list = candidates[ci];
    if (!list.length) return;
    const tex = cls.tex;
    tex.repeat.set(cls.rep[0], cls.rep[1]);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.05 });
    const mesh = new THREE.InstancedMesh(box, mat, list.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    for (let i = 0; i < list.length; i++) {
      const [px, pz, d] = list[i];
      const w = cls.size[0] + rnd() * (cls.size[1] - cls.size[0]);
      const dep = cls.size[0] + rnd() * (cls.size[1] - cls.size[0]);
      const h = cls.h[0] + rnd() * (cls.h[1] - cls.h[0]) * (d > 300 ? 1.4 : 1);
      dummy.position.set(px, h / 2 - 0.1, pz);
      dummy.rotation.set(0, (rnd() < 0.5 ? 0 : Math.PI / 2) + (rnd() - 0.5) * 0.12, 0);
      dummy.scale.set(w, h, dep);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  });

  /* ---------------- pit complex ---------------- */
  const pitMat = new THREE.MeshStandardMaterial({ color: 0xdad6cc, roughness: 0.8 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x18344a, roughness: 0.15, metalness: 0.85, emissive: 0x0b2334, emissiveIntensity: 0.6,
  });
  const pit = new THREE.Group();
  const pitBody = new THREE.Mesh(new THREE.BoxGeometry(230, 11, 16), pitMat);
  pitBody.position.set(0, 5.5, 0);
  pitBody.castShadow = true;
  pitBody.receiveShadow = true;
  pit.add(pitBody);
  const pitGlass = new THREE.Mesh(new THREE.BoxGeometry(226, 4.2, 0.5), glassMat);
  pitGlass.position.set(0, 7.6, -8.1);
  pit.add(pitGlass);
  const garage = new THREE.Mesh(new THREE.BoxGeometry(226, 3.4, 0.4), glassMat);
  garage.position.set(0, 1.8, -8.2);
  pit.add(garage);
  pit.position.set(-20, 0, 34);
  scene.add(pit);

  /* ---------------- grandstands ---------------- */
  const crowd = crowdTexture();
  crowd.repeat.set(6, 1);
  const seatMat = new THREE.MeshStandardMaterial({ map: crowd, roughness: 0.95 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.7, metalness: 0.4 });

  function stand(x, z, len, yaw) {
    const g = new THREE.Group();
    const seating = new THREE.Mesh(new THREE.BoxGeometry(len, 1, 13), seatMat);
    seating.rotation.x = -0.36;
    seating.position.set(0, 3.1, 0);
    seating.castShadow = true;
    g.add(seating);
    const back = new THREE.Mesh(new THREE.BoxGeometry(len, 8.4, 1.2), frameMat);
    back.position.set(0, 4.2, 6.6);
    back.castShadow = true;
    g.add(back);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(len + 2, 0.5, 15), frameMat);
    roof.position.set(0, 9.4, 0.5);
    roof.castShadow = true;
    g.add(roof);
    for (let i = -1; i <= 1; i += 2) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 9, 0.6), frameMat);
      pillar.position.set(i * (len / 2 - 1), 4.7, 7);
      g.add(pillar);
    }
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    scene.add(g);
    return g;
  }

  stand(-40, -26, 110, 0);
  stand(110, -28, 90, 0);
  stand(-190, 772, 120, Math.PI);          // outside the swimming-pool straight
  stand(330, 402, 90, Math.PI * 0.92);     // above Casino

  /* ---------------- trees ---------------- */
  const treeCount = 150;
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 2.4, 6);
  const leafGeo = new THREE.ConeGeometry(1.9, 5.2, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f9445, roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, treeCount);
  leaves.castShadow = true;
  let placed = 0;
  for (let i = 0; i < treeCount * 8 && placed < treeCount; i++) {
    const px = -700 + rnd() * 1500;
    const pz = -400 + rnd() * 1400;
    if (distToTrack(px, pz) < 15) continue;
    if (onWater(px, pz, 8)) continue;
    if (px > -300 && px < 260 && pz > -60 && pz < 70) continue;
    const s = 0.75 + rnd() * 0.7;
    dummy.position.set(px, 1.2 * s, pz);
    dummy.rotation.set(0, rnd() * 6.28, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);
    dummy.position.y = (2.4 + 2.6) * s;
    dummy.updateMatrix();
    leaves.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  trunks.count = placed;
  leaves.count = placed;
  scene.add(trunks, leaves);

  /* ---------------- yachts ---------------- */
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, roughness: 0.35, metalness: 0.2 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.3, metalness: 0.6 });
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    const len = 14 + rnd() * 12;
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.8, len), hullMat);
    hull.position.y = 0.4;
    hull.castShadow = true;
    g.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.6, 4), hullMat);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.position.set(0, 0.4, len / 2 + 1.6);
    g.add(bow);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, len * 0.45), cabinMat);
    cabin.position.set(0, 1.9, -len * 0.1);
    g.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 7, 6), hullMat);
    mast.position.set(0, 4.5, len * 0.2);
    g.add(mast);
    g.position.set(HARBOUR.x0 + 30 + rnd() * (HARBOUR.x1 - HARBOUR.x0 - 60), -0.4,
      HARBOUR.z0 + 20 + rnd() * (HARBOUR.z1 - HARBOUR.z0 - 40));
    g.rotation.y = (rnd() < 0.5 ? 0 : Math.PI) + (rnd() - 0.5) * 0.3;
    scene.add(g);
  }

  /* ---------------- sun glow ---------------- */
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: 0xfff6d8, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  sunSprite.scale.set(900, 900, 1);
  sunSprite.position.set(-2600, 620, -2100);
  scene.add(sunSprite);

  return { water };
}
