// Sky, sun and ambient light from the real solar position; haze and cloud fog from the weather;
// rain/snow particles; a sky environment map (for lake reflections) refreshed as the sun moves.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { sunPosition } from '../systems/Weather.js';

const DEG = Math.PI / 180;

export class Environment {
  constructor(renderer, scene) {
    this.renderer = renderer; this.scene = scene;
    this.sky = new Sky();
    this.sky.scale.setScalar(150000);
    scene.add(this.sky);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 4; u.rayleigh.value = 1.4; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.8;
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = this.sun.shadow.camera; s.left = -110; s.right = 110; s.top = 110; s.bottom = -110; s.near = 10; s.far = 2000;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun); scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbcd2e8, 0x4a4434, 0.8);
    scene.add(this.hemi);
    scene.fog = new THREE.Fog(0xb8c6d2, 4000, 90000);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.skyScene = new THREE.Scene();
    this.skyClone = new Sky(); this.skyClone.scale.setScalar(1000); this.skyScene.add(this.skyClone);
    this.lastEnvSun = null; this.envTarget = null;
    this.rain = makeRain(scene);
  }
  apply(simT, world, w, px, py, pz, terrainMat) {
    const [lat, lon] = world.toLatLon(px, pz);
    const sun = sunPosition(simT, lat, lon);
    const alt = sun.alt, az = sun.az;
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt));
    const u = this.sky.material.uniforms;
    u.sunPosition.value.copy(dir);
    u.turbidity.value = 3 + w.cloud * 9;
    u.rayleigh.value = 1.2 + w.cloud * 1.5;
    const day = THREE.MathUtils.smoothstep(alt / DEG, -6, 8);
    const low = 1 - THREE.MathUtils.smoothstep(alt / DEG, 2, 25);
    this.sun.position.set(px + dir.x * 600, py + Math.max(0.05, dir.y) * 600, pz + dir.z * 600);
    this.sun.target.position.set(px, py, pz);
    this.sun.intensity = 3.2 * day * (1 - w.cloud * 0.7);
    this.sun.color.setRGB(1, 0.92 - low * 0.25, 0.82 - low * 0.42);
    this.hemi.intensity = 0.22 + 0.95 * day;
    this.hemi.color.setRGB(0.55 + 0.2 * day, 0.62 + 0.2 * day, 0.75 + 0.15 * day);
    this.renderer.toneMappingExposure = 0.30 + 0.32 * day;
    const fogC = new THREE.Color().setRGB(0.05 + 0.65 * day, 0.07 + 0.70 * day, 0.10 + 0.74 * day);
    if (low > 0.3 && day > 0.2) fogC.lerp(new THREE.Color(0.9, 0.7, 0.55), low * 0.35);
    const inCloud = w.base < py + 40;
    if (inCloud) {
      const k = Math.min(1, (py + 40 - w.base) / 150);
      this.scene.fog.near = 2; this.scene.fog.far = THREE.MathUtils.lerp(900, 70, k);
      fogC.setRGB(0.55 * day + 0.05, 0.58 * day + 0.05, 0.6 * day + 0.06);
    } else {
      const vis = 120000 * (1 - w.cloud * 0.45) * (w.precip > 0.1 ? 0.25 : 1);
      this.scene.fog.near = vis * 0.04; this.scene.fog.far = vis;
    }
    this.scene.fog.color.copy(fogC);
    this.sky.visible = !inCloud || this.scene.fog.far > 600;
    this.scene.background = fogC;
    if (terrainMat) terrainMat.userData.uniforms.uWetness.value = Math.min(1, w.precip * 0.6);
    // refresh the reflection environment when the sun has moved a few degrees
    if (!this.lastEnvSun || this.lastEnvSun.angleTo(dir) > 3 * DEG) {
      const cu = this.skyClone.material.uniforms;
      for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) cu[k].value = u[k].value;
      cu.sunPosition.value.copy(dir);
      if (this.envTarget) this.envTarget.dispose();
      this.envTarget = this.pmrem.fromScene(this.skyScene, 0, 1, 2000);
      // only water reflects the sky; lighting everything with it washes the landscape out
      for (const m of this.reflective || []) { m.envMap = this.envTarget.texture; m.envMapIntensity = 0.3 + 0.9 * day; m.needsUpdate = true; }
      this.lastEnvSun = dir.clone();
    }
    return { sun, day, inCloud };
  }
  updatePrecip(cam, w, temp, active) {
    const p = this.rain;
    p.visible = w.precip > 0.05 && active;
    if (!p.visible) return;
    const snow = temp < 0.8;
    p.material.size = snow ? 0.16 : 0.07; p.material.color.set(snow ? 0xffffff : 0xb9c6d1);
    const fall = snow ? 0.04 : 0.45, a = p.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) { let y = a.getY(i) - fall * (0.6 + (i % 7) * 0.08); if (y < 0) y += 30; a.setY(i, y); }
    a.needsUpdate = true;
    p.position.set(cam.position.x, cam.position.y - 15, cam.position.z);
  }
  dispose() { this.envTarget?.dispose(); this.pmrem.dispose(); }
}

function makeRain(scene, n = 4000) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 60; pos[i * 3 + 1] = Math.random() * 30; pos[i * 3 + 2] = (Math.random() - 0.5) * 60; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfd8e0, size: 0.08, transparent: true, opacity: 0.6, depthWrite: false }));
  p.frustumCulled = false; p.visible = false;
  scene.add(p);
  return p;
}
