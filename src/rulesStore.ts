// Kuralların uzaktan güncellenmesi: önce kayıtlı (veya uygulamayla gelen) kurallarla açılır,
// yeni kurallar arka planda indirilir. Her hata sessizce eski kurallara düşer; uygulama internetsiz de çalışır.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_RULES, type Rules } from './rules';
import { validateRules } from './rulesValidate';

// Kuralların indirildiği adres. Başka bir yere taşımak istersen değiştirilecek tek yer burasıdır.
export const RULES_URL = 'https://raw.githubusercontent.com/kalimerom/reelssiz/main/rules.json';

const CACHE_KEY = 'reelssiz.rules.v1';
const TIMEOUT_MS = 8000;

export type UpdateResult =
  | { status: 'current'; rules: Rules }
  | { status: 'updated'; rules: Rules }
  | { status: 'failed' };

/** Telefonda kayıtlı kurallar; yoksa, bozuksa ya da uygulamadakinden eskiyse null. */
async function readCache(): Promise<Rules | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const rules = validateRules(JSON.parse(raw));
    if (!rules || rules.version < DEFAULT_RULES.version) return null;
    return rules;
  } catch {
    return null;
  }
}

/** Açılışta kullanılacak kurallar (hızlı, ağ yok). */
export async function loadRules(): Promise<Rules> {
  return (await readCache()) ?? DEFAULT_RULES;
}

async function fetchRemote(): Promise<Rules | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(RULES_URL, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) return null;
    const rules = validateRules(JSON.parse(await res.text()));
    if (!rules || rules.version < DEFAULT_RULES.version) return null;
    return rules;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Yeni kuralları indirir; geçerliyse ve sürümü kayıtlıdan farklıysa kaydeder.
 * Dönen kurallar o an etkin olması gerekenlerdir (yeni kurallar sayfaya ancak sayfa yenilenince uygulanır).
 */
export async function updateRules(): Promise<UpdateResult> {
  const remote = await fetchRemote();
  if (!remote) return { status: 'failed' };
  const cached = await readCache();
  const baseline = cached ?? DEFAULT_RULES;
  if (remote.version === baseline.version) return { status: 'current', rules: baseline };
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(remote));
  } catch {
    return { status: 'failed' };
  }
  return { status: 'updated', rules: remote };
}
