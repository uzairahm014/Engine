import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Input } from '../engine/input';
import { resolveCircle, Box } from '../engine/collision';
import { loadSettings, saveSettings, shadowMapSize, Settings } from '../engine/settings';
import { SAVE_KEY, serialize, parse } from '../engine/save';

const $ = (id: string) => document.getElementById(id)!;
function fail(m: string) { $('load').style.display = 'none'; const e = $('err'); e.style.display = 'flex'; e.textContent = 'Aetherveil failed to start: ' + m; console.error(m); }
addEventListener('error', e => fail(e.message));
addEventListener('unhandledrejection', e => fail(String(e.reason)));
const progress = (p: number, m: string) => { ($('bar').firstElementChild as HTMLElement).style.width = p * 100 + '%'; $('msg').textContent = m; };
const tick = () => new Promise(r => setTimeout(r));

async function boot() {
  const canvas = document.createElement('canvas'); document.body.prepend(canvas);
  if (!canvas.getContext('webgl2')) return fail('WebGL2 is not available on this device/browser.');
  const input = new Input(canvas);
  const mobile = input.touch;
  const S: Settings = loadSettings(mobile);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x120826, 0.018);
  const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 400);
  progress(0.1, 'Building lighting'); await tick();

  // --- lighting + IBL from procedural sky ---
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec3 p;uniform vec3 top,bot;void main(){float h=clamp(normalize(p).y*1.4+.15,0.,1.);gl_FragColor=vec4(mix(bot,top,pow(h,.6)),1.);}' }));
  scene.add(sky);
  const hemi = new THREE.HemisphereLight(0x8a7bff, 0x201030, 0.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1); sun.position.set(30, 50, 20); scene.add(sun);
  const pm = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); envScene.add(sky.clone());
  let envTimer = 0;
  function rebuildEnv() { scene.environment?.dispose(); scene.environment = pm.fromScene(envScene, 0.04).texture; }

  // --- procedural textures ---
  progress(0.25, 'Generating city materials'); await tick();
  function windowTex(seed: number) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d')!;
    g.fillStyle = '#05050a'; g.fillRect(0, 0, 128, 256); let s = seed;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const pal = ['#ffd27a', '#5ff', '#f5f', '#8af', '#fff'];
    for (let y = 6; y < 250; y += 12) for (let x = 6; x < 122; x += 10) if (rnd() > 0.45) { g.fillStyle = pal[Math.floor(rnd() * pal.length)]; g.fillRect(x, y, 6, 7); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  const asphalt = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!;
    g.fillStyle = '#15151c'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${40 + Math.random() * 40|0},${40 + Math.random() * 40|0},60,.3)`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    g.fillStyle = '#ccc8'; g.fillRect(124, 0, 8, 90); g.fillRect(124, 128, 8, 90);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
  })();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.18, metalness: 0.6, envMapIntensity: 1.5 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; asphalt.repeat.set(20, 20); scene.add(ground);

  // --- city ---
  progress(0.4, 'Constructing district'); await tick();
  const boxes: Box[] = []; const neonLights: THREE.PointLight[] = [];
  let rs = 7; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const neonCols = [0xff2bd6, 0x19f0ff, 0xffb02e, 0x8a5cff];
  function building(cx: number, cz: number, w: number, d: number, h: number, i: number) {
    const tex = windowTex(1000 + i * 13); tex.repeat.set(Math.ceil(w / 5), Math.ceil(h / 8));
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a1a2a, roughness: 0.5, metalness: 0.7, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.3 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(cx, h / 2, cz); m.castShadow = m.receiveShadow = true; scene.add(m);
    // stepped crown, antenna, neon trim
    const top = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, h * 0.12, d * 0.7), mat); top.position.set(cx, h + h * 0.06, cz); scene.add(top);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 6), new THREE.MeshStandardMaterial({ color: 0x222 })); ant.position.set(cx, h * 1.12 + 3, cz); scene.add(ant);
    const col = neonCols[i % 4];
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.25, d + 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(3) })); trim.position.set(cx, h * 0.55, cz); scene.add(trim);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w, 6), 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(neonCols[(i + 1) % 4]).multiplyScalar(2.5) }));
    sign.position.set(cx, 4.5, cz + d / 2 + 0.05); scene.add(sign);
    boxes.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, h: 9999 });
    if (neonLights.length < (S.quality === 'low' ? 4 : 10)) { const l = new THREE.PointLight(col, 40, 22); l.position.set(cx, 3.5, cz + d / 2 + 2); scene.add(l); neonLights.push(l); }
  }
  let bi = 0;
  for (let gx = -3; gx <= 3; gx++) for (let gz = -3; gz <= 3; gz++) {
    if (Math.abs(gx) <= 0 || Math.abs(gz) <= 0) continue; // cross-shaped streets at x=0,z=0
    if (gx === 1 && gz === 1) continue; // plaza
    building(gx * 22 - Math.sign(gx) * 2, gz * 22 - Math.sign(gz) * 2, 12 + rnd() * 6, 12 + rnd() * 6, 18 + rnd() * 40, bi++);
  }
  // plaza centerpiece: holo ring
  const holo = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.08, 12, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x19f0ff).multiplyScalar(3) }));
  holo.position.set(18, 3, 18); scene.add(holo);
  const holoL = new THREE.PointLight(0x19f0ff, 30, 20); holoL.position.copy(holo.position); scene.add(holoL);

  // --- gameplay: 5 data shards, terminal opens gate ---
  progress(0.6, 'Placing interactables'); await tick();
  const shardPos = [[-8, 6], [10, -12], [-30, 30], [30, -30], [16, 22]];
  const shards = shardPos.map(([x, z], i) => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 3 }));
    m.position.set(x, 1.1, z); scene.add(m); return { m, got: false, i };
  });
  const terminal = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2, 0.6), new THREE.MeshStandardMaterial({ color: 0x222233, emissive: 0xff2bd6, emissiveIntensity: 1.5 }));
  terminal.position.set(-6, 1, -6); scene.add(terminal); boxes.push({ minX: -6.6, maxX: -5.4, minZ: -6.3, maxZ: -5.7, h: 9999 });
  const gate = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 0.6), new THREE.MeshStandardMaterial({ color: 0x331122, emissive: 0xff0033, emissiveIntensity: 1.2, metalness: 0.9, roughness: 0.3 }));
  gate.position.set(0, 2.5, -40); scene.add(gate); const gateBox: Box = { minX: -4, maxX: 4, minZ: -40.3, maxZ: -39.7, h: 9999 }; boxes.push(gateBox);
  const vault = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd24a, emissiveIntensity: 2, metalness: 1, roughness: 0.1 }));
  vault.position.set(0, 1.5, -48); scene.add(vault);
  let doorOpen = false;
  // boundary walls
  for (const [x, z, w, d] of [[0, -60, 130, 2], [0, 60, 130, 2], [-60, 0, 2, 130], [60, 0, 2, 130]]) boxes.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h: 9999 });

  // --- player (procedural articulated humanoid, NOT final art) ---
  const player = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xf2c9b0, roughness: 0.6 });
  const coat = new THREE.MeshStandardMaterial({ color: 0x151528, roughness: 0.4, metalness: 0.3, emissive: 0x19f0ff, emissiveIntensity: 0.15 });
  const hairM = new THREE.MeshStandardMaterial({ color: 0xff4fa8, roughness: 0.35, emissive: 0xff2bd6, emissiveIntensity: 0.3 });
  const mk = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, p: THREE.Object3D = player) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
  mk(new THREE.CapsuleGeometry(0.28, 0.5, 4, 12), coat, 0, 1.15, 0);
  mk(new THREE.SphereGeometry(0.22, 20, 16), skin, 0, 1.78, 0);
  mk(new THREE.SphereGeometry(0.25, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), hairM, 0, 1.82, -0.02);
  const eyeM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x19f0ff).multiplyScalar(2) });
  mk(new THREE.SphereGeometry(0.045, 8, 8), eyeM, -0.08, 1.78, 0.19); mk(new THREE.SphereGeometry(0.045, 8, 8), eyeM, 0.08, 1.78, 0.19);
  const limb = (x: number, y: number, m: THREE.Material) => { const piv = new THREE.Group(); piv.position.set(x, y, 0); player.add(piv); mk(new THREE.CapsuleGeometry(0.1, 0.5, 4, 8), m, 0, -0.32, 0, piv); return piv; };
  const lArm = limb(-0.38, 1.45, coat), rArm = limb(0.38, 1.45, coat), lLeg = limb(-0.15, 0.8, coat), rLeg = limb(0.15, 0.8, coat);
  scene.add(player);
  const P = { x: 0, z: 8, y: 0, vy: 0, yaw: 0, camYaw: 0, camPitch: 0.35, speed: 0, phase: 0 };

  // --- save / load ---
  const store = (() => { try { return localStorage; } catch { return null; } })();
  let timeOfDay = 0.92;
  function applyShards() { shards.forEach(s => { s.m.visible = !s.got; }); gate.visible = !doorOpen; gateBox.h = doorOpen ? 0 : 9999; }
  function load(d: ReturnType<typeof parse>) { if (!d) return; P.x = d.x; P.z = d.z; timeOfDay = d.timeOfDay; doorOpen = d.doorOpen; shards.forEach(s => s.got = d.shards.includes(s.i)); applyShards(); }
  const doSave = () => { try { store?.setItem(SAVE_KEY, serialize({ x: P.x, z: P.z, timeOfDay, doorOpen, shards: shards.filter(s => s.got).map(s => s.i) })); } catch { /* ignore */ } };
  try { load(parse(store?.getItem(SAVE_KEY) ?? '')); } catch { /* none */ }
  $('exp').onclick = () => { const b = new Blob([store?.getItem(SAVE_KEY) ?? '{}'], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'aetherveil-save.json'; a.click(); };
  setInterval(doSave, 5000); document.addEventListener('visibilitychange', () => { if (document.hidden) doSave(); });

  // --- composer + settings ---
  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.9, 0.7, 0.85); composer.addPass(bloom); composer.addPass(new OutputPass());
  function applySettings() {
    saveSettings(S);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2) * S.resolution);
    renderer.setSize(innerWidth, innerHeight, false); canvas.style.width = '100%'; canvas.style.height = '100%';
    composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    const ss = shadowMapSize(S.quality); renderer.shadowMap.enabled = ss > 0; sun.castShadow = ss > 0;
    if (ss) { sun.shadow.mapSize.set(ss, ss); sun.shadow.map?.dispose(); sun.shadow.map = null; const c = sun.shadow.camera; c.left = c.bottom = -40; c.right = c.top = 40; c.far = 150; c.updateProjectionMatrix(); }
    scene.traverse(o => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) m.needsUpdate = true; });
    bloom.enabled = S.bloom;
  }
  addEventListener('resize', applySettings);
  ($('q') as HTMLSelectElement).value = S.quality; ($('rs') as HTMLInputElement).value = String(S.resolution); ($('bl') as HTMLInputElement).checked = S.bloom; ($('rm') as HTMLInputElement).checked = S.reducedMotion;
  $('q').onchange = e => { S.quality = (e.target as HTMLSelectElement).value as Settings['quality']; applySettings(); };
  $('rs').onchange = e => { S.resolution = +(e.target as HTMLInputElement).value; applySettings(); };
  $('bl').onchange = e => { S.bloom = (e.target as HTMLInputElement).checked; applySettings(); };
  $('rm').onchange = e => { S.reducedMotion = (e.target as HTMLInputElement).checked; applySettings(); };
  $('gear').onclick = () => { const s = $('settings'); s.style.display = s.style.display === 'block' ? 'none' : 'block'; };
  applySettings();

  // --- adaptive resolution ---
  let acc = 0, frames = 0, fpsShown = 60;
  function adapt(dt: number) {
    acc += dt; frames++;
    if (acc > 2) { fpsShown = frames / acc; if (fpsShown < 30 && S.resolution > 0.5) { S.resolution = Math.max(0.5, S.resolution - 0.1); ($('rs') as HTMLInputElement).value = String(S.resolution); applySettings(); } acc = 0; frames = 0; }
  }

  progress(1, 'Ready'); await tick(); $('load').style.display = 'none';
  const clock = new THREE.Clock(); const cols = [new THREE.Color(), new THREE.Color()]; const msg = { t: 0 };
  const say = (t: string) => { $('prompt').textContent = t; msg.t = 3; };
  const camPos = new THREE.Vector3();
  (window as any).__aetherveil = { P, shards, get doorOpen() { return doorOpen; }, S };

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05); const t = clock.elapsedTime;
    // time of day: full cycle 8 min
    timeOfDay = (timeOfDay + dt / 480) % 1;
    const daylight = Math.max(0, Math.sin(timeOfDay * Math.PI * 2 - Math.PI / 2)); // 0 at night
    const su = sky.material as THREE.ShaderMaterial;
    su.uniforms.top.value.setHSL(0.72, 0.6, 0.03 + daylight * 0.35); su.uniforms.bot.value.setHSL(0.85, 0.7, 0.08 + daylight * 0.4);
    (scene.fog as THREE.FogExp2).color.copy(su.uniforms.bot.value).multiplyScalar(0.6);
    sun.intensity = 0.15 + daylight * 2.5; hemi.intensity = 0.4 + daylight * 0.8;
    sun.position.set(Math.cos(timeOfDay * 6.283) * 50, 20 + daylight * 40, 20);
    envTimer -= dt; if (envTimer <= 0) { rebuildEnv(); envTimer = 15; }

    // movement (camera relative)
    P.camYaw -= input.lookDX * 0.004; P.camPitch = Math.max(-0.2, Math.min(1.2, P.camPitch + input.lookDY * 0.004));
    const a = input.axis(); const sp = input.sprint() ? 9 : 5.5;
    const fx = -Math.sin(P.camYaw), fz = -Math.cos(P.camYaw), rx = Math.cos(P.camYaw), rz = -Math.sin(P.camYaw);
    const vx = (rx * a.x - fx * a.y) * sp, vz = (rz * a.x - fz * a.y) * sp;
    const mag = Math.hypot(a.x, a.y); P.speed += (mag * sp - P.speed) * Math.min(1, dt * 10);
    if (mag > 0.05) { P.x += vx * dt; P.z += vz * dt; const ty = Math.atan2(vx, vz); let dy = ty - P.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); P.yaw += dy * Math.min(1, dt * 12); }
    if (input.jump && P.y === 0) P.vy = 7; P.vy -= 20 * dt; P.y = Math.max(0, P.y + P.vy * dt); if (P.y === 0) P.vy = 0;
    const r = resolveCircle(P.x, P.z, 0.4, boxes, P.y); P.x = r.x; P.z = r.z;
    player.position.set(P.x, P.y, P.z); player.rotation.y = P.yaw;
    P.phase += P.speed * dt * 1.8; const sw = Math.sin(P.phase) * Math.min(1, P.speed / 5) * 0.9;
    lArm.rotation.x = sw; rArm.rotation.x = -sw; lLeg.rotation.x = -sw; rLeg.rotation.x = sw;

    // interaction
    let prompt = '';
    for (const s of shards) if (!s.got) { s.m.rotation.y = t * 2; s.m.position.y = 1.1 + Math.sin(t * 3 + s.i) * 0.15; if (Math.hypot(s.m.position.x - P.x, s.m.position.z - P.z) < 1.2) { s.got = true; s.m.visible = false; say(`Data shard ${shards.filter(q => q.got).length}/5 collected`); } }
    const got = shards.filter(s => s.got).length;
    if (Math.hypot(terminal.position.x - P.x, terminal.position.z - P.z) < 2.5 && !doorOpen) {
      prompt = got === 5 ? 'Press E / Use: decrypt gate' : `Terminal needs 5 shards (${got}/5)`;
      if (input.act) { if (got === 5) { doorOpen = true; applyShards(); say('Gate unlocked. Reach the vault.'); doSave(); } else say(`Need ${5 - got} more shards`); }
    }
    if (doorOpen && Math.hypot(vault.position.x - P.x, vault.position.z - P.z) < 2) say('Benchmark complete: vault reached.');
    if (msg.t > 0) { msg.t -= dt; if (msg.t <= 0) $('prompt').textContent = ''; } else if (prompt) $('prompt').textContent = prompt;
    holo.rotation.x = t; holo.rotation.y = t * 0.7; vault.rotation.y = t;
    terminal.material.emissiveIntensity = 1.2 + Math.sin(t * 4) * 0.4;
    if (!S.reducedMotion) neonLights.forEach((l, i) => l.intensity = 40 + Math.sin(t * 3 + i) * 6);

    // third-person camera with simple wall pull-in
    let dist = 6; const cx = Math.sin(P.camYaw) * Math.cos(P.camPitch), cz = Math.cos(P.camYaw) * Math.cos(P.camPitch), cy = Math.sin(P.camPitch);
    for (; dist > 1.5; dist -= 0.5) { const px = P.x + cx * dist, pz = P.z + cz * dist, py = P.y + 1.6 + cy * dist; if (py > 0.3 && !boxes.some(b => px > b.minX && px < b.maxX && pz > b.minZ && pz < b.maxZ && py < 60)) break; }
    camPos.set(P.x + cx * dist, Math.max(0.4, P.y + 1.6 + cy * dist), P.z + cz * dist); camera.position.lerp(camPos, 1 - Math.exp(-dt * 14)); camera.lookAt(P.x, P.y + 1.4, P.z);
    sky.position.copy(camera.position);

    adapt(dt);
    $('h1').textContent = `Shards ${got}/5${doorOpen ? ' · Gate open' : ''}`;
    $('h2').textContent = `${fpsShown.toFixed(0)} fps · ${S.quality} · ${(timeOfDay * 24).toFixed(0).padStart(2, '0')}:00`;
    composer.render(); input.endFrame(); requestAnimationFrame(frame);
  }
  frame();
}
boot().catch(e => fail(String(e?.message ?? e)));
