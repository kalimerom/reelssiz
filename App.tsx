import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { HOME_URL, isInAppUrl, USER_AGENT } from './src/site';

export default function App() {
  const webRef = useRef<WebView<{}>>(null);
  const canGoBack = useRef(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

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

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <WebView<{}>
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
          injectedJavaScriptBeforeContentLoaded={BRIDGE_SCRIPT}
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
  web: { flex: 1 },
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
