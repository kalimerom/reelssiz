// Ayarların telefonda saklanması. Kayıtlı değerler varsayılanların üstüne bindirilir;
// böylece sonradan eklenen ayarlar varsayılan değerini alır, bilinmeyen/bozuk değerler yok sayılır.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_SETTINGS, type Settings } from './rules';

const KEY = 'reelssiz.settings.v1';

export async function loadSettings(): Promise<Settings> {
  const result: Settings = { ...DEFAULT_SETTINGS };
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return result;
    const stored: unknown = JSON.parse(raw);
    if (typeof stored !== 'object' || stored === null) return result;
    for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      const v = (stored as Record<string, unknown>)[k];
      if (typeof v === 'boolean') result[k] = v;
    }
  } catch {
    // Okunamazsa varsayılanlarla devam.
  }
  return result;
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Kaydedilemezse bu oturumda geçerli kalır.
  }
}
