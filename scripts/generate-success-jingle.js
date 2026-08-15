/* global Buffer, __dirname */

const fs = require('node:fs');
const path = require('node:path');

const sampleRate = 44100;
const jingles = [
  {
    file: 'success-ta-da.wav',
    duration: 1.65,
    instrument: 'fanfare',
    notes: [
      [392, 0, 0.35],
      [523.25, 0.08, 0.38],
      [659.25, 0.58, 0.8],
      [783.99, 0.62, 0.72],
    ],
  },
  {
    file: 'success-rise-sparkle.wav',
    duration: 1.8,
    instrument: 'bell',
    notes: [
      [523.25, 0, 0.32],
      [659.25, 0.25, 0.36],
      [783.99, 0.52, 0.42],
      [1174.66, 0.9, 0.78],
    ],
  },
  {
    file: 'success-ding-chime.wav',
    duration: 1.5,
    instrument: 'chime',
    notes: [
      [880, 0, 0.3],
      [987.77, 0.3, 0.32],
      [1108.73, 0.58, 0.34],
      [1567.98, 0.82, 0.62],
    ],
  },
  {
    file: 'success-arcade-level-up.wav',
    duration: 2.05,
    instrument: 'arcade',
    notes: [
      [261.63, 0, 0.18],
      [329.63, 0.18, 0.18],
      [392, 0.36, 0.18],
      [523.25, 0.54, 0.22],
      [659.25, 0.76, 0.22],
      [783.99, 1.02, 0.7],
    ],
  },
  {
    file: 'success-marimba-pop.wav',
    duration: 1.7,
    instrument: 'marimba',
    notes: [
      [523.25, 0, 0.32],
      [392, 0.28, 0.3],
      [659.25, 0.56, 0.32],
      [523.25, 0.84, 0.3],
      [783.99, 1.1, 0.5],
    ],
  },
  {
    file: 'success-magic-sparkle.wav',
    duration: 2.25,
    instrument: 'magic',
    notes: [
      [1046.5, 0, 0.5],
      [1318.51, 0.22, 0.58],
      [1567.98, 0.48, 0.64],
      [2093, 0.82, 1.1],
    ],
  },
];

function oscillator(instrument, frequency, time) {
  const phase = 2 * Math.PI * frequency * time;
  if (instrument === 'arcade') return Math.sin(phase) >= 0 ? 0.72 : -0.72;
  if (instrument === 'marimba') return Math.sin(phase) + 0.42 * Math.sin(phase * 3);
  if (instrument === 'fanfare')
    return Math.sin(phase) + 0.36 * Math.sin(phase * 2) + 0.16 * Math.sin(phase * 3);
  if (instrument === 'magic')
    return Math.sin(phase) + 0.34 * Math.sin(phase * 2.7) + 0.22 * Math.sin(phase * 4.2);
  if (instrument === 'chime')
    return Math.sin(phase) + 0.48 * Math.sin(phase * 2.01) + 0.2 * Math.sin(phase * 4.04);
  return Math.sin(phase) + 0.3 * Math.sin(phase * 2) + 0.16 * Math.sin(phase * 4);
}

function envelope(instrument, time, duration) {
  const attack = Math.min(1, time / (instrument === 'fanfare' ? 0.045 : 0.012));
  const power = instrument === 'marimba' ? 4.8 : instrument === 'arcade' ? 1.6 : 2.5;
  return attack * Math.pow(1 - time / duration, power);
}

function createWav({ duration, instrument, notes }) {
  const sampleCount = Math.floor(sampleRate * duration);
  const pcm = Buffer.alloc(sampleCount * 2);
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    let signal = 0;
    for (const [frequency, start, noteDuration] of notes) {
      const localTime = time - start;
      if (localTime < 0 || localTime > noteDuration) continue;
      signal +=
        envelope(instrument, localTime, noteDuration) *
        oscillator(instrument, frequency, localTime);
    }
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, signal * 0.22)) * 32767), index * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

const outputDirectory = path.join(__dirname, '..', 'assets', 'audio');
fs.mkdirSync(outputDirectory, { recursive: true });
for (const jingle of jingles)
  fs.writeFileSync(path.join(outputDirectory, jingle.file), createWav(jingle));
