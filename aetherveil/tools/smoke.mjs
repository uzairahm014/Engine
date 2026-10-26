import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('npx', ['vite', '--port', '5199', '--strictPort'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 3000));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
let code = 0;
try {
  await p.goto('http://localhost:5199/'); await p.waitForFunction(() => window.__aetherveil, null, { timeout: 60000 });
  await p.waitForTimeout(3000);
  await p.keyboard.down('KeyW'); await p.waitForTimeout(1500); await p.keyboard.up('KeyW');
  const moved = await p.evaluate(() => ({ x: window.__aetherveil.P.x, z: window.__aetherveil.P.z }));
  console.log('player after W:', moved);
  if (Math.hypot(moved.x, moved.z - 8) < 0.5) throw new Error('player did not move');
  await p.evaluate(() => { const a = window.__aetherveil; a.P.x = -8; a.P.z = 6; }); await p.waitForTimeout(600);
  console.log('hud:', await p.textContent('#h1'));
  await p.screenshot({ path: '/workspace/aetherveil/docs/smoke.png' });
  const px = await p.evaluate(() => document.querySelector('canvas').toDataURL().length);
  console.log('canvas dataURL len', px);
} catch (e) { console.error('SMOKE FAIL', e.message); code = 1; }
console.log('page errors:', errs);
if (errs.length) code = 1;
await b.close(); srv.kill(); process.exit(code);
