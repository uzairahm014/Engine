export interface Box { minX: number; maxX: number; minZ: number; maxZ: number; h: number }
/** Push a circle (x,z,r) out of every box it overlaps. Returns resolved position. */
export function resolveCircle(x: number, z: number, r: number, boxes: Box[], y = 0): { x: number; z: number } {
  for (let pass = 0; pass < 3; pass++) {
    for (const b of boxes) {
      if (y >= b.h) continue;
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      let dx = x - cx, dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) { const d = Math.sqrt(d2); x = cx + (dx / d) * r; z = cz + (dz / d) * r; }
      else {
        const l = x - b.minX, rr = b.maxX - x, t = z - b.minZ, bt = b.maxZ - z, m = Math.min(l, rr, t, bt);
        if (m === l) x = b.minX - r; else if (m === rr) x = b.maxX + r; else if (m === t) z = b.minZ - r; else z = b.maxZ + r;
      }
    }
  }
  return { x, z };
}
