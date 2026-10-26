export class Input {
  keys = new Set<string>(); moveX = 0; moveY = 0; lookDX = 0; lookDY = 0; jump = false; act = false;
  private joyId = -1; private lookId = -1; private jo = { x: 0, y: 0 }; private lp = { x: 0, y: 0 };
  constructor(el: HTMLElement) {
    addEventListener('keydown', e => { this.keys.add(e.code); if (e.code === 'Space') this.jump = true; if (e.code === 'KeyE') this.act = true; });
    addEventListener('keyup', e => this.keys.delete(e.code));
    el.addEventListener('mousemove', e => { if (document.pointerLockElement === el) { this.lookDX += e.movementX; this.lookDY += e.movementY; } });
    el.addEventListener('click', () => { if (!this.touch) el.requestPointerLock?.(); });
    const joy = document.getElementById('joy')!; const knob = joy.firstElementChild as HTMLElement;
    if (this.touch) { joy.style.display = 'block'; document.getElementById('btns')!.style.display = 'flex'; }
    joy.addEventListener('pointerdown', e => { this.joyId = e.pointerId; const r = joy.getBoundingClientRect(); this.jo = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; joy.setPointerCapture(e.pointerId); this.joy(e, knob); });
    joy.addEventListener('pointermove', e => { if (e.pointerId === this.joyId) this.joy(e, knob); });
    const end = (e: PointerEvent) => { if (e.pointerId === this.joyId) { this.joyId = -1; this.moveX = this.moveY = 0; knob.style.transform = ''; } };
    joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
    el.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && this.lookId < 0) { this.lookId = e.pointerId; this.lp = { x: e.clientX, y: e.clientY }; } });
    el.addEventListener('pointermove', e => { if (e.pointerId === this.lookId) { this.lookDX += (e.clientX - this.lp.x) * 1.6; this.lookDY += (e.clientY - this.lp.y) * 1.6; this.lp = { x: e.clientX, y: e.clientY }; } });
    const le = (e: PointerEvent) => { if (e.pointerId === this.lookId) this.lookId = -1; };
    el.addEventListener('pointerup', le); el.addEventListener('pointercancel', le);
    document.getElementById('bJump')!.addEventListener('pointerdown', () => this.jump = true);
    document.getElementById('bAct')!.addEventListener('pointerdown', () => this.act = true);
  }
  get touch() { return matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window; }
  private joy(e: PointerEvent, knob: HTMLElement) {
    let dx = (e.clientX - this.jo.x) / 50, dy = (e.clientY - this.jo.y) / 50; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    this.moveX = dx; this.moveY = dy; knob.style.transform = `translate(${dx * 40}px,${dy * 40}px)`;
  }
  /** Combined move vector (x right, y forward-negative like screen) */
  axis() {
    let x = this.moveX, y = this.moveY; const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1; if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1; if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    const l = Math.hypot(x, y); return l > 1 ? { x: x / l, y: y / l } : { x, y };
  }
  sprint() { return this.keys.has('ShiftLeft'); }
  endFrame() { this.lookDX = this.lookDY = 0; this.jump = false; this.act = false; }
}
