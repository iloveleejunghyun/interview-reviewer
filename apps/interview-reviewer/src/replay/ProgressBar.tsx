// Tap or drag to jump within the current question's clip. Built on React
// Native's touch responder system, so no slider library (and no native rebuild).
import { useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';

type Props = {
  startMs: number;
  endMs: number;
  currentMs: number;
  onSeek: (ms: number) => void;
};

export function ProgressBar({ startMs, endMs, currentMs, onSeek }: Props) {
  const [width, setWidth] = useState(0);
  // While dragging, show the finger's position instead of the player's.
  const [dragMs, setDragMs] = useState<number | null>(null);

  const span = Math.max(1, endMs - startMs);
  const toMs = (e: GestureResponderEvent) =>
    startMs + Math.min(1, Math.max(0, e.nativeEvent.locationX / Math.max(1, width))) * span;
  const shown = dragMs ?? currentMs;
  const ratio = Math.min(1, Math.max(0, (shown - startMs) / span));

  return (
    <View
      style={styles.hitArea}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => setDragMs(toMs(e))}
      onResponderMove={(e) => setDragMs(toMs(e))}
      onResponderRelease={(e) => {
        onSeek(toMs(e));
        setDragMs(null);
      }}
      onResponderTerminate={() => setDragMs(null)}
      accessibilityRole="adjustable"
      accessibilityLabel="Playback position"
    >
      {/* Children ignore touches so locationX is always measured on the bar itself. */}
      <View style={styles.track} pointerEvents="none">
        <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
      </View>
      <View style={[styles.thumb, { left: ratio * width - 7 }]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  // Taller than the visible track so it's easy to hit with a finger.
  hitArea: { height: 28, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: '#3a3f47', overflow: 'hidden' },
  fill: { height: 4, backgroundColor: '#4c9aff' },
  thumb: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff' },
});
