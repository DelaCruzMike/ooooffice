import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { ROOMS, WALLS, FURNITURE, SEATS, move, DEFAULT_AVATAR, type Avatar, type Player, type Vec, type Snapshot } from '../shared/world';
export type SceneControls = { input: Vec; interact: () => void; emote: (e: string) => void; local: boolean; locked: boolean; paused?: boolean; onMove: (p: Vec, direction: Vec) => void; onFps: (n: number) => void };
type Rig = { root: TransformNode; leftArm: TransformNode; rightArm: TransformNode; leftLeg: TransformNode; rightLeg: TransformNode; label: Mesh; avatar: string };
export class OfficeScene {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  rigs = new Map<string, Rig>();
  players: Player[] = [];
  myId = '';
  keys = new Set<string>();
  stick: Vec = { x: 0, z: 0 };
  private mats = new Map<string, StandardMaterial>();
  private previous = performance.now();
  private time = 0;
  private frame = 0;
  private disposed = false;
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private resize: () => void;
  private blur: () => void;
  private onClick: (e: PointerEvent) => void;
  seatMeshes = new Map<string, AbstractMesh>();
  constructor(public canvas: HTMLCanvasElement, public controls: SceneControls) {
    this.engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.engine.setHardwareScalingLevel(window.innerWidth < 900 ? 1.5 : Math.max(1, window.devicePixelRatio / 1.5));
    this.scene = new Scene(this.engine); this.scene.clearColor = new Color4(.91, .92, .87, 1);
    this.scene.ambientColor = new Color3(.08, .08, .06);
    this.camera = new ArcRotateCamera('camera', -Math.PI / 2 - .55, .85, 20, new Vector3(-9, 1, 4), this.scene);
    this.camera.attachControl(canvas, true); this.camera.lowerBetaLimit = .25; this.camera.upperBetaLimit = 1.25;
    this.camera.lowerRadiusLimit = 7; this.camera.upperRadiusLimit = 38; this.camera.wheelPrecision = 15;
    this.camera.panningSensibility = 0; this.camera.inertia = .65; this.camera.minZ = .1;
    this.camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
    const sky = new HemisphericLight('sky', new Vector3(0, 1, 0), this.scene); sky.intensity = .65; sky.groundColor = Color3.FromHexString('#a5ae98');
    const sun = new DirectionalLight('sun', new Vector3(-1, -3, 2), this.scene); sun.intensity = .25;
    this.buildOffice();
    this.onKeyDown = (e) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable]')) return;
      const key = e.key.toLowerCase();
      if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)) e.preventDefault();
      this.keys.add(key);
      if (!e.repeat && key === 'e') controls.interact();
      if (!e.repeat && key === '1') controls.emote('wave');
      if (!e.repeat && key === '2') controls.emote('dance');
    };
    this.onKeyUp = e => this.keys.delete(e.key.toLowerCase());
    this.blur = () => { this.keys.clear(); this.stick = { x: 0, z: 0 }; };
    this.resize = () => this.engine.resize();
    this.onClick = e => { if (e.pointerType === 'mouse') canvas.focus(); };
    window.addEventListener('keydown', this.onKeyDown); window.addEventListener('keyup', this.onKeyUp); window.addEventListener('blur', this.blur);
    window.addEventListener('resize', this.resize); canvas.addEventListener('pointerdown', this.onClick);
    this.engine.runRenderLoop(() => this.render());
  }
  mat(color: string) {
    if (!this.mats.has(color)) { const m = new StandardMaterial(color, this.scene); m.diffuseColor = Color3.FromHexString(color); m.specularColor = Color3.Black(); this.mats.set(color, m); }
    return this.mats.get(color)!;
  }
  box(name: string, x: number, y: number, z: number, w: number, h: number, d: number, color: string, parent?: TransformNode) {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, this.scene); mesh.position.set(x, y, z); mesh.material = this.mat(color); if (parent) mesh.parent = parent; return mesh;
  }
  cylinder(name: string, x: number, y: number, z: number, diameter: number, height: number, color: string, parent?: TransformNode) {
    const mesh = MeshBuilder.CreateCylinder(name, { diameter, height, tessellation: 8 }, this.scene); mesh.position.set(x, y, z); mesh.material = this.mat(color); if (parent) mesh.parent = parent; return mesh;
  }
  label(text: string, x: number, y: number, z: number, width = 6, color = '#53634f', ground = false) {
    const texture = new DynamicTexture(`text-${text}`, { width: 768, height: 128 }, this.scene, false);
    const ctx = texture.getContext() as CanvasRenderingContext2D; ctx.clearRect(0, 0, 768, 128); ctx.font = '600 48px sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(text, 384, 83); texture.update();
    const m = new StandardMaterial(`label-${text}`, this.scene); m.diffuseTexture = texture; m.opacityTexture = texture; m.emissiveColor = Color3.White(); m.disableLighting = true; m.backFaceCulling = false;
    const plane = MeshBuilder.CreatePlane(text, { width, height: width / 6 }, this.scene); plane.material = m; plane.position.set(x, y, z); plane.isPickable = false;
    if (ground) plane.rotation.x = Math.PI / 2; else plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    return plane;
  }
  plant(x: number, z: number, size = 1) {
    this.cylinder('terracotta pot', x, .35 * size, z, .8 * size, .7 * size, '#c29a7d');
    this.cylinder('soil', x, .72 * size, z, .68 * size, .04, '#635544');
    this.cylinder('stem', x, 1.12 * size, z, .09, .8 * size, '#687459');
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4, mesh = MeshBuilder.CreateSphere('leaves', { diameter: .8 * size, segments: 4 }, this.scene);
      mesh.scaling.set(.7, 1.3, .65); mesh.position.set(x + Math.cos(a) * .28 * size, (1.1 + i * .12) * size, z + Math.sin(a) * .28 * size); mesh.rotation.z = Math.cos(a) * .5; mesh.material = this.mat(i % 2 ? '#81916b' : '#60765a');
    }
  }
  chair(x: number, z: number, rotation = 0, color = '#748575') {
    const root = new TransformNode('chair', this.scene); root.position.set(x, 0, z); root.rotation.y = rotation;
    this.box('seat', 0, .48, 0, .7, .16, .7, color, root);
    this.box('back', 0, .92, -.29, .7, .8, .12, color, root);
    for (const a of [-.25, .25]) for (const b of [-.25, .25]) this.box('chair leg', a, .23, b, .055, .46, .055, '#66685e', root);
    return root;
  }
  buildOffice() {
    this.box('office foundation', 1, -.32, 2, 84, .55, 68, '#b1b8a2');
    this.box('oak floor', 1, -.035, 2, 82, .12, 66, '#e1d4bc');
    for (let x = -39; x < 42; x += 2.2) this.box('floor seam', x, .03, 2, .018, .015, 66, '#d5c7ae');
    for (const r of ROOMS) {
      const floor = r.id === 'smoking' ? '#c6c8b0' : r.id === 'lounge' ? '#ddd5c0' : '#eeebe0';
      this.box(`${r.name} floor`, r.x, .055, r.z, r.w - .3, .07, r.d - .3, floor);
      if (r.enclosed) {
        this.box('room accent strip', r.x, .105, r.z + (r.side === 'south' ? r.d / 2 - .35 : -r.d / 2 + .35), r.w - .6, .05, .35, r.color);
        this.label(r.short.toUpperCase(), r.x, .12, r.z + (r.side === 'south' ? r.d / 2 - 1.4 : -r.d / 2 + 1.4), 10, '#627064', true);
      } else this.label(r.short.toUpperCase(), r.x, .12, r.z + 5.8, 9, '#627064', true);
      this.plant(r.x + r.w / 2 - 1.2, r.z - r.d / 2 + 1.3, 1.1);
      if (r.seats) {
        const backZ = r.z - r.d / 2 + .45;
        this.box('storage cabinet', r.x - 3, .65, backZ, 5, 1.3, .6, '#cfbf9f');
        this.box('cabinet top', r.x - 3, 1.33, backZ, 5.1, .07, .7, '#f5f0e4');
        for (let i = 0; i < 4; i++) this.box('cabinet divider', r.x - 4.8 + i * 1.2, .65, backZ + .31, .025, 1.2, .015, '#b09d7c');
        this.plant(r.x - 4.5, backZ, .5);
      }
    }
    for (const w of WALLS) {
      this.box('low cutaway wall', w.x, .75, w.z, w.w, 1.5, w.d, '#d1d2c1');
      this.box('wall cap', w.x, 1.53, w.z, w.w + .035, .07, w.d + .035, '#f8f6ee');
    }
    // Outside rail and large windows: no roof so the office remains easy to navigate.
    for (const z of [-30, 34]) {
      this.box('external wall', 1, .55, z, 82, 1.1, .25, '#c1c8b5');
      for (let x = -38; x < 41; x += 6) { this.box('window sill', x, 1.14, z, 5.5, .13, .4, '#f5f2e8'); this.box('window frame', x - 2.6, 1.9, z, .09, 1.5, .12, '#899482'); }
    }
    for (const f of FURNITURE) {
      if (f.kind === 'desk') {
        this.box('oak desktop', f.x, .95, f.z, f.w, .15, f.d, '#ceae83');
        for (const side of [-1, 1]) this.box('desk legs', f.x + side * (f.w / 2 - .15), .45, f.z, .08, .9, f.d - .1, '#8a8e7d');
        this.box('monitor base', f.x, 1.08, f.z - .12, .45, .06, .28, '#48554d');
        this.box('monitor stem', f.x, 1.26, f.z - .22, .08, .35, .07, '#48554d');
        this.box('monitor', f.x, 1.6, f.z - .25, 1.05, .65, .09, '#47554f');
        this.box('screen', f.x, 1.6, f.z - .195, .94, .54, .014, '#afc5b5');
        this.box('keyboard', f.x, 1.055, f.z + .25, .65, .035, .22, '#ece8dd');
        this.cylinder('coffee cup', f.x + .88, 1.14, f.z + .1, .15, .23, '#f4e8d1');
      } else if (f.kind === 'sofa') {
        this.box('sofa base', f.x, .4, f.z, f.w, .65, f.d, '#9aab8e');
        this.box('sofa back', f.x, .95, f.z - .5, f.w, 1.05, .24, '#9aab8e');
        for (const side of [-1, 1]) this.box('sofa arm', f.x + side * (f.w / 2 - .15), .75, f.z, .3, .6, f.d, '#899d7c');
        for (let i = -1; i < 2; i++) this.box('cushion', f.x + i * 1.4, .77, f.z + .04, 1.3, .16, .85, '#b1bea2');
      } else if (f.kind === 'counter') {
        this.box('pantry counter', f.x, .6, f.z, f.w, 1.2, f.d, '#c6ad87');
        this.box('countertop', f.x, 1.24, f.z, f.w + .1, .12, f.d + .1, '#eeece1');
        this.box('coffee machine', f.x + 1.3, 1.6, f.z, .65, .65, .65, '#536258');
        this.box('coffee dispenser', f.x + 1.3, 1.5, f.z + .34, .4, .35, .05, '#c7c3b3');
      } else {
        this.box('tabletop', f.x, .86, f.z, f.w, .16, f.d, '#c7a77f');
        for (const a of [-1, 1]) for (const b of [-1, 1]) this.box('table leg', f.x + a * (f.w / 2 - .2), .4, f.z + b * (f.d / 2 - .2), .09, .8, .09, '#807b68');
        if (f.kind === 'game') {
          this.box('Connect Four board', f.x, 1.5, f.z, 1.9, 1.15, .16, '#6a8b91');
          for (let row = 0; row < 6; row++) for (let col = 0; col < 7; col++) {
            const disc = this.cylinder('game slot', f.x - .75 + col * .25, 1.07 + row * .17, f.z + .1, .13, .025, '#ebd9b6'); disc.rotation.x = Math.PI / 2;
          }
        } else { this.cylinder('table vase', f.x, 1.1, f.z, .3, .35, '#c09075'); }
      }
    }
    for (const s of SEATS) if (s.kind !== 'shared') this.chair(s.x, s.z, s.rotation, s.kind === 'meeting' ? '#92a5a3' : '#a9b19c');
    // Meeting presentation wall, terrace planter boxes, and central rug.
    this.box('presentation board', 31, 2, 15, 7.2, 2, .15, '#5e7469');
    this.label('ALL TOGETHER', 31, 2.1, 15.1, 5, '#f5f2e7');
    this.box('commons rug', -9, .11, 1, 10, .04, 7.5, '#c2c5a7');
    this.label('ooo', -9, .15, 3, 3, '#6e8062', true);
    for (let i = 0; i < 5; i++) this.plant(24.5 + i * 3, -5.5, .9);
    for (let i = 0; i < 8; i++) this.box('terrace decking', 31, .1, -6.4 + i * 2, 17.5, .04, .035, '#a6ae93');

    this.scene.onPointerObservable.add(info => {
      if (info.pickInfo?.hit && info.pickInfo.pickedMesh?.name === 'Connect Four board') controlsEvent(this.controls, 'game');
    });
    // Batch immutable furniture by material to avoid thousands of draw calls on phones.
    const groups = new Map<StandardMaterial, Mesh[]>();
    for (const mesh of [...this.scene.meshes]) {
      if (!(mesh instanceof Mesh) || !mesh.material || mesh.billboardMode || mesh.material.name.startsWith('label-')) continue;
      const mat = mesh.material as StandardMaterial;
      const list = groups.get(mat) || []; list.push(mesh); groups.set(mat, list);
    }
    for (const list of groups.values()) if (list.length > 1) {
      const merged = Mesh.MergeMeshes(list, true, true); if (merged) merged.isPickable = false;
    }
    for (const mesh of this.scene.meshes) if (!mesh.billboardMode) mesh.freezeWorldMatrix();
  }
  buildRig(p: Player) {
    const root = new TransformNode(`player-${p.id}`, this.scene);
    const a = p.avatar;
    this.box('body', 0, 1.12, 0, .57, .67, .36, a.shirt, root);
    this.box('neck', 0, 1.5, 0, .18, .12, .18, a.skin, root);
    this.cylinder('head', 0, 1.75, 0, .46, .48, a.skin, root);
    this.cylinder('hair', 0, a.style === 'bob' ? 1.84 : 1.98, -.025, .49, a.style === 'bob' ? .43 : .21, a.hair, root);
    // Face points forward along +Z.
    for (const x of [-.09, .09]) this.box('eye', x, 1.78, .224, .035, .045, .025, '#302e27', root);
    this.box('smile', 0, 1.65, .23, .1, .025, .02, '#7b4b3a', root);
    if (a.style === 'bun') this.cylinder('hair bun', 0, 2.11, -.07, .28, .23, a.hair, root);
    if (a.accessory === 'cap') { this.cylinder('cap', 0, 2.04, 0, .54, .15, a.shirt, root); this.box('cap brim', 0, 2.0, .23, .5, .05, .27, a.shirt, root); }
    if (a.accessory === 'glasses') { for (const x of [-.1, .1]) this.box('glasses lens', x, 1.78, .25, .17, .12, .025, '#3c4641', root); this.box('glasses bridge', 0, 1.78, .26, .05, .025, .02, '#3c4641', root); }
    const limb = (name: string, x: number, y: number, length: number, color: string) => {
      const pivot = new TransformNode(name, this.scene); pivot.parent = root; pivot.position.set(x, y, 0);
      this.box(name, 0, -length / 2, 0, name.includes('arm') ? .18 : .21, length, .23, color, pivot); return pivot;
    };
    const leftArm = limb('left arm', -.39, 1.4, .62, a.shirt), rightArm = limb('right arm', .39, 1.4, .62, a.shirt);
    this.box('left hand', 0, -.65, 0, .16, .17, .18, a.skin, leftArm); this.box('right hand', 0, -.65, 0, .16, .17, .18, a.skin, rightArm);
    const leftLeg = limb('left leg', -.16, .8, .66, a.trousers), rightLeg = limb('right leg', .16, .8, .66, a.trousers);
    this.box('left shoe', 0, -.7, .07, .23, .16, .35, '#eee9dc', leftLeg); this.box('right shoe', 0, -.7, .07, .23, .16, .35, '#eee9dc', rightLeg);
    const label = this.label(p.name + (p.id === this.myId ? ' · you' : ''), 0, 2.5, 0, 2.8, '#3f5443'); label.parent = root;
    root.position.set(p.x, 0, p.z);
    const rig = { root, leftArm, rightArm, leftLeg, rightLeg, label, avatar: JSON.stringify(p.avatar) }; this.rigs.set(p.id, rig); return rig;
  }
  sync(snapshot: Snapshot, id: string) {
    this.myId = id; this.controls.locked = snapshot.locked;
    // Local coordinates are predicted; reconcile only significant disagreement.
    const old = this.players.find(p => p.id === id);
    this.players = snapshot.players.map(p => {
      if (p.id === id && old && !p.seat && Math.hypot(old.x - p.x, old.z - p.z) < 1.5) return { ...p, x: old.x, z: old.z };
      return { ...p };
    });
    for (const [id, rig] of this.rigs) if (!snapshot.players.some(p => p.id === id)) { this.disposeRig(rig); this.rigs.delete(id); }
  }
  private disposeRig(r: Rig) { const mat = r.label.material as StandardMaterial; mat.diffuseTexture?.dispose(); mat.dispose(); r.root.dispose(); }
  setQuality(low: boolean) { this.engine.setHardwareScalingLevel(low ? 2 : Math.max(1, window.devicePixelRatio / 1.5)); }
  focusRoom(id: string) { const r = ROOMS.find(r => r.id === id); if (!r) return; this.camera.setTarget(new Vector3(r.x, 0, r.z)); this.camera.radius = 30; }
  render() {
    if (this.disposed) return;
    const now = performance.now(), dt = Math.min(.06, (now - this.previous) / 1000); this.previous = now; this.time += dt;
    const me = this.players.find(p => p.id === this.myId);
    let x = Number(this.keys.has('d') || this.keys.has('arrowright')) - Number(this.keys.has('a') || this.keys.has('arrowleft')) + this.stick.x;
    let z = Number(this.keys.has('s') || this.keys.has('arrowdown')) - Number(this.keys.has('w') || this.keys.has('arrowup')) + this.stick.z;
    // Camera-relative direction on the ground plane.
    const forward = new Vector3(-Math.cos(this.camera.alpha), 0, -Math.sin(this.camera.alpha));
    const right = new Vector3(forward.z, 0, -forward.x);
    const direction = { x: right.x * x - forward.x * z, z: right.z * x - forward.z * z };
    if (this.controls.paused) { direction.x = 0; direction.z = 0; }
    const len = Math.hypot(direction.x, direction.z); if (len > 1) { direction.x /= len; direction.z /= len; }
    if (me && !me.seat) {
      const next = move(me, direction, dt, this.controls.locked);
      me.moving = Math.hypot(next.x - me.x, next.z - me.z) > .001;
      if (me.moving) { me.rotation = Math.atan2(direction.x, direction.z); me.emote = ''; }
      Object.assign(me, next); this.controls.onMove(next, direction);
    } else this.controls.onMove(me || { x: 0, z: 0 }, { x: 0, z: 0 });
    if (me) this.camera.target = Vector3.Lerp(this.camera.target, new Vector3(me.x, .7, me.z), Math.min(1, dt * 5));
    for (const p of this.players) {
      let r = this.rigs.get(p.id);
      if (r && r.avatar !== JSON.stringify(p.avatar)) { this.disposeRig(r); this.rigs.delete(p.id); r = undefined; }
      if (!r) r = this.buildRig(p);
      r.root.position.x += (p.x - r.root.position.x) * Math.min(1, dt * 14); r.root.position.z += (p.z - r.root.position.z) * Math.min(1, dt * 14);
      const angle = Math.atan2(Math.sin(p.rotation - r.root.rotation.y), Math.cos(p.rotation - r.root.rotation.y)); r.root.rotation.y += angle * Math.min(1, dt * 12);
      const distant = me && Math.hypot(p.x - me.x, p.z - me.z) > 24;
      r.label.setEnabled(!distant); if (distant && this.frame % 3) continue;
      const walk = p.moving ? Math.sin(this.time * 11) * .65 : 0;
      r.leftArm.rotation.set(walk, 0, .08); r.rightArm.rotation.set(-walk, 0, -.08);
      r.leftLeg.rotation.x = -walk; r.rightLeg.rotation.x = walk; r.root.position.y = p.moving ? Math.abs(Math.sin(this.time * 11)) * .045 : Math.sin(this.time * 2) * .012;
      if (p.seat || p.emote === 'sit') { r.leftLeg.rotation.x = r.rightLeg.rotation.x = -Math.PI / 2; r.root.position.y = -.25; r.leftArm.rotation.x = r.rightArm.rotation.x = -.45; }
      if (p.emote === 'wave') { r.rightArm.rotation.z = -2.4 + Math.sin(this.time * 8) * .3; r.rightArm.rotation.x = -.2; }
      if (p.emote === 'dance') { r.root.position.y = Math.abs(Math.sin(this.time * 5)) * .2; r.root.rotation.z = Math.sin(this.time * 5) * .12; r.leftArm.rotation.z = .8 + Math.sin(this.time * 5) * .4; r.rightArm.rotation.z = -.8 - Math.sin(this.time * 5) * .4; } else r.root.rotation.z = 0;
    }
    if (++this.frame % 60 === 0) this.controls.onFps(Math.round(this.engine.getFps()));
    this.scene.render();
  }
  dispose() { this.disposed = true; this.engine.stopRenderLoop(); window.removeEventListener('keydown', this.onKeyDown); window.removeEventListener('keyup', this.onKeyUp); window.removeEventListener('blur', this.blur); window.removeEventListener('resize', this.resize); this.canvas.removeEventListener('pointerdown', this.onClick); this.scene.dispose(); this.engine.dispose(); }
}
function controlsEvent(controls: SceneControls, event: string) { if (event === 'game') controls.interact(); }
