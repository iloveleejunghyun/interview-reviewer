// Explicit AI-data consent screen (the fix for PiggyNotebook's Apple rejection).
// Nothing that records or calls the network renders until the user agrees.
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export type DataRecipient = { name: string; purpose: string };

type Props = {
  appName: string;
  dataSent: string;
  recipients: DataRecipient[];
  // Bump when the recipients or data change, so users are asked again.
  consentVersion: number;
  // Called when the user taps Agree or Decline (not when a stored grant is restored).
  onDecision?: (decision: 'agreed' | 'declined') => void;
  children: ReactNode;
};

const storageKey = (v: number) => `ai_consent_v${v}`;

export function ConsentGate({
  appName,
  dataSent,
  recipients,
  consentVersion,
  onDecision,
  children,
}: Props) {
  const [status, setStatus] = useState<'loading' | 'ask' | 'declined' | 'granted'>('loading');

  useEffect(() => {
    SecureStore.getItemAsync(storageKey(consentVersion))
      .then((v) => setStatus(v === 'granted' ? 'granted' : 'ask'))
      .catch(() => setStatus('ask'));
  }, [consentVersion]);

  const agree = async () => {
    await SecureStore.setItemAsync(storageKey(consentVersion), 'granted');
    setStatus('granted');
    onDecision?.('agreed');
  };

  const decline = () => {
    setStatus('declined');
    onDecision?.('declined');
  };

  if (status === 'loading') return <ActivityIndicator style={styles.center} />;
  if (status === 'granted') return <>{children}</>;

  if (status === 'declined') {
    return (
      <View style={[styles.center, styles.pad]}>
        <Text style={styles.body}>
          {appName} can't work without sending {dataSent} to the services listed. You can
          change your mind at any time.
        </Text>
        <Pressable style={styles.primary} onPress={() => setStatus('ask')}>
          <Text style={styles.primaryText}>Review again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.title}>Before you start</Text>
      <Text style={styles.body}>
        To work, {appName} sends {dataSent} to the following third-party AI services:
      </Text>
      {recipients.map((r) => (
        <View key={r.name} style={styles.recipient}>
          <Text style={styles.recipientName}>{r.name}</Text>
          <Text style={styles.body}>{r.purpose}</Text>
        </View>
      ))}
      <Text style={styles.body}>Nothing is recorded or sent unless you agree.</Text>
      <Pressable style={styles.primary} onPress={agree}>
        <Text style={styles.primaryText}>Agree</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={decline}>
        <Text style={styles.secondaryText}>Decline</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  pad: { padding: 24, paddingTop: 80, gap: 16 },
  title: { fontSize: 26, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22, color: '#333' },
  recipient: { padding: 12, borderRadius: 10, backgroundColor: '#f2f4f7', gap: 4 },
  recipientName: { fontSize: 16, fontWeight: '600' },
  primary: { backgroundColor: '#1f6feb', padding: 14, borderRadius: 10, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondary: { padding: 14, alignItems: 'center' },
  secondaryText: { color: '#555', fontSize: 16 },
});
