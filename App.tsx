import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type {
  ShouldStartLoadRequest,
  WebViewMessageEvent,
  WebViewNavigation,
} from 'react-native-webview/lib/WebViewTypes';

import { BRIDGE_SCRIPT } from './src/bridge';
import { buildEngineScript } from './src/engine';
import type { Rules, Settings } from './src/rules';
import { loadRules, updateRules, type UpdateResult } from './src/rulesStore';
import { SettingsModal } from './src/SettingsModal';
import { loadSettings, saveSettings } from './src/settingsStore';
import { HOME_URL, isInAppUrl, USER_AGENT } from './src/site';

type Config = { rules: Rules; settings: Settings };

// Sayfaya enjekte edilen kod: önce gizleme motoru, sonra yenileme hareketi.
const buildInjected = (c: Config) => buildEngineScript(c.rules, c.settings) + '\n' + BRIDGE_SCRIPT;

export default function App() {
  const webRef = useRef<WebView<{}>>(null);
  const canGoBack = useRef(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Telefondan okunan ayar ve kurallar (ekranda gösterilen/değiştirilen güncel değerler).
  const [config, setConfig] = useState<Config | null>(null);
  // WebView'in şu an kullandığı ayar/kurallar ve yeniden kurulum sayacı (key).
  // Enjekte edilen kod WebView'e yalnızca kurulurken güvenle verildiği için değişiklikte WebView yeniden kurulur.
  const [applied, setApplied] = useState<{ config: Config; key: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Açılışta ayar ve kuralları telefondan oku (hızlı, ağ yok); sonra yeni kuralları arka planda indir.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [settings, rules] = await Promise.all([loadSettings(), loadRules()]);
      if (!alive) return;
      const c = { settings, rules };
      setConfig(c);
      setApplied({ config: c, key: 0 });
      // Yeni kurallar kaydedilir; bir sonraki açılışta ya da elle güncellemede devreye girer.
      updateRules().catch(() => {});
    })();
    return () => {
      alive = false;
    };
  }, []);

  const injected = useMemo(() => (applied ? buildInjected(applied.config) : ''), [applied]);

  const changeSetting = useCallback((key: keyof Settings, value: boolean) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const settings = { ...prev.settings, [key]: value };
      saveSettings(settings);
      return { ...prev, settings };
    });
  }, []);

  const manualUpdate = useCallback(async (): Promise<UpdateResult> => {
    const r = await updateRules();
    if (r.status !== 'failed') setConfig((prev) => (prev ? { ...prev, rules: r.rules } : prev));
    return r;
  }, []);

  // Güncel ayar/kuralları WebView'e uygula: yeniden kurulunca yeni kod ile sayfa baştan yüklenir.
  const applyConfig = useCallback(() => {
    if (!config) return;
    canGoBack.current = false;
    setFailed(false);
    setLoading(true);
    setApplied((prev) => ({ config, key: (prev?.key ?? 0) + 1 }));
  }, [config]);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    if (!config || !applied) return;
    const same =
      JSON.stringify(config.settings) === JSON.stringify(applied.config.settings) &&
      JSON.stringify(config.rules) === JSON.stringify(applied.config.rules);
    if (!same) applyConfig();
  }, [config, applied, applyConfig]);

  const refreshFromSettings = useCallback(() => {
    setSettingsOpen(false);
    applyConfig();
  }, [applyConfig]);

  // Android geri tuşu: önce sayfa geçmişinde geri git, geçmiş bittiyse uygulamadan çık.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack.current) {
        webRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const onNavChange = useCallback((nav: WebViewNavigation) => {
    canGoBack.current = nav.canGoBack;
  }, []);

  // Instagram dışındaki bağlantılar telefonun tarayıcısında açılır.
  const onShouldStart = useCallback((req: ShouldStartLoadRequest) => {
    if (isInAppUrl(req.url)) return true;
    if (/^https?:/i.test(req.url)) Linking.openURL(req.url).catch(() => {});
    return false;
  }, []);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    if (e.nativeEvent.data === 'refresh') webRef.current?.reload();
  }, []);

  const retry = useCallback(() => {
    setFailed(false);
    setLoading(true);
    webRef.current?.reload();
  }, []);

  if (!applied || !config) {
    // Ayarlar okunana kadar Instagram açılmaz (ilk yükleme varsayılanlarla yapılmasın).
    return (
      <SafeAreaProvider>
        <View style={[styles.root, styles.center]}>
          <ActivityIndicator size="large" color="#555" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <WebView<{}>
          key={applied.key}
          ref={webRef}
          source={{ uri: HOME_URL }}
          userAgent={USER_AGENT}
          style={styles.web}
          // Oturum çerezleri ve site verisi kalıcı olsun.
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          cacheEnabled
          javaScriptEnabled
          // Video ve hikâyeler tam ekran açılmadan sayfa içinde oynasın.
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo
          allowsBackForwardNavigationGestures
          pullToRefreshEnabled
          setSupportMultipleWindows={false}
          overScrollMode="never"
          injectedJavaScriptBeforeContentLoaded={injected}
          // Bazı cihazlarda erken enjeksiyon çalışmazsa diye yedek; kod iki kez çalışmaya karşı korumalı.
          injectedJavaScript={injected}
          onMessage={onMessage}
          onNavigationStateChange={onNavChange}
          onShouldStartLoadWithRequest={onShouldStart}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
          // Android sayfa sürecini öldürürse boş ekranda kalmamak için yeniden yükle.
          onRenderProcessGone={() => webRef.current?.reload()}
          onContentProcessDidTerminate={() => webRef.current?.reload()}
        />
        {loading && !failed && (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator size="large" color="#555" />
          </View>
        )}
        {/* Küçük, yarı saydam ayar düğmesi; yalnızca kendi alanındaki dokunuşları alır. */}
        <Pressable
          style={styles.gear}
          onPress={() => setSettingsOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Ayarlar"
        >
          <Text style={styles.gearText}>⚙</Text>
        </Pressable>
        <SettingsModal
          visible={settingsOpen}
          settings={config.settings}
          rules={config.rules}
          onChangeSetting={changeSetting}
          onUpdateRules={manualUpdate}
          onRefresh={refreshFromSettings}
          onClose={closeSettings}
        />
        {failed && (
          <View style={styles.error}>
            <Text style={styles.errorTitle}>Sayfa açılamadı</Text>
            <Text style={styles.errorText}>İnternet bağlantını kontrol edip tekrar dene.</Text>
            <Pressable style={styles.button} onPress={retry}>
              <Text style={styles.buttonText}>Tekrar dene</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  center: { alignItems: 'center', justifyContent: 'center' },
  web: { flex: 1 },
  gear: {
    position: 'absolute',
    right: 6,
    top: '60%',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  gearText: { color: '#fff', fontSize: 20, lineHeight: 24 },
  loading: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.6)' : 'transparent',
  },
  error: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  errorTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8, color: '#111' },
  errorText: { fontSize: 15, color: '#555', textAlign: 'center', marginBottom: 20 },
  button: { backgroundColor: '#111', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
