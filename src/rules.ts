// Gizleme kuralları. Instagram tasarımını değiştirdiğinde düzeltilecek tek yer burası;
// 3. aşamada bu veri uygulama güncellemesi gerekmeden uzaktan da okunacak.
// Sınıf adları sık değiştiği için kurallar bağlantı adreslerine (href) ve sayfa yollarına dayanır.
export type Rules = {
  version: number;
  /** Engellenen bir sayfaya girilince dönülecek adres. */
  home: string;
  /** Reels sekmesi gibi gizlenecek menü bağlantıları. */
  navHide: string[];
  /** Tamamen engellenen sayfa yolları (Reels akışı). */
  blockedPaths: string[];
  /** Tek bir Reels sayfası; 1. grup videonun kimliği. */
  reelPath: string;
  /** Reels sayfasında kaydırmaya izin verilen alanlar (yorumlar vb.). */
  reelScrollAllow: string;
  /** Akış temizliğinin uygulanacağı sayfa yolları. */
  feedPaths: string[];
  /** Akıştaki tek bir gönderi. */
  postSelector: string;
  /** Bir gönderinin Reels olduğunu gösteren bağlantı. */
  feedReelLink: string;
  /** Takip etmediğin hesaplardan gelen (önerilen) gönderilerdeki düğme yazıları. */
  suggestedTexts: string[];
  /** Ek stil kuralları. */
  css: string;
};

export type Settings = {
  hideReelsTab: boolean;
  blockReelsFeed: boolean;
  lockReelScroll: boolean;
  hideFeedReels: boolean;
  hideSuggested: boolean;
};

export const DEFAULT_RULES: Rules = {
  version: 1,
  home: '/',
  navHide: ['a[href="/reels/"]', 'a[href^="/reels/?"]'],
  blockedPaths: ['^/reels/?$'],
  reelPath: '^/reels?/([^/]+)',
  reelScrollAllow: '[role="dialog"]',
  feedPaths: ['^/$'],
  postSelector: 'article',
  feedReelLink: 'a[href*="/reel/"], a[href^="/reels/"]:not([href="/reels/"])',
  suggestedTexts: ['Follow', 'Takip Et', 'Takip et'],
  css: '',
};

export const DEFAULT_SETTINGS: Settings = {
  hideReelsTab: true,
  blockReelsFeed: true,
  lockReelScroll: true,
  hideFeedReels: true,
  hideSuggested: true,
};
