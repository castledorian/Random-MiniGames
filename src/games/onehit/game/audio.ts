// Fully synthesised audio: no assets. SFX + a tiny step-sequencer for music.

export type Sfx =
  | "jump" | "djump" | "land" | "slash" | "kill" | "throw" | "dash" | "parry" | "block"
  | "explode" | "death" | "clear" | "ui" | "warn" | "shoot" | "bounce" | "spawn" | "coin"
  | "unlock" | "empty" | "bubble" | "slam" | "catch" | "close" | "start";

const MIDI = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;
  private musicTimer: number | null = null;
  private step = 0;
  private nextTime = 0;
  intensity = 0;
  private lastPlay: Record<string, number> = {};

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    this.musicFilter = this.ctx.createBiquadFilter();
    this.musicFilter.type = "lowpass";
    this.musicFilter.frequency.value = 2400;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.55;
    this.musicFilter.connect(this.musicGain);
    this.musicGain.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.02);
  }

  /** Muffles the music (pause / menu) */
  setMuffled(on: boolean) {
    if (this.ctx) this.musicFilter.frequency.setTargetAtTime(on ? 380 : 2400, this.ctx.currentTime, 0.05);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0, dest?: AudioNode) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest ?? this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, type: BiquadFilterType, f0: number, f1: number, delay = 0, dest?: AudioNode) {
    const c = this.ctx;
    if (!c || !this.noiseBuf) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest ?? this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  play(name: Sfx) {
    if (!this.ctx || this.muted) return;
    // throttle identical sounds a little so mass events don't clip
    const now = performance.now();
    const minGap = name === "warn" ? 120 : name === "kill" ? 30 : 18;
    if (now - (this.lastPlay[name] ?? 0) < minGap) return;
    this.lastPlay[name] = now;
    switch (name) {
      case "jump": this.tone("square", 260, 560, 0.12, 0.05); break;
      case "djump": this.tone("triangle", 420, 900, 0.15, 0.09); this.noise(0.08, 0.05, "highpass", 3000, 3000); break;
      case "land": this.noise(0.07, 0.12, "lowpass", 600, 200); break;
      case "slash":
        this.noise(0.13, 0.2, "bandpass", 900, 3800);
        this.tone("sawtooth", 800, 180, 0.1, 0.05);
        break;
      case "kill":
        this.noise(0.22, 0.32, "lowpass", 3600, 300);
        this.tone("sine", 200, 45, 0.28, 0.42);
        this.tone("square", 620, 90, 0.12, 0.07);
        break;
      case "throw": this.tone("sawtooth", 950, 380, 0.12, 0.06); this.noise(0.08, 0.06, "highpass", 2500, 2500); break;
      case "dash": this.noise(0.22, 0.2, "highpass", 600, 2600); this.tone("sawtooth", 260, 1300, 0.16, 0.07); break;
      case "parry":
        this.tone("triangle", 1500, 1500, 0.25, 0.16);
        this.tone("triangle", 2250, 2250, 0.22, 0.1, 0.02);
        this.noise(0.05, 0.12, "highpass", 4000, 4000);
        break;
      case "block": this.tone("square", 220, 90, 0.1, 0.12); this.noise(0.06, 0.14, "bandpass", 2400, 2400); break;
      case "explode":
        this.noise(0.9, 0.55, "lowpass", 1400, 70);
        this.tone("sine", 110, 28, 0.7, 0.6);
        break;
      case "death":
        this.tone("sawtooth", 420, 38, 0.7, 0.2);
        this.noise(0.5, 0.3, "lowpass", 2400, 120);
        this.tone("sine", 140, 30, 0.6, 0.4);
        break;
      case "clear": [72, 76, 79, 84].forEach((n, i) => this.tone("square", MIDI(n), MIDI(n), 0.18, 0.07, i * 0.07)); break;
      case "unlock": [67, 72, 76, 79, 84, 88].forEach((n, i) => this.tone("triangle", MIDI(n), MIDI(n), 0.25, 0.12, i * 0.08)); break;
      case "start": [57, 64, 69].forEach((n, i) => this.tone("sawtooth", MIDI(n), MIDI(n) * 1.01, 0.3, 0.06, i * 0.06)); this.noise(0.3, 0.1, "highpass", 1000, 4000); break;
      case "ui": this.tone("square", 660, 880, 0.06, 0.05); break;
      case "warn": this.tone("square", 880, 880, 0.07, 0.035); break;
      case "shoot": this.tone("square", 760, 140, 0.14, 0.09); this.noise(0.06, 0.1, "highpass", 2000, 2000); break;
      case "bounce": this.tone("sine", 180, 720, 0.22, 0.2); break;
      case "spawn": this.tone("sawtooth", 90, 420, 0.28, 0.04); break;
      case "coin": this.tone("square", 988, 1319, 0.1, 0.04); break;
      case "empty": this.tone("square", 140, 110, 0.06, 0.06); break;
      case "bubble": this.tone("sine", 900, 120, 0.7, 0.2); this.tone("triangle", 120, 60, 0.7, 0.2); break;
      case "slam": this.noise(0.5, 0.5, "lowpass", 900, 60); this.tone("sine", 160, 30, 0.5, 0.6); break;
      case "catch": this.tone("triangle", 700, 1100, 0.08, 0.08); break;
      case "close": this.tone("sine", 1400, 500, 0.3, 0.08); break;
    }
  }

  // ------------------------------------------------------------- music
  startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.06;
    this.musicTimer = window.setInterval(() => this.schedule(), 40);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private schedule() {
    const c = this.ctx;
    if (!c) return;
    const spb = 60 / (118 + this.intensity * 3);
    const s16 = spb / 4;
    while (this.nextTime < c.currentTime + 0.15) {
      this.musicStep(this.step, this.nextTime - c.currentTime);
      this.nextTime += s16;
      this.step = (this.step + 1) % 64;
    }
  }

  private musicStep(i: number, delay: number) {
    if (this.muted) return;
    const dst = this.musicFilter;
    const s = i % 16;
    const bar = Math.floor(i / 16);
    if (s % 4 === 0) this.tone("sine", 150, 42, 0.2, 0.55, delay, dst); // kick
    if (s === 4 || s === 12) this.noise(0.14, 0.16, "bandpass", 1800, 1500, delay, dst); // snare
    if (s % 2 === 0) this.noise(0.04, s % 4 === 2 ? 0.07 : 0.03, "highpass", 7000, 7000, delay, dst); // hat
    const roots = [33, 33, 29, 31]; // A1 A1 F1 G1
    const root = roots[bar];
    const pat = [0, -1, 0, -1, 12, -1, 0, 7, 0, -1, 0, -1, 10, -1, 7, 5];
    const n = pat[s];
    if (n >= 0) {
      const f = MIDI(root + 12 + n);
      this.tone("sawtooth", f, f, 0.2, 0.2, delay, dst);
    }
    if (this.intensity > 0 && s % 2 === 1) {
      const arp = [0, 7, 12, 15, 12, 7, 3, 7];
      const f = MIDI(root + 36 + arp[(s >> 1) % 8]);
      this.tone("square", f, f, 0.1, 0.03 + this.intensity * 0.01, delay, dst);
    }
  }
}

export const audio = new AudioEngine();
