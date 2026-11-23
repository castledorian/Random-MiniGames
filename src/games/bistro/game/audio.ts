// Tiny WebAudio synth: every sound effect and the music loop are generated live (no asset files).

type Wave = OscillatorType;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;

  // music
  private musicTimer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private bpm = 122;
  private intensity = 0;

  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.55;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.16;
      this.musicBus.connect(this.master);
      // noise buffer
      const len = this.ctx.sampleRate * 1;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.02);
  }

  // ----- primitives -------------------------------------------------------
  private tone(freq: number, dur: number, type: Wave = 'square', vol = 0.3, slideTo?: number, delay = 0, bus?: GainNode) {
    const c = this.ctx;
    if (!c || this.muted) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  private noise(dur: number, vol = 0.3, freq = 1800, type: BiquadFilterType = 'lowpass', delay = 0, bus?: GainNode, q = 0.7) {
    const c = this.ctx;
    if (!c || this.muted || !this.noiseBuf) return;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus ?? this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.03);
  }

  // ----- sfx --------------------------------------------------------------
  pickup() {
    this.tone(520, 0.09, 'triangle', 0.35, 880);
  }
  place() {
    this.tone(300, 0.08, 'triangle', 0.35, 190);
    this.noise(0.04, 0.12, 900);
  }
  take() {
    this.tone(440, 0.07, 'triangle', 0.3, 760);
    this.tone(660, 0.07, 'triangle', 0.2, 990, 0.04);
  }
  chop() {
    this.noise(0.05, 0.4, 2600, 'highpass');
    this.tone(180 + Math.random() * 40, 0.05, 'square', 0.18, 90);
  }
  chopDone() {
    this.tone(660, 0.09, 'square', 0.22);
    this.tone(990, 0.14, 'square', 0.22, undefined, 0.07);
  }
  ding() {
    this.tone(1320, 0.35, 'sine', 0.35);
    this.tone(1980, 0.4, 'sine', 0.18, undefined, 0.02);
  }
  sizzle() {
    this.noise(0.12, 0.07, 5000, 'highpass');
  }
  alarm() {
    this.tone(880, 0.08, 'square', 0.18);
    this.tone(660, 0.08, 'square', 0.18, undefined, 0.09);
  }
  burn() {
    this.noise(0.5, 0.35, 700);
    this.tone(120, 0.45, 'sawtooth', 0.25, 50);
  }
  dash() {
    this.noise(0.22, 0.32, 900, 'bandpass', 0, undefined, 1.2);
    this.tone(260, 0.16, 'sawtooth', 0.14, 700);
  }
  blink() {
    this.tone(1400, 0.2, 'sine', 0.3, 300);
    this.tone(300, 0.22, 'sine', 0.3, 1600, 0.05);
    this.noise(0.15, 0.12, 6000, 'highpass');
  }
  slam() {
    this.tone(140, 0.35, 'sine', 0.6, 40);
    this.noise(0.3, 0.45, 600);
  }
  bump() {
    this.tone(200, 0.12, 'square', 0.28, 80);
    this.noise(0.08, 0.2, 800);
  }
  smash() {
    this.tone(220, 0.18, 'square', 0.35, 70);
    this.tone(1100, 0.1, 'square', 0.2, 300, 0.02);
    this.noise(0.14, 0.4, 1500);
  }
  squeak() {
    this.tone(1500, 0.07, 'square', 0.12, 2300);
    this.tone(2200, 0.07, 'square', 0.1, 1600, 0.08);
  }
  deliver(combo = 1) {
    const base = 523.25 * Math.pow(1.0595, Math.min(combo - 1, 7) * 2);
    this.tone(base, 0.12, 'square', 0.25);
    this.tone(base * 1.25, 0.12, 'square', 0.25, undefined, 0.08);
    this.tone(base * 1.5, 0.12, 'square', 0.25, undefined, 0.16);
    this.tone(base * 2, 0.28, 'square', 0.28, undefined, 0.24);
    this.noise(0.25, 0.15, 7000, 'highpass', 0.24);
  }
  wrong() {
    this.tone(180, 0.18, 'sawtooth', 0.3, 130);
    this.tone(150, 0.22, 'sawtooth', 0.3, 100, 0.12);
  }
  deny() {
    this.tone(210, 0.1, 'square', 0.2, 150);
  }
  trash() {
    this.noise(0.22, 0.3, 500);
    this.tone(200, 0.2, 'triangle', 0.25, 60);
  }
  swap() {
    this.tone(500, 0.07, 'triangle', 0.3, 900);
    this.tone(900, 0.09, 'triangle', 0.3, 1300, 0.06);
  }
  newOrder() {
    this.tone(784, 0.09, 'triangle', 0.3);
    this.tone(1175, 0.14, 'triangle', 0.3, undefined, 0.08);
  }
  expire() {
    this.tone(330, 0.2, 'sawtooth', 0.3, 160);
    this.tone(220, 0.3, 'sawtooth', 0.3, 90, 0.15);
  }
  tick() {
    this.tone(880, 0.08, 'square', 0.2);
  }
  go() {
    this.tone(1175, 0.35, 'square', 0.3);
    this.tone(1568, 0.4, 'square', 0.25, undefined, 0.02);
  }
  warn() {
    this.tone(990, 0.06, 'square', 0.18);
  }
  over() {
    [784, 659, 523, 392].forEach((f, i) => this.tone(f, 0.28, 'square', 0.28, undefined, i * 0.16));
    this.tone(196, 0.8, 'triangle', 0.35, undefined, 0.64);
  }
  star(i: number) {
    this.tone(660 * Math.pow(1.122, i * 2), 0.2, 'square', 0.28);
    this.tone(1320 * Math.pow(1.122, i * 2), 0.3, 'triangle', 0.22, undefined, 0.05);
  }
  ui() {
    this.tone(700, 0.06, 'triangle', 0.25, 1000);
  }
  hover() {
    this.tone(500, 0.03, 'triangle', 0.1);
  }
  start() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'square', 0.22, undefined, i * 0.07));
  }

  // ----- music ------------------------------------------------------------
  setIntensity(v: number) {
    this.intensity = v;
  }

  startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.step = 0;
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
    while (this.nextTime < c.currentTime + 0.14) {
      this.playStep(this.step, this.nextTime);
      const bpm = this.bpm + this.intensity * 26;
      this.nextTime += 60 / bpm / 4;
      this.step++;
    }
  }

  private mtone(freq: number, when: number, dur: number, type: Wave, vol: number, slideTo?: number) {
    const c = this.ctx;
    if (!c || this.muted) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g);
    g.connect(this.musicBus);
    o.start(when);
    o.stop(when + dur + 0.03);
  }

  private playStep(step: number, when: number) {
    const s = step % 16;
    const bar = Math.floor(step / 16) % 4;
    // Am  F  C  G
    const roots = [110, 87.31, 130.81, 98];
    const chords = [
      [220, 261.63, 329.63, 440],
      [174.61, 220, 261.63, 349.23],
      [261.63, 329.63, 392, 523.25],
      [196, 246.94, 293.66, 392],
    ];
    const root = roots[bar];
    // kick
    if (s % 4 === 0) this.mtone(150, when, 0.14, 'sine', 0.9, 45);
    // snare / clap
    if (s === 4 || s === 12) {
      const c = this.ctx!;
      if (this.noiseBuf && !this.muted) {
        const src = c.createBufferSource();
        src.buffer = this.noiseBuf;
        const f = c.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 1900;
        const g = c.createGain();
        g.gain.setValueAtTime(0.5, when);
        g.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);
        src.connect(f);
        f.connect(g);
        g.connect(this.musicBus);
        src.start(when, Math.random() * 0.5);
        src.stop(when + 0.15);
      }
    }
    // hat
    if (s % 2 === 1) {
      const c = this.ctx!;
      if (this.noiseBuf && !this.muted) {
        const src = c.createBufferSource();
        src.buffer = this.noiseBuf;
        const f = c.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 7500;
        const g = c.createGain();
        g.gain.setValueAtTime(0.14, when);
        g.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
        src.connect(f);
        f.connect(g);
        g.connect(this.musicBus);
        src.start(when, Math.random() * 0.5);
        src.stop(when + 0.06);
      }
    }
    // bass (syncopated)
    if (s === 0 || s === 3 || s === 6 || s === 10 || s === 14) {
      const oct = s === 6 || s === 14 ? 2 : 1;
      this.mtone(root * oct, when, 0.18, 'sawtooth', 0.38);
    }
    // arp
    if (s % 2 === 0) {
      const ch = chords[bar];
      const n = ch[(s / 2 + (bar % 2)) % ch.length];
      this.mtone(n * 2, when, 0.1, 'square', 0.1);
    }
    // little lead hook every other bar
    if (bar % 2 === 1 && (s === 2 || s === 8 || s === 11)) {
      const ch = chords[bar];
      this.mtone(ch[s % 4] * 4, when, 0.12, 'triangle', 0.16);
    }
  }
}

export const audio = new AudioEngine();
