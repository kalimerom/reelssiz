// Uzaktan gelen kuralların doğrulanması. Bu veri sayfaya enjekte edildiği için çok katıdır:
// her alan olmalı, türü doğru olmalı, uzunluklar sınırlı olmalı, düzenli ifadeler derlenmeli.
// Bilinmeyen ek alanlar atılır. Bu dosya saf koddur (depolama/ağ yok), böylece testte düz node ile çalışır.
import type { Rules } from './rules';

export const MAX_STRING = 2000;
export const MAX_CSS = 5000;
export const MAX_ITEMS = 50;

const STRING_FIELDS = ['home', 'reelPath', 'reelScrollAllow', 'postSelector', 'feedReelLink', 'exploreHide', 'css'] as const;
const ARRAY_FIELDS = ['navHide', 'blockedPaths', 'feedPaths', 'suggestedTexts', 'explorePaths'] as const;
// Düzenli ifade olarak derlenecek alanlar.
const REGEX_STRING_FIELDS = ['reelPath'] as const;
const REGEX_ARRAY_FIELDS = ['blockedPaths', 'feedPaths', 'explorePaths'] as const;

function okString(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.length <= max;
}

function okRegex(v: string): boolean {
  try {
    new RegExp(v);
    return true;
  } catch {
    return false;
  }
}

/** Geçerliyse temizlenmiş kuralları, değilse null döner. */
export function validateRules(input: unknown): Rules | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  if (typeof o.version !== 'number' || !Number.isInteger(o.version) || o.version < 0 || o.version > 1e9) return null;
  out.version = o.version;

  for (const k of STRING_FIELDS) {
    if (!okString(o[k], k === 'css' ? MAX_CSS : MAX_STRING)) return null;
    out[k] = o[k];
  }
  if (!(out.home as string).startsWith('/')) return null;

  for (const k of ARRAY_FIELDS) {
    const arr = o[k];
    if (!Array.isArray(arr) || arr.length > MAX_ITEMS) return null;
    if (!arr.every((s) => okString(s, MAX_STRING))) return null;
    out[k] = arr.slice();
  }

  for (const k of REGEX_STRING_FIELDS) if (!okRegex(out[k] as string)) return null;
  for (const k of REGEX_ARRAY_FIELDS) if (!(out[k] as string[]).every(okRegex)) return null;

  return out as unknown as Rules;
}
