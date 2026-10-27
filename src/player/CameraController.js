// Third-person orbit camera with terrain collision, and a first-person photo camera with zoom.
import * as THREE from 'three';

export class CameraRig {
  constructor(camera, dom, settings) {
    this.cam = camera; this.settings = settings; this.world = null;
    this.yaw = 0; this.pitch = 0.3; this.dist = 9;
    this.mode = 'third';
    this.pyaw = 0; this.ppitch = 0; this.fov = 55; this.minFov = 25;
    this.dragging = false; this.dragMoved = 0;
    this.smooth = new THREE.Vector3(); this.first = true;
    dom.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') return; this.dragging = true; this.dragMoved = 0; this.lx = e.clientX; this.ly = e.clientY; dom.setPointerCapture(e.pointerId); });
    dom.addEventListener('pointerup', e => { this.dragging = false; try { dom.releasePointerCapture(e.pointerId); } catch {} });
    dom.addEventListener('pointermove', e => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lx, dy = e.clientY - this.ly; this.lx = e.clientX; this.ly = e.clientY;
      this.dragMoved += Math.abs(dx) + Math.abs(dy);
      this.look(dx, dy);
    });
    dom.addEventListener('wheel', e => { e.preventDefault(); this.zoom(e.deltaY > 0 ? 1 : -1); }, { passive: false });
    dom.addEventListener('contextmenu', e => e.preventDefault());
  }
  look(dx, dy) {
    const s = this.settings.sensitivity || 1, inv = this.settings.invertY ? -1 : 1;
    if (this.mode === 'photo') {
      const k = this.fov / 55 * 0.0035 * s;
      this.pyaw -= dx * k; this.ppitch = Math.max(-1.2, Math.min(1.2, this.ppitch - dy * k * inv));
    } else {
      this.yaw -= dx * 0.005 * s; this.pitch = Math.max(-0.2, Math.min(1.45, this.pitch + dy * 0.004 * s * inv));
    }
  }
  zoom(dir) {
    if (this.mode === 'photo') this.fov = Math.max(this.minFov, Math.min(75, this.fov * (dir > 0 ? 1.1 : 0.9)));
    else this.dist = Math.max(2.8, Math.min(400, this.dist * (dir > 0 ? 1.12 : 0.89)));
  }
  enterPhoto(maxZoom = 2) { this.mode = 'photo'; this.pyaw = this.yaw; this.ppitch = 0.02; this.fov = 50; this.minFov = 50 / maxZoom; }
  exitPhoto() { this.mode = 'third'; this.cam.fov = 55; this.cam.updateProjectionMatrix(); }
  update(px, py, pz, dt = 0.016) {
    const c = this.cam;
    if (this.mode === 'photo') {
      c.position.set(px, py + 1.65, pz);
      const dir = new THREE.Vector3(-Math.sin(this.pyaw) * Math.cos(this.ppitch), Math.sin(this.ppitch), -Math.cos(this.pyaw) * Math.cos(this.ppitch));
      c.lookAt(c.position.clone().add(dir));
      if (c.fov !== this.fov) { c.fov = this.fov; c.updateProjectionMatrix(); }
      return;
    }
    // follow point is smoothed so terrain bumps do not jolt the view
    const target = new THREE.Vector3(px, py + 1.45, pz);
    if (this.first) { this.smooth.copy(target); this.first = false; }
    this.smooth.lerp(target, Math.min(1, dt * 10));
    let d = this.dist;
    const dirx = Math.sin(this.yaw) * Math.cos(this.pitch), diry = Math.sin(this.pitch), dirz = Math.cos(this.yaw) * Math.cos(this.pitch);
    // pull the camera in if the terrain (or a hut) blocks the line to the player
    if (this.world) {
      for (let t = 0.15; t <= 1; t += 0.1) {
        const x = this.smooth.x + dirx * d * t, y = this.smooth.y + diry * d * t, z = this.smooth.z + dirz * d * t;
        if (this.world.height(x, z) + 0.6 > y) { d = Math.max(2.2, d * t * 0.9); break; }
      }
    }
    let cx = this.smooth.x + dirx * d, cy = this.smooth.y + diry * d, cz = this.smooth.z + dirz * d;
    if (this.world) cy = Math.max(cy, this.world.height(cx, cz) + 1.0);
    c.position.set(cx, cy, cz);
    c.lookAt(this.smooth);
  }
}
