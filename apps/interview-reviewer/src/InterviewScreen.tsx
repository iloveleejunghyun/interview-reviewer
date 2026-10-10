// One interview: processing status, or the question-by-question review.
import { File } from 'expo-file-system';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { analytics } from './analytics';
import { formatDate, formatDuration } from './format';
import { FIXED_AREAS, type AreaScore, type Rating, type ReviewedQuestion } from './interviews/review';
import { audioUri, type Interview } from './interviews/store';
import { ProgressBar } from './replay/ProgressBar';
import { questionClips, useQuestionReplay, type Clip } from './replay/useQuestionReplay';

const RATING_STYLE: Record<Rating, { label: string; color: string }> = {
  strong: { label: 'Strong', color: '#1a7f37' },
  ok: { label: 'OK', color: '#9a6700' },
  weak: { label: 'Weak', color: '#d1242f' },
};

type Props = {
  interview: Interview;
  // 1-based position among all interviews, oldest first (for analytics).
  index: number;
  // Latest earlier score per area name, for the ↑ ↓ = comparison.
  previousScores: Map<string, number>;
  onBack: () => void;
  onRetry: () => void;
};

export function InterviewScreen({ interview, index, previousScores, onBack, onRetry }: Props) {
  const done = interview.status === 'done';
  const uri = useMemo(() => {
    const f = new File(audioUri(interview));
    return f.exists ? f.uri : null;
  }, [interview]);
  const replay = useQuestionReplay(done ? uri : null);
  const clips = useMemo(
    () => (interview.review ? questionClips(interview.review.questions, interview.transcript) : []),
    [interview.review, interview.transcript],
  );

  useEffect(() => {
    if (done) analytics.track('review_opened', { interview_index: index });
  }, [done, index]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>‹ Interviews</Text>
        </Pressable>
        <Text style={styles.meta}>
          {formatDate(interview.createdAt)} · {formatDuration(interview.durationMs)}
        </Text>
      </View>

      {(interview.status === 'recorded' || interview.status === 'transcribing' || interview.status === 'reviewing') && (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.statusText}>
            {interview.status === 'reviewing' ? 'Reviewing your answers…' : 'Transcribing the recording…'}
          </Text>
          <Text style={styles.hint}>
            This takes about a minute. If you leave the app, it continues when you come back.
          </Text>
        </View>
      )}

      {interview.status === 'no-speech' && (
        <View style={styles.center}>
          <Text style={styles.statusText}>Not enough speech to review</Text>
          <Text style={styles.hint}>
            The recording didn't pick up enough of the conversation. Next time, put the phone close to the speaker,
            and don't use headphones on the interview device.
          </Text>
        </View>
      )}

      {interview.status === 'failed' && (
        <View style={styles.center}>
          <Text style={styles.failTitle}>
            {interview.failedStep === 'review' ? 'The review failed' : 'Transcription failed'}
          </Text>
          <Text style={styles.failText}>{interview.error}</Text>
          <Pressable style={styles.retry} onPress={onRetry}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {done && interview.review && (
        <ScrollView contentContainerStyle={styles.content}>
          {interview.review.interviewType && (
            <Text style={styles.typeLabel}>
              {interview.review.interviewType.round}
              {interview.review.interviewType.interviewer ? ` · with ${interview.review.interviewType.interviewer}` : ''}
            </Text>
          )}
          {interview.review.areas && interview.review.areas.length > 0 && (
            <ScoresCard
              overall={interview.review.overallScore}
              areas={interview.review.areas}
              previousScores={previousScores}
            />
          )}
          {interview.review.overall.topImprovements.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Work on these first</Text>
              {interview.review.overall.topImprovements.map((t, i) => (
                <Text key={i} style={styles.bullet}>
                  {i + 1}. {t}
                </Text>
              ))}
            </View>
          )}
          {interview.review.overall.strengths.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>What went well</Text>
              {interview.review.overall.strengths.map((t, i) => (
                <Text key={i} style={styles.bullet}>
                  • {t}
                </Text>
              ))}
            </View>
          )}
          <Text style={styles.section}>Question by question</Text>
          {interview.review.questions.map((q, i) => (
            <QuestionCard
              key={i}
              q={q}
              clip={replay.available ? clips[i] : null}
              active={replay.activeIndex === i}
              onPlay={(clip) => void replay.playClip(i, clip)}
            />
          ))}
          <Text style={styles.footnote}>
            Reviews are generated by AI from an automatic transcript and can contain mistakes. Text in [brackets] is
            for you to fill in with your own details.
          </Text>
        </ScrollView>
      )}
      {done && replay.activeIndex !== null && (
        <PlayerBar
          title={`Question ${replay.activeIndex + 1}`}
          playing={replay.playing}
          currentMs={replay.currentMs}
          clip={replay.clip}
          clipEndMs={replay.clipEndMs}
          onToggle={replay.toggle}
          onBack={replay.back}
          onForward={replay.forward}
          onSeek={replay.seekToMs}
          onClose={replay.close}
        />
      )}
    </SafeAreaView>
  );
}

// Scores move by ±0.5 between runs on the same answer, so only a change of a
// full point or more counts as up or down.
function trend(score: number, previous: number | undefined) {
  if (previous === undefined) return null;
  const d = score - previous;
  if (d >= 1) return { label: `↑ from ${previous}`, color: '#1a7f37' };
  if (d <= -1) return { label: `↓ from ${previous}`, color: '#d1242f' };
  return { label: `= ${previous} last time`, color: '#888' };
}

function ScoresCard({
  overall,
  areas,
  previousScores,
}: {
  overall?: number;
  areas: AreaScore[];
  previousScores: Map<string, number>;
}) {
  // Specific areas first (weakest first: that's what to study), fixed ones last.
  const sorted = [...areas].sort((a, b) => {
    const fa = FIXED_AREAS.includes(a.name) ? 1 : 0;
    const fb = FIXED_AREAS.includes(b.name) ? 1 : 0;
    return fa - fb || a.score - b.score;
  });
  return (
    <View style={styles.card}>
      <View style={styles.qHeader}>
        <Text style={styles.cardTitle}>Scores</Text>
        {overall !== undefined && <Text style={styles.overall}>Overall {overall}/10</Text>}
      </View>
      {sorted.map((a) => {
        const t = trend(a.score, previousScores.get(a.name));
        return (
          <View key={a.name} style={styles.area}>
            <View style={styles.qHeader}>
              <Text style={styles.areaName}>{a.name}</Text>
              <Text style={styles.areaScore}>{a.score}/10</Text>
            </View>
            {t && <Text style={[styles.trend, { color: t.color }]}>{t.label}</Text>}
            {!!a.why && <Text style={styles.body}>{a.why}</Text>}
            {!!a.tip && <Text style={styles.tip}>Practice: {a.tip}</Text>}
          </View>
        );
      })}
    </View>
  );
}

function PlayerBar(props: {
  title: string;
  playing: boolean;
  currentMs: number;
  clip: Clip | null;
  clipEndMs: number;
  onToggle: () => void;
  onBack: () => void;
  onForward: () => void;
  onSeek: (ms: number) => void;
  onClose: () => void;
}) {
  const start = props.clip?.startMs ?? 0;
  return (
    <View style={styles.player}>
      <View style={styles.playerRow}>
        <View style={styles.playerInfo}>
          <Text style={styles.playerTitle}>{props.title}</Text>
          <Text style={styles.playerTime}>
            {formatDuration(props.currentMs)} / {formatDuration(props.clipEndMs)}
          </Text>
        </View>
        <Pressable onPress={props.onBack} hitSlop={10} accessibilityLabel="Back 5 seconds">
          <Text style={styles.playerButton}>↺ 5</Text>
        </Pressable>
        <Pressable onPress={props.onToggle} hitSlop={10} accessibilityLabel={props.playing ? 'Pause' : 'Play'}>
          <Text style={[styles.playerButton, styles.playerMain]}>{props.playing ? '❚❚' : '▶'}</Text>
        </Pressable>
        <Pressable onPress={props.onForward} hitSlop={10} accessibilityLabel="Forward 5 seconds">
          <Text style={styles.playerButton}>5 ↻</Text>
        </Pressable>
        <Pressable onPress={props.onClose} hitSlop={10} accessibilityLabel="Close player">
          <Text style={styles.playerButton}>✕</Text>
        </Pressable>
      </View>
      {props.clipEndMs > start && (
        <ProgressBar startMs={start} endMs={props.clipEndMs} currentMs={props.currentMs} onSeek={props.onSeek} />
      )}
    </View>
  );
}

function QuestionCard({
  q,
  clip,
  active,
  onPlay,
}: {
  q: ReviewedQuestion;
  clip: Clip | null;
  active: boolean;
  onPlay: (clip: Clip) => void;
}) {
  const rating = RATING_STYLE[q.rating];
  return (
    <View style={[styles.card, active && styles.cardActive]}>
      <View style={styles.qHeader}>
        <Text style={[styles.badge, { color: rating.color, borderColor: rating.color }]}>{rating.label}</Text>
        {clip ? (
          <Pressable onPress={() => onPlay(clip)} hitSlop={10} accessibilityLabel={`Play from ${q.timestamp}`}>
            <Text style={styles.playLink}>▶ {q.timestamp}</Text>
          </Pressable>
        ) : (
          !!q.timestamp && <Text style={styles.timestamp}>{q.timestamp}</Text>
        )}
      </View>
      <Text style={styles.question}>{q.question}</Text>
      {q.inferred && <Text style={styles.inferred}>This question wasn't clearly captured; reconstructed from your answer.</Text>}
      <Text style={styles.label}>What you said</Text>
      <Text style={styles.body}>{q.answerSummary}</Text>
      {q.whatWasWeak.length > 0 && (
        <>
          <Text style={styles.label}>What to improve</Text>
          {q.whatWasWeak.map((w, i) => (
            <Text key={i} style={styles.body}>
              • {w}
            </Text>
          ))}
        </>
      )}
      {!!q.strongerAnswer && (
        <>
          <Text style={styles.label}>A stronger answer</Text>
          {q.storySource === 'resume' && (
            <Text style={styles.storyNote}>
              Uses a different story from your resume{q.storyNote ? `: ${q.storyNote}` : '.'}
            </Text>
          )}
          <Text style={[styles.body, styles.stronger]}>{q.strongerAnswer}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f7f9' },
  header: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  back: { fontSize: 17, color: '#1f6feb' },
  meta: { fontSize: 14, color: '#666' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  statusText: { fontSize: 17, fontWeight: '500' },
  hint: { fontSize: 14, color: '#666', textAlign: 'center' },
  failTitle: { fontSize: 18, fontWeight: '600', color: '#d1242f' },
  failText: { fontSize: 15, color: '#333', textAlign: 'center' },
  retry: { backgroundColor: '#1f6feb', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 999, marginTop: 8 },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  content: { padding: 16, gap: 12, paddingBottom: 120 },
  section: { fontSize: 13, fontWeight: '600', color: '#666', textTransform: 'uppercase', marginTop: 8 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 6 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  bullet: { fontSize: 15, lineHeight: 21, color: '#333' },
  qHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { fontSize: 12, fontWeight: '700', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  timestamp: { fontSize: 13, color: '#888', fontVariant: ['tabular-nums'] },
  playLink: { fontSize: 14, fontWeight: '600', color: '#1f6feb', fontVariant: ['tabular-nums'] },
  cardActive: { borderWidth: 2, borderColor: '#1f6feb' },
  player: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 24,
    paddingTop: 12,
    paddingBottom: 4,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#1c1f24',
  },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  playerInfo: { flex: 1 },
  playerTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  playerTime: { color: '#aab', fontSize: 13, fontVariant: ['tabular-nums'] },
  playerButton: { color: '#fff', fontSize: 16, fontWeight: '600' },
  playerMain: { fontSize: 20 },
  question: { fontSize: 17, fontWeight: '600', lineHeight: 23 },
  inferred: { fontSize: 13, color: '#9a6700', fontStyle: 'italic' },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginTop: 8 },
  body: { fontSize: 15, lineHeight: 21, color: '#333' },
  stronger: { backgroundColor: '#eef6ff', borderRadius: 8, padding: 10, overflow: 'hidden' },
  footnote: { fontSize: 12, color: '#888', textAlign: 'center', marginTop: 8 },
  overall: { fontSize: 16, fontWeight: '700', color: '#1f6feb' },
  typeLabel: { fontSize: 14, fontWeight: '600', color: '#555', textTransform: 'uppercase' },
  area: { paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e3e5e8', gap: 3 },
  areaName: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  areaScore: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  trend: { fontSize: 13, fontWeight: '600' },
  tip: { fontSize: 14, lineHeight: 20, color: '#1f6feb' },
  storyNote: { fontSize: 13, color: '#8250df', fontStyle: 'italic' },
});
