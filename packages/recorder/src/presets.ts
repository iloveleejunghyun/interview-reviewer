import { AudioQuality, IOSOutputFormat, type RecordingOptions } from 'expo-audio';

// Speech-optimized: 16 kHz mono AAC at 32 kbps is ~14 MB per hour, small
// enough to send a 60-minute recording to a transcription API in one request
// (verified with Volcengine flash: 56 min, 13 MB, transcribed in 42 s).
// Saved to the document directory so iOS never purges it like the cache.
export const SPEECH_PRESET: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  directory: 'document',
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 32000,
  },
};
