export const SAVE_VERSION = 2;
export interface SaveData { version: number; x: number; z: number; shards: number[]; doorOpen: boolean; timeOfDay: number }
export const SAVE_KEY = 'aetherveil.save';
export function migrate(raw: any): SaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.version === 1) raw = { ...raw, version: 2, timeOfDay: 0.9 }; // v1 had no time of day
  if (raw.version !== SAVE_VERSION) return null;
  if (![raw.x, raw.z, raw.timeOfDay].every(Number.isFinite) || !Array.isArray(raw.shards)) return null;
  return { version: 2, x: raw.x, z: raw.z, shards: raw.shards.filter(Number.isInteger), doorOpen: !!raw.doorOpen, timeOfDay: raw.timeOfDay };
}
export function serialize(d: Omit<SaveData, 'version'>): string { return JSON.stringify({ version: SAVE_VERSION, ...d }); }
export function parse(s: string): SaveData | null { try { return migrate(JSON.parse(s)); } catch { return null; } }
