import { describe, it, expect } from 'vitest';
import { resolveCircle } from '../src/engine/collision';
import { parse, serialize, migrate } from '../src/engine/save';
import { loadSettings, defaultSettings } from '../src/engine/settings';
describe('collision', () => {
  const b = [{ minX: 0, maxX: 2, minZ: 0, maxZ: 2, h: 10 }];
  it('pushes circle out of box', () => { const r = resolveCircle(-0.1, 1, 0.4, b); expect(r.x).toBeLessThanOrEqual(-0.4 + 1e-6); });
  it('ignores when above', () => { expect(resolveCircle(1, 1, 0.4, b, 11)).toEqual({ x: 1, z: 1 }); });
  it('handles center inside', () => { const r = resolveCircle(1, 1, 0.4, b); expect(Math.hypot(r.x - 1, r.z - 1)).toBeGreaterThan(0.9); });
});
describe('save', () => {
  it('roundtrips', () => { const s = serialize({ x: 1, z: 2, shards: [0, 3], doorOpen: true, timeOfDay: 0.5 }); expect(parse(s)).toMatchObject({ x: 1, shards: [0, 3], doorOpen: true }); });
  it('migrates v1', () => { expect(migrate({ version: 1, x: 0, z: 0, shards: [], doorOpen: false })?.version).toBe(2); });
  it('rejects garbage', () => { expect(parse('nope')).toBeNull(); expect(parse('{"version":9}')).toBeNull(); });
});
describe('settings', () => {
  it('mobile defaults low', () => expect(defaultSettings(true).quality).toBe('low'));
  it('corrupt storage falls back', () => expect(loadSettings(false, { getItem: () => '{bad' }).quality).toBe('high'));
});
