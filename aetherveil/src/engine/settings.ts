export type Quality = 'low' | 'medium' | 'high';
export interface Settings { quality: Quality; resolution: number; bloom: boolean; reducedMotion: boolean }
export const SETTINGS_KEY = 'aetherveil.settings.v1';
export function defaultSettings(mobile: boolean): Settings {
  return { quality: mobile ? 'low' : 'high', resolution: mobile ? 0.75 : 1, bloom: true, reducedMotion: false };
}
export function loadSettings(mobile: boolean, store: Pick<Storage, 'getItem'> | null = safe()): Settings {
  const d = defaultSettings(mobile);
  try { const raw = store?.getItem(SETTINGS_KEY); if (raw) return { ...d, ...JSON.parse(raw) }; } catch { /* corrupt -> defaults */ }
  return d;
}
export function saveSettings(s: Settings, store: Pick<Storage, 'setItem'> | null = safe()) { try { store?.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } }
function safe(): Storage | null { try { return localStorage; } catch { return null; } }
export const shadowMapSize = (q: Quality) => ({ low: 0, medium: 1024, high: 2048 }[q]);
