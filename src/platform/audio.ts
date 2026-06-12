import type { KVStore } from './Storage';

export const MUTE_KEY = 'uf.muted';

/**
 * All SFX are synthesized in WebAudio — no asset downloads, and everything
 * runs through a lowpass so it reads as muffled/underwater. The context is
 * created lazily on the first user gesture (iOS Safari unlock pattern, §8).
 */
export class SfxSynth {
  private ctx?: AudioContext;
  private master?: GainNode;
  private ambient?: { gain: GainNode; stop: () => void };
  private muted: boolean;

  constructor(private readonly store: KVStore) {
    this.muted = store.get(MUTE_KEY) === '1';
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.store.set(MUTE_KEY, this.muted ? '1' : '0');
    if (this.master) {
      this.master.gain.value = this.muted ? 0 : 1;
    }
    return this.muted;
  }

  /** Must be called from a user-gesture handler at least once. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    // Global "underwater" voicing: everything is lowpassed.
    const muffle = this.ctx.createBiquadFilter();
    muffle.type = 'lowpass';
    muffle.frequency.value = 1100;
    this.master.connect(muffle);
    muffle.connect(this.ctx.destination);
  }

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    duration: number,
    peak: number,
    delay = 0,
  ): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + duration);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  /** Soft "blub" on swim tap. */
  tap(): void {
    this.tone('sine', 320, 170, 0.13, 0.25);
  }

  /** Two-note muffled chime per gate. */
  score(): void {
    this.tone('triangle', 620, 620, 0.09, 0.22);
    this.tone('triangle', 830, 830, 0.14, 0.18, 0.07);
  }

  /** Low thud + descending groan. */
  death(): void {
    this.tone('sine', 140, 52, 0.4, 0.5);
    this.tone('square', 90, 38, 0.3, 0.12, 0.04);
  }

  /** Gentle filtered-noise water bed; safe to call repeatedly. */
  startAmbient(): void {
    if (!this.ctx || !this.master || this.ambient) return;
    const len = 2 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // Brown-ish noise: integrate white noise for a deep wash.
      last = (last + (Math.random() * 2 - 1) * 0.02) * 0.998;
      data[i] = last * 3.5;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 240;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.16;
    src.connect(lp);
    lp.connect(gain);
    gain.connect(this.master);
    src.start();
    this.ambient = { gain, stop: () => src.stop() };
  }

  stopAmbient(): void {
    this.ambient?.stop();
    this.ambient = undefined;
  }
}
