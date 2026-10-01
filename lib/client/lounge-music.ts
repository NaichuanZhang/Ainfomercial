/**
 * The channel's background music, synthesized in the browser with Web Audio.
 *
 * Orbis generates sound from the picture, and with a host in frame that sound is garbled
 * speech that fights the host's TTS voice. So Orbis audio is switched off and every tab plays
 * this soft retro-lounge loop instead: electric-piano chords (Cmaj7 / Am7 / Dm7 / G7), a walking
 * bass and brushed drums at 92 BPM. It ducks under the host voice. No audio files, no licensing.
 */

const BPM = 92;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const LOOKAHEAD_S = 0.25;
const TICK_MS = 50;
const BASE_GAIN = 0.2;
const DUCKED_GAIN = 0.06;

/** Chord tones (MIDI) and bass roots per bar. */
const BARS = [
  { chord: [60, 64, 67, 71], bass: [36, 43, 40, 43] }, // Cmaj7
  { chord: [57, 60, 64, 67], bass: [33, 40, 36, 40] }, // Am7
  { chord: [62, 65, 69, 72], bass: [38, 45, 41, 45] }, // Dm7
  { chord: [55, 59, 62, 65], bass: [31, 38, 35, 38] }, // G7
];

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export type LoungeMusic = {
  start: () => void;
  stop: () => void;
  setMuted: (muted: boolean) => void;
  setDucked: (ducked: boolean) => void;
};

/** The synth graph and its bar scheduler, on any audio context (offline rendering included). */
export function buildLounge(ctx: BaseAudioContext) {
  const master = ctx.createGain();
  master.gain.value = 0;
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 4200;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 3;
  tone.connect(comp).connect(master).connect(ctx.destination);

  // A short generated room so the piano does not sound dry.
  const reverb = ctx.createConvolver();
  const length = Math.floor(ctx.sampleRate * 1.6);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2.5;
  }
  reverb.buffer = impulse;
  const wet = ctx.createGain();
  wet.gain.value = 0.25;
  reverb.connect(wet).connect(tone);

  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const noiseData = noise.getChannelData(0);
  for (let i = 0; i < noiseData.length; i += 1) noiseData[i] = Math.random() * 2 - 1;

  /** Electric-piano voice: sine body plus a soft FM bell on the attack. */
  const piano = (midi: number, at: number, duration: number, level: number) => {
    const freq = hz(midi);
    const carrier = ctx.createOscillator();
    carrier.frequency.value = freq;
    const modulator = ctx.createOscillator();
    modulator.frequency.value = freq * 2;
    const modDepth = ctx.createGain();
    modDepth.gain.setValueAtTime(freq * 1.2, at);
    modDepth.gain.exponentialRampToValueAtTime(freq * 0.05, at + 0.4);
    modulator.connect(modDepth).connect(carrier.frequency);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(level, at + 0.01);
    amp.gain.exponentialRampToValueAtTime(level * 0.35, at + 0.6);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    carrier.connect(amp);
    amp.connect(tone);
    amp.connect(reverb);
    carrier.start(at);
    modulator.start(at);
    carrier.stop(at + duration + 0.05);
    modulator.stop(at + duration + 0.05);
  };

  const bass = (midi: number, at: number, duration: number) => {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = hz(midi);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(0.5, at + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(filter).connect(amp).connect(tone);
    osc.start(at);
    osc.stop(at + duration + 0.05);
  };

  const brush = (at: number, level: number, duration: number) => {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 5000;
    band.Q.value = 0.7;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(level, at + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(band).connect(amp).connect(tone);
    source.start(at, Math.random() * 0.5);
    source.stop(at + duration + 0.05);
  };

  const scheduleBar = (index: number, at: number) => {
    const bar = BARS[index % BARS.length];
    // Comping: beat 1 and the "and" of 2, a little swing.
    for (const offset of [0, BEAT * 1.6]) {
      bar.chord.forEach((note, i) => piano(note, at + offset + i * 0.012, BEAT * 1.8, 0.07));
    }
    bar.bass.forEach((note, beat) => bass(note, at + beat * BEAT, BEAT * 0.9));
    for (let eighth = 0; eighth < 8; eighth += 1) {
      const swing = eighth % 2 ? BEAT * 0.16 : 0;
      brush(at + (eighth * BEAT) / 2 + swing, eighth % 4 === 2 ? 0.09 : 0.035, 0.12);
    }
  };

  return { master, scheduleBar };
}

/** Render `bars` bars to an AudioBuffer (used to audition the loop outside the app). */
export async function renderLounge(ctx: OfflineAudioContext, bars: number) {
  const { master, scheduleBar } = buildLounge(ctx);
  master.gain.value = BASE_GAIN;
  for (let i = 0; i < bars; i += 1) scheduleBar(i, 0.05 + i * BAR);
  return ctx.startRendering();
}

export function createLoungeMusic(): LoungeMusic | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  const ctx = new Ctor();
  const { master, scheduleBar } = buildLounge(ctx);

  let timer: ReturnType<typeof setInterval> | null = null;
  let nextBarAt = 0;
  let barIndex = 0;
  let muted = false;
  let ducked = false;

  const applyGain = () => {
    const target = muted ? 0 : ducked ? DUCKED_GAIN : BASE_GAIN;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(target, ctx.currentTime, 0.25);
  };

  return {
    start() {
      void ctx.resume();
      if (timer) return;
      nextBarAt = ctx.currentTime + 0.1;
      timer = setInterval(() => {
        while (nextBarAt < ctx.currentTime + LOOKAHEAD_S + BAR) {
          scheduleBar(barIndex, nextBarAt);
          barIndex += 1;
          nextBarAt += BAR;
        }
      }, TICK_MS);
      applyGain();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      setTimeout(() => void ctx.close().catch(() => undefined), 400);
    },
    setMuted(next) {
      muted = next;
      applyGain();
    },
    setDucked(next) {
      ducked = next;
      applyGain();
    },
  };
}
