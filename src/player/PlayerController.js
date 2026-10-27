// The walker: a slightly simplified human figure with natural proportions (about 1.75 m), jointed limbs
// and a procedural gait that responds to pace, slope and load. Movement itself is integrated in Game.
import * as THREE from 'three';

function seg(len, r0, r1, mat, sides = 10) {
  // limb segment hanging down from its joint (pivot at the top)
  const g = new THREE.CylinderGeometry(r0, r1, len, sides, 1);
  g.translate(0, -len / 2, 0);
  const m = new THREE.Mesh(g, mat);
  const pivot = new THREE.Group(); pivot.add(m);
  return pivot;
}
function joint(r, mat) { return new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat); }

export class Hiker {
  constructor(scene, jacketColor = 0xb5502b) {
    const root = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xd2a07a, roughness: 0.75 });
    this.jacketMat = new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.75 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.9 });
    const bootM = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.8 });
    const packM = new THREE.MeshStandardMaterial({ color: 0x3d5a4a, roughness: 0.85 });
    const hatM = new THREE.MeshStandardMaterial({ color: 0x6b5a3e, roughness: 0.9 });
    const body = new THREE.Group(); body.position.y = 0.98; root.add(body);   // hips height
    this.body = body;
    // pelvis + torso as a lathe profile (waist narrower than chest and hips)
    const prof = [[0, -0.06], [0.16, -0.05], [0.17, 0.05], [0.145, 0.2], [0.15, 0.32], [0.19, 0.45], [0.2, 0.52], [0.16, 0.58], [0.07, 0.62], [0, 0.62]].map(([r, y]) => new THREE.Vector2(r, y));
    const torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 16), this.jacketMat);
    torso.scale.set(1, 1, 0.68);
    this.torso = new THREE.Group(); this.torso.add(torso); body.add(this.torso);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.09, 10), skin); neck.position.y = 0.66; this.torso.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), skin); head.scale.set(0.9, 1.12, 1); head.position.y = 0.8; this.torso.add(head);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.012, 20), hatM); brim.position.y = 0.88; this.torso.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.09, 16), hatM); crown.position.y = 0.93; this.torso.add(crown);
    // backpack with lid and bedroll
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.2), packM); pack.position.set(0, 0.36, 0.19); this.torso.add(pack);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.22), packM); lid.position.set(0, 0.63, 0.19); this.torso.add(lid);
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.38, 12), new THREE.MeshStandardMaterial({ color: 0x6b6b30, roughness: 0.9 })); roll.rotation.z = Math.PI / 2; roll.position.set(0, 0.06, 0.2); this.torso.add(roll);
    this.pack = pack;
    // arms: shoulder -> elbow -> hand
    const mkArm = (side) => {
      const sh = new THREE.Group(); sh.position.set(side * 0.21, 0.52, 0); this.torso.add(sh);
      sh.add(joint(0.055, this.jacketMat));
      const upper = seg(0.29, 0.05, 0.042, this.jacketMat); sh.add(upper);
      const elbow = new THREE.Group(); elbow.position.y = -0.29; upper.add(elbow);
      const fore = seg(0.26, 0.04, 0.033, this.jacketMat); elbow.add(fore);
      const hand = joint(0.04, skin); hand.position.y = -0.28; fore.add(hand);
      return { sh, elbow };
    };
    this.armL = mkArm(-1); this.armR = mkArm(1);
    // legs: hip -> knee -> ankle
    const mkLeg = (side) => {
      const hip = new THREE.Group(); hip.position.set(side * 0.09, 0, 0); body.add(hip);
      const thigh = seg(0.45, 0.075, 0.055, pants); hip.add(thigh);
      const knee = new THREE.Group(); knee.position.y = -0.45; thigh.add(knee);
      knee.add(joint(0.052, pants));
      const shin = seg(0.44, 0.052, 0.04, pants); knee.add(shin);
      const ankle = new THREE.Group(); ankle.position.y = -0.44; shin.add(ankle);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.26), bootM); boot.position.set(0, -0.04, -0.06); ankle.add(boot);
      return { hip, knee, ankle };
    };
    this.legL = mkLeg(-1); this.legR = mkLeg(1);
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.group = root; this.phase = 0; this.stepCb = null; this.lastStepSign = 1;
    this.lamp = new THREE.SpotLight(0xfff1d6, 0, 60, 0.6, 0.5, 1.2);
    this.lamp.position.set(0, 1.75, -0.1); this.lamp.target.position.set(0, 0, -8);
    root.add(this.lamp); root.add(this.lamp.target);
    scene.add(root);
  }
  setJacket(color) { this.jacketMat.color.set(color); }
  place(x, y, z, heading) { this.group.position.set(x, y, z); this.group.rotation.y = heading; }
  // speed01: 0..1.6 relative walking intensity; grade: rise/run along heading; dt real seconds
  animate(dt, speed01, grade, pushing) {
    const cadence = 1.7 + speed01 * 1.1;
    this.phase += dt * cadence * Math.PI * 2 * 0.5;
    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    const amp = Math.min(1, speed01) * (pushing ? 1.15 : 1);
    const swing = 0.55 * amp;
    const legs = [[this.legL, s], [this.legR, -s]];
    for (const [leg, v] of legs) {
      leg.hip.rotation.x = v * swing - Math.max(0, grade) * 0.35;
      leg.knee.rotation.x = -(Math.max(0, -v + 0.25) * 0.9 * amp + Math.max(0, grade) * 0.35);   // shin folds back on the back-swing
      leg.ankle.rotation.x = -leg.knee.rotation.x * 0.4;
    }
    this.armL.sh.rotation.x = -s * 0.45 * amp; this.armR.sh.rotation.x = s * 0.45 * amp;
    this.armL.elbow.rotation.x = 0.35 + 0.25 * amp; this.armR.elbow.rotation.x = 0.35 + 0.25 * amp;
    this.body.position.y = 0.98 - Math.abs(c) * 0.035 * amp;
    this.torso.rotation.x = -0.08 - Math.max(0, grade) * 0.35 + Math.max(0, -grade) * 0.1;   // lean into the hill under a pack
    this.torso.rotation.y = s * 0.06 * amp;
    const sign = Math.sign(s);
    if (sign !== this.lastStepSign && amp > 0.15) { this.lastStepSign = sign; this.stepCb?.(); }
  }
  rest(dt) {
    const k = Math.min(1, dt * 6);
    for (const leg of [this.legL, this.legR]) { leg.hip.rotation.x *= 1 - k; leg.knee.rotation.x *= 1 - k; leg.ankle.rotation.x *= 1 - k; }
    for (const arm of [this.armL, this.armR]) { arm.sh.rotation.x *= 1 - k; arm.elbow.rotation.x += (0.2 - arm.elbow.rotation.x) * k; }
    this.torso.rotation.x += (-0.04 - this.torso.rotation.x) * k; this.torso.rotation.y *= 1 - k;
    this.body.position.y += (0.98 - this.body.position.y) * k;
  }
  dispose(scene) { scene.remove(this.group); this.group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } }); }
}
