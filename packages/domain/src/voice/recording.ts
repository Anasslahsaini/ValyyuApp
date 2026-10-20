/**
 * Short voice recordings (pure, no React, no native module), used when the device has no speech recognition
 * (e.g. Expo Go): the audio goes to the AI agent for this request only and is never kept.
 */

/** A voice command: 30 s max, stopped automatically. */
export const COMMAND_MAX_MS = 30_000;
/** The voice first-launch ("tell me about you"): 3 min max. */
export const ONBOARDING_MAX_MS = 180_000;
/** Below this the recording is almost surely a mis-tap. */
export const MIN_RECORDING_MS = 600;
/** Same limit as the server (1 MB of audio). */
export const MAX_AUDIO_BYTES = 1_000_000;
/** Mono speech at 32 kbit/s: 30 s ≈ 120 kB, 3 min ≈ 720 kB, both under 1 MB. */
export const RECORDING_BIT_RATE = 32_000;
export const RECORDING_SAMPLE_RATE = 16_000;

export type AudioMime =
  'audio/mp4' | 'audio/m4a' | 'audio/aac' | 'audio/mpeg' | 'audio/wav' | 'audio/webm' | 'audio/ogg';
export type RecordedAudio = { base64: string; mimeType: AudioMime; durationMs: number };
export type RecordingProblem = 'tooShort' | 'tooLong' | 'tooBig';

/** MIME type from the browser blob type (web) or the file extension (native, m4a by default). */
export function audioMime(uri: string, blobType?: string): AudioMime {
  const type = (blobType ?? '').split(';')[0]!.trim().toLowerCase();
  if (type === 'audio/webm' || type === 'video/webm') return 'audio/webm';
  if (type === 'audio/ogg') return 'audio/ogg';
  if (type === 'audio/mp4' || type === 'audio/x-m4a' || type === 'audio/m4a') return 'audio/mp4';
  if (type === 'audio/wav' || type === 'audio/x-wav') return 'audio/wav';
  if (type === 'audio/mpeg') return 'audio/mpeg';
  if (type === 'audio/aac') return 'audio/aac';
  const ext = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(uri)?.[1]?.toLowerCase();
  if (ext === 'webm') return 'audio/webm';
  if (ext === 'ogg' || ext === 'opus') return 'audio/ogg';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'aac') return 'audio/aac';
  return 'audio/mp4';
}

/** Decoded size of a base64 string. */
export function base64Bytes(b64: string): number {
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

/** Why a recording cannot be sent (null when it can). */
export function recordingProblem(
  durationMs: number,
  bytes: number,
  maxMs = COMMAND_MAX_MS,
): RecordingProblem | null {
  if (durationMs < MIN_RECORDING_MS || bytes <= 0) return 'tooShort';
  // A little slack: the auto-stop timer can fire a few ms late.
  if (durationMs > maxMs + 1000) return 'tooLong';
  if (bytes > MAX_AUDIO_BYTES) return 'tooBig';
  return null;
}

/** Duration sent to the server, never above the limit. */
export const clampDuration = (durationMs: number, maxMs = COMMAND_MAX_MS) =>
  Math.max(0, Math.min(Math.round(durationMs), maxMs));

/** Whole seconds left before the automatic stop (shown under the mic). */
export const secondsLeft = (elapsedMs: number, maxMs = COMMAND_MAX_MS) =>
  Math.max(0, Math.ceil((maxMs - elapsedMs) / 1000));
