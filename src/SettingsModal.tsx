import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import type { Rules, Settings } from './rules';
import type { UpdateResult } from './rulesStore';

type Row = { key: keyof Settings; title: string; desc: string };

const ROWS: Row[] = [
  { key: 'hideReelsTab', title: 'Reels sekmesini gizle', desc: 'Alt menüdeki Reels düğmesi kaldırılır.' },
  { key: 'blockReelsFeed', title: 'Reels akışını engelle', desc: 'Reels sayfası açılınca ana sayfaya dönülür.' },
  {
    key: 'lockReelScroll',
    title: 'Tek videoda kaydırmayı kilitle',
    desc: 'Mesajla gelen video açılır ama sonrakine geçilemez.',
  },
  { key: 'hideFeedReels', title: 'Akıştaki Reels gönderilerini gizle', desc: 'Ana akıştaki Reels videoları görünmez.' },
  { key: 'hideSuggested', title: 'Önerilen gönderileri gizle', desc: 'Takip etmediğin hesapların gönderileri görünmez.' },
  {
    key: 'hideExplore',
    title: 'Keşfet içeriğini gizle (deneysel)',
    desc: 'Keşfet sayfasındaki gönderiler gizlenir; arama kutusu kalır.',
  },
];

type Props = {
  visible: boolean;
  settings: Settings;
  rules: Rules;
  onChangeSetting: (key: keyof Settings, value: boolean) => void;
  onUpdateRules: () => Promise<UpdateResult>;
  onRefresh: () => void;
  onClose: () => void;
};

export function SettingsModal({ visible, settings, rules, onChangeSetting, onUpdateRules, onRefresh, onClose }: Props) {
  const dark = useColorScheme() === 'dark';
  const c = dark ? COLORS.dark : COLORS.light;
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');

  const update = async () => {
    setBusy(true);
    setResult('');
    const r = await onUpdateRules();
    setBusy(false);
    setResult(
      r.status === 'current' ? 'Güncel' : r.status === 'updated' ? `Güncellendi: sürüm ${r.rules.version}` : 'Güncellenemedi',
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* Modal ayrı bir pencere olduğu için güvenli alan ölçümü burada yeniden başlar. */}
      <SafeAreaProvider>
        <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]}>Ayarlar</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Kapat">
              <Text style={[styles.close, { color: c.text }]}>Bitti</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            {ROWS.map((row) => (
              <View key={row.key} style={[styles.row, { borderColor: c.line }]}>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: c.text }]}>{row.title}</Text>
                  <Text style={[styles.rowDesc, { color: c.sub }]}>{row.desc}</Text>
                </View>
                <Switch value={settings[row.key]} onValueChange={(v) => onChangeSetting(row.key, v)} />
              </View>
            ))}

            <Text style={[styles.version, { color: c.sub }]}>Kural sürümü: {rules.version}</Text>
            <Pressable
              style={[styles.button, { backgroundColor: c.button, opacity: busy ? 0.5 : 1 }]}
              onPress={update}
              disabled={busy}
            >
              <Text style={[styles.buttonText, { color: c.buttonText }]}>
                {busy ? 'Güncelleniyor…' : 'Kuralları şimdi güncelle'}
              </Text>
            </Pressable>
            {result !== '' && <Text style={[styles.result, { color: c.sub }]}>{result}</Text>}
            <Pressable style={[styles.button, { backgroundColor: c.button }]} onPress={onRefresh}>
              <Text style={[styles.buttonText, { color: c.buttonText }]}>Sayfayı yenile</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const COLORS = {
  light: { bg: '#fff', text: '#111', sub: '#666', line: '#e3e3e3', button: '#111', buttonText: '#fff' },
  dark: { bg: '#121212', text: '#f2f2f2', sub: '#9a9a9a', line: '#2c2c2c', button: '#f2f2f2', buttonText: '#111' },
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 22, fontWeight: '700' },
  close: { fontSize: 16, fontWeight: '600' },
  body: { paddingHorizontal: 20, paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  rowText: { flex: 1, paddingRight: 12 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowDesc: { fontSize: 13, marginTop: 2 },
  version: { fontSize: 14, marginTop: 24, marginBottom: 12 },
  button: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  buttonText: { fontSize: 15, fontWeight: '600' },
  result: { fontSize: 14, marginTop: 8, textAlign: 'center' },
});
