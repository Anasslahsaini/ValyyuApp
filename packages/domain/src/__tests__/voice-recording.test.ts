import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  audioMime,
  base64Bytes,
  clampDuration,
  COMMAND_MAX_MS,
  MAX_AUDIO_BYTES,
  ONBOARDING_MAX_MS,
  RECORDING_BIT_RATE,
  recordingProblem,
  secondsLeft,
} from '../voice/recording';

test('duration limits: 30 s per command, 3 min for the first launch', () => {
  assert.equal(COMMAND_MAX_MS, 30_000);
  assert.equal(ONBOARDING_MAX_MS, 180_000);
  assert.equal(recordingProblem(5_000, 20_000), null);
  assert.equal(recordingProblem(30_400, 120_000), null); // auto-stop timer a little late
  assert.equal(recordingProblem(32_000, 120_000), 'tooLong');
  assert.equal(recordingProblem(120_000, 480_000, ONBOARDING_MAX_MS), null);
  assert.equal(recordingProblem(200, 1_000), 'tooShort');
  assert.equal(recordingProblem(3_000, 0), 'tooShort');
  assert.equal(recordingProblem(10_000, MAX_AUDIO_BYTES + 1), 'tooBig');
  assert.equal(clampDuration(30_480), 30_000);
  assert.equal(clampDuration(-3), 0);
});

test('the recording bit rate keeps 3 minutes under the 1 MB server limit', () => {
  assert.ok((RECORDING_BIT_RATE / 8) * (ONBOARDING_MAX_MS / 1000) < MAX_AUDIO_BYTES);
});

test('seconds left before the automatic stop', () => {
  assert.equal(secondsLeft(0), 30);
  assert.equal(secondsLeft(29_100), 1);
  assert.equal(secondsLeft(31_000), 0);
});

test('mime type from blob type or file extension', () => {
  assert.equal(audioMime('file:///x/rec.m4a'), 'audio/mp4');
  assert.equal(audioMime('blob:http://localhost/abc', 'audio/webm;codecs=opus'), 'audio/webm');
  assert.equal(audioMime('file:///x/rec.wav'), 'audio/wav');
  assert.equal(audioMime('file:///x/rec.3gp'), 'audio/mp4');
  assert.equal(audioMime('blob:x', 'audio/x-m4a'), 'audio/mp4');
});

test('base64 decoded size', () => {
  assert.equal(base64Bytes(Buffer.from('hello').toString('base64')), 5);
  assert.equal(base64Bytes(Buffer.from('hello!').toString('base64')), 6);
  assert.equal(base64Bytes(''), 0);
});
