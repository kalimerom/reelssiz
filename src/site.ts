import { Platform } from 'react-native';

export const HOME_URL = 'https://www.instagram.com/';

// Varsayılan WebView kimliği "wv" işareti taşır ve bazı siteler bunu kısıtlı moda alır.
// Normal mobil tarayıcı kimliği kullanarak sitenin tam mobil sürümünü alıyoruz.
export const USER_AGENT =
  Platform.OS === 'ios'
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    : 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

// Uygulama içinde açılmasına izin verilen alan adları (giriş ve medya için gerekenler dahil).
const IN_APP_HOSTS = ['instagram.com', 'cdninstagram.com', 'facebook.com', 'fbcdn.net', 'fbsbx.com'];

export function isInAppUrl(url: string): boolean {
  if (!/^https?:/i.test(url)) {
    // about:blank, blob:, data: gibi sayfa içi adresler serbest; intent:, market: vb. değil.
    return /^(about|blob|data):/i.test(url);
  }
  const match = /^https?:\/\/([^/?#:]+)/i.exec(url);
  if (!match) return false;
  const host = match[1].toLowerCase();
  // Instagram'ın dış bağlantı yönlendiricisi: gerçek hedef tarayıcıda açılsın.
  if (host === 'l.instagram.com') return false;
  return IN_APP_HOSTS.some((h) => host === h || host.endsWith('.' + h));
}
