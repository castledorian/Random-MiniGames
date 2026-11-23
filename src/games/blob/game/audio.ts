import { load, save } from './storage';

type OscType = OscillatorType;

interface ToneOpts {
  f: number;
  to?: number;
  dur: number;
  type?: OscType;
  vol?: number;
  delay?: number;
  attack?: number;
}

const SCALE = [0, 2, 4, 7, 9];
const noteHz = (i: number) => 261.63 * Math.pow(2, (SCALE[i % 5] + 12 * Math.floor(i / 5)) / 12);

// Am F C G
const CHORDS = [
  { bass: 110, arp: [220, 261.63, 329.63, 261.63] },
  { bass: 87.31, arp: [174.61, 220, 261.63, 220] },
  { bass: 130.81, arp: [261.63, 329.63, 392, 329.63] },
  { bass: 98, arp: [196, 246.94, 293.66, 246.94] },
];

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  sfxOn = true;
  musicOn = true;
  private timer: number | null = null;
  private step = 0;
  private nextT = 0;
  private duck = 1;
  intensity = 0;
  private lastPlay: Record<string, number> = {};

  constructor() {
    const s = load();
    this.sfxOn = s.sfx;
    this.musicOn = s.music;
  }

  init() {
    if (!this.ctx) {
      const AC: typeof AudioContext | undefined =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = this.sfxOn ? 0.6 : 0;
      this.sfx.connect(this.master);
      this.music = this.ctx.createGain();
      this.music.gain.value = this.musicOn ? 0.5 * this.duck : 0;
      this.music.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.musicOn) this.startMusic();
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
    save({ sfx: on });
    if (this.sfx && this.ctx) this.sfx.gain.setTargetAtTime(on ? 0.6 : 0, this.ctx.currentTime, 0.02);
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    save({ music: on });
    if (this.music && this.ctx) this.music.gain.setTargetAtTime(on ? 0.5 * this.duck : 0, this.ctx.currentTime, 0.05);
    if (on) {
      this.init();
      this.startMusic();
    } else this.stopMusic();
  }

  setDuck(d: number) {
    this.duck = d;
    if (this.music && this.ctx && this.musicOn) this.music.gain.setTargetAtTime(0.5 * d, this.ctx.currentTime, 0.15);
  }

  private startMusic() {
    if (!this.ctx || this.timer !== null) return;
    this.nextT = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  private stopMusic() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.music) return;
    const tempo = 126 + this.intensity * 14;
    const dur = 60 / tempo / 2;
    while (this.nextT < ctx.currentTime + 0.18) {
      const bar = Math.floor(this.step / 8) % 4;
      const s = this.step % 8;
      const ch = CHORDS[bar];
      const t = this.nextT;
      if (s === 0 || s === 3 || s === 4 || (s === 6 && this.intensity > 0.4)) {
        this.toneAt(this.music, { f: ch.bass, dur: dur * 1.7, type: 'triangle', vol: 0.5 }, t);
      }
      const arpNote = ch.arp[s % 4] * (s >= 4 && this.intensity > 0.3 ? 2 : 1);
      this.toneAt(this.music, { f: arpNote, dur: dur * 0.8, type: 'square', vol: 0.07 + this.intensity * 0.04 }, t);
      if (s % 2 === 1) this.noiseAt(this.music, { dur: 0.04, vol: 0.06, f: 7000, type: 'highpass' }, t);
      if (s === 0) this.noiseAt(this.music, { dur: 0.09, vol: 0.14, f: 140, type: 'lowpass' }, t);
      this.step++;
      this.nextT += dur;
    }
  }

  private toneAt(dest: GainNode, o: ToneOpts, when: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, when);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), when + o.dur);
    const v = o.vol ?? 0.15;
    const a = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(v, when + a);
    g.gain.exponentialRampToValueAtTime(0.0001, when + o.dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(when);
    osc.stop(when + o.dur + 0.05);
  }

  private noiseAt(dest: GainNode, o: { dur: number; vol: number; f: number; to?: number; type?: BiquadFilterType }, when: number) {
    const ctx = this.ctx!;
    if (!this.noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = ctx.createBiquadFilter();
    filt.type = o.type || 'lowpass';
    filt.frequency.setValueAtTime(o.f, when);
    if (o.to) filt.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), when + o.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + o.dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(dest);
    src.start(when, Math.random() * 0.5);
    src.stop(when + o.dur + 0.05);
  }

  private tone(o: ToneOpts) {
    if (!this.ctx || !this.sfx || !this.sfxOn) return;
    this.toneAt(this.sfx, o, this.ctx.currentTime + (o.delay || 0));
  }

  private noise(o: { dur: number; vol: number; f: number; to?: number; type?: BiquadFilterType; delay?: number }) {
    if (!this.ctx || !this.sfx || !this.sfxOn) return;
    this.noiseAt(this.sfx, o, this.ctx.currentTime + (o.delay || 0));
  }

  play(name: string, n = 0) {
    if (!this.ctx || !this.sfxOn) return;
    // throttle spammy sounds
    const now = this.ctx.currentTime;
    const last = this.lastPlay[name] || 0;
    const minGap = name === 'move' ? 0.025 : name === 'land' ? 0.05 : 0;
    if (now - last < minGap) return;
    this.lastPlay[name] = now;

    switch (name) {
      case 'move':
        this.tone({ f: 330, to: 300, dur: 0.035, type: 'square', vol: 0.04 });
        break;
      case 'rotate':
        this.tone({ f: 420, to: 640, dur: 0.06, type: 'triangle', vol: 0.12 });
        break;
      case 'blocked':
        this.tone({ f: 140, dur: 0.06, type: 'square', vol: 0.06 });
        break;
      case 'lock':
        this.tone({ f: 170, to: 70, dur: 0.12, type: 'sine', vol: 0.3 });
        this.noise({ dur: 0.05, vol: 0.14, f: 900, type: 'lowpass' });
        break;
      case 'land':
        this.tone({ f: 120, to: 60, dur: 0.1, type: 'sine', vol: 0.18 });
        break;
      case 'harddrop':
        this.noise({ dur: 0.12, vol: 0.25, f: 4000, to: 300, type: 'bandpass' });
        this.tone({ f: 90, to: 40, dur: 0.18, type: 'sine', vol: 0.35 });
        break;
      case 'charge': {
        const f = noteHz(Math.min(n, 14)) * 2;
        this.tone({ f: f * 0.5, to: f, dur: 0.18, type: 'sine', vol: 0.12 });
        break;
      }
      case 'pop': {
        const i = Math.max(0, Math.min(n - 1, 14));
        const f = noteHz(i);
        this.tone({ f, dur: 0.22, type: 'triangle', vol: 0.26 });
        this.tone({ f: f * 2, dur: 0.14, type: 'sine', vol: 0.12, delay: 0.02 });
        if (n >= 3) this.tone({ f: f * 1.5, dur: 0.2, type: 'square', vol: 0.05, delay: 0.04 });
        this.noise({ dur: 0.08, vol: 0.22, f: 2200, to: 800, type: 'bandpass' });
        break;
      }
      case 'attack':
        this.noise({ dur: 0.35, vol: 0.18, f: 600, to: 3500, type: 'bandpass' });
        this.tone({ f: 300, to: 900, dur: 0.3, type: 'sawtooth', vol: 0.06 });
        break;
      case 'offset':
        this.tone({ f: 880, dur: 0.1, type: 'sine', vol: 0.2 });
        this.tone({ f: 1320, dur: 0.18, type: 'sine', vol: 0.18, delay: 0.07 });
        break;
      case 'hurt':
        this.tone({ f: 200, to: 90, dur: 0.22, type: 'sawtooth', vol: 0.12 });
        break;
      case 'garbageDrop':
        this.tone({ f: 100, to: 40, dur: 0.3, type: 'sine', vol: 0.45 });
        this.noise({ dur: 0.2, vol: 0.3, f: 700, to: 100, type: 'lowpass' });
        break;
      case 'fizzle':
        this.tone({ f: 160, dur: 0.1, type: 'square', vol: 0.08 });
        this.tone({ f: 120, dur: 0.14, type: 'square', vol: 0.08, delay: 0.1 });
        break;
      case 'skillReady':
        [660, 880, 1320].forEach((f, i) => this.tone({ f, dur: 0.15, type: 'triangle', vol: 0.14, delay: i * 0.07 }));
        break;
      case 'skill:ember':
        this.noise({ dur: 0.55, vol: 0.35, f: 300, to: 3000, type: 'bandpass' });
        this.tone({ f: 120, to: 480, dur: 0.5, type: 'sawtooth', vol: 0.14 });
        break;
      case 'skill:marina':
        this.tone({ f: 400, to: 1200, dur: 0.5, type: 'sine', vol: 0.2 });
        this.tone({ f: 600, to: 1800, dur: 0.5, type: 'sine', vol: 0.1, delay: 0.05 });
        this.noise({ dur: 0.5, vol: 0.12, f: 2500, to: 6000, type: 'highpass' });
        break;
      case 'skill:volt':
        for (let i = 0; i < 6; i++)
          this.tone({ f: 700 + Math.random() * 1600, to: 200, dur: 0.07, type: 'square', vol: 0.09, delay: i * 0.05 });
        this.noise({ dur: 0.4, vol: 0.2, f: 5000, type: 'highpass' });
        break;
      case 'skill:terra':
        this.tone({ f: 80, to: 200, dur: 0.45, type: 'triangle', vol: 0.3 });
        this.noise({ dur: 0.4, vol: 0.25, f: 500, to: 150, type: 'lowpass' });
        break;
      case 'allclear':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ f, dur: 0.25, type: 'triangle', vol: 0.2, delay: i * 0.07 }));
        break;
      case 'ready':
        this.tone({ f: 440, dur: 0.14, type: 'square', vol: 0.1 });
        break;
      case 'go':
        this.tone({ f: 880, dur: 0.3, type: 'square', vol: 0.12 });
        this.tone({ f: 1320, dur: 0.3, type: 'triangle', vol: 0.12 });
        break;
      case 'ko':
        this.noise({ dur: 0.7, vol: 0.4, f: 2500, to: 80, type: 'lowpass' });
        [440, 330, 220, 147].forEach((f, i) => this.tone({ f, dur: 0.3, type: 'sawtooth', vol: 0.12, delay: i * 0.14 }));
        break;
      case 'win':
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) =>
          this.tone({ f, dur: 0.22, type: 'triangle', vol: 0.2, delay: i * 0.09 })
        );
        break;
      case 'click':
        this.tone({ f: 600, to: 800, dur: 0.05, type: 'triangle', vol: 0.1 });
        break;
      case 'timeup':
        [880, 660, 440].forEach((f, i) => this.tone({ f, dur: 0.2, type: 'square', vol: 0.1, delay: i * 0.12 }));
        break;
    }
  }
}

export const audio = new AudioEngine();
