// Tiny WebAudio synth: every sound is generated, no assets required.

type SfxName =
  | "jump" | "airjump" | "whoosh" | "hit" | "heavy" | "block" | "bolt" | "fan" | "dash" | "shield"
  | "ko" | "select" | "start" | "pause" | "combo" | "win" | "lose" | "spawn" | "heal" | "wave" | "land" | "tick" | "score";

const BPM = 140;
const ROOTS = [33, 29, 36, 31];
const ARPS = [
  [57, 60, 64, 67],
  [53, 57, 60, 65],
  [55, 60, 64, 67],
  [55, 59, 62, 67],
];

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private last: Record<string, number> = {};
  muted = false;
  private musicOn = false;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;

  init() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.85;
        this.master.connect(this.ctx.destination);
        this.sfx = this.ctx.createGain();
        this.sfx.gain.value = 0.7;
        this.sfx.connect(this.master);
        this.music = this.ctx.createGain();
        this.music.gain.value = 0.16;
        this.music.connect(this.master);
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.02);
  }

  private tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0, dest?: AudioNode) {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfx);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  private noise(dur: number, vol: number, f0: number, f1: number, type: BiquadFilterType = "lowpass", delay = 0, dest?: AudioNode) {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const flt = c.createBiquadFilter();
    flt.type = type;
    flt.frequency.setValueAtTime(f0, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(flt);
    flt.connect(g);
    g.connect(dest || this.sfx);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.03);
  }

  play(name: SfxName, k = 1) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const minGap = name === "hit" || name === "whoosh" ? 0.025 : 0.04;
    if (this.last[name] && now - this.last[name] < minGap) return;
    this.last[name] = now;
    k = Math.max(0, Math.min(1.5, k));
    switch (name) {
      case "jump":
        this.tone(260, 520, 0.14, "square", 0.08);
        break;
      case "airjump":
        this.tone(420, 900, 0.16, "triangle", 0.14);
        break;
      case "land":
        this.noise(0.08, 0.12, 600, 120);
        break;
      case "whoosh":
        this.noise(0.12, 0.12, 900, 3200, "bandpass");
        break;
      case "hit":
        this.noise(0.1, 0.35 + k * 0.2, 2400, 300);
        this.tone(160 + k * 40, 55, 0.12, "sine", 0.5);
        this.tone(900, 300, 0.05, "square", 0.08);
        break;
      case "heavy":
        this.noise(0.28, 0.55, 3000, 120);
        this.tone(120, 38, 0.3, "sine", 0.8);
        this.tone(600, 90, 0.18, "sawtooth", 0.15);
        break;
      case "block":
        this.tone(1200, 800, 0.09, "triangle", 0.2);
        this.tone(300, 200, 0.12, "square", 0.08);
        break;
      case "bolt":
        this.tone(1400, 200, 0.2, "sawtooth", 0.14);
        this.noise(0.1, 0.1, 5000, 800, "highpass");
        break;
      case "fan":
        this.noise(0.25, 0.25, 600, 2500, "bandpass");
        this.tone(220, 440, 0.2, "sawtooth", 0.1);
        break;
      case "dash":
        this.noise(0.22, 0.3, 4000, 400, "bandpass");
        this.tone(200, 700, 0.18, "sawtooth", 0.1);
        break;
      case "shield":
        this.tone(300, 900, 0.3, "sine", 0.22);
        this.tone(450, 1350, 0.3, "triangle", 0.1);
        break;
      case "ko":
        this.noise(0.8, 0.7, 5000, 60);
        this.tone(220, 28, 0.9, "sine", 0.9);
        this.tone(900, 100, 0.5, "sawtooth", 0.18);
        break;
      case "select":
        this.tone(660, 880, 0.07, "square", 0.07);
        break;
      case "start":
        this.tone(330, 330, 0.1, "square", 0.1);
        this.tone(495, 495, 0.1, "square", 0.1, 0.09);
        this.tone(660, 990, 0.25, "square", 0.12, 0.18);
        break;
      case "pause":
        this.tone(520, 380, 0.1, "triangle", 0.15);
        break;
      case "combo":
        this.tone(500 + k * 120, 900 + k * 160, 0.1, "square", 0.07);
        break;
      case "win":
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.22, "square", 0.12, i * 0.1));
        break;
      case "lose":
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, f * 0.96, 0.3, "sawtooth", 0.14, i * 0.16));
        break;
      case "spawn":
        this.tone(150, 900, 0.4, "sine", 0.2);
        this.noise(0.35, 0.12, 400, 4000, "bandpass");
        break;
      case "heal":
        this.tone(700, 1400, 0.18, "sine", 0.2);
        this.tone(1050, 2100, 0.2, "sine", 0.12, 0.08);
        break;
      case "wave":
        this.tone(200, 400, 0.2, "sawtooth", 0.14);
        this.tone(300, 600, 0.3, "sawtooth", 0.14, 0.15);
        break;
      case "tick":
        this.tone(880, 880, 0.05, "square", 0.08);
        break;
      case "score":
        this.tone(1000, 1500, 0.06, "square", 0.05);
        break;
    }
  }

  // ---- music: simple driving synth loop
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.step = 0;
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private schedule() {
    if (!this.ctx || !this.musicOn) return;
    const eighth = 60 / BPM / 2;
    while (this.nextTime < this.ctx.currentTime + 0.18) {
      this.playStep(this.step, this.nextTime - this.ctx.currentTime);
      this.nextTime += eighth;
      this.step++;
    }
  }

  private playStep(step: number, delay: number) {
    const bar = Math.floor(step / 8) % 4;
    const s = step % 8;
    const root = ROOTS[bar];
    const dest = this.music;
    // bass
    const accent = s === 0 || s === 3 || s === 6;
    this.tone(mtof(root + (s % 4 === 2 ? 12 : 0)), mtof(root + (s % 4 === 2 ? 12 : 0)) * 0.98, 0.17, "sawtooth", accent ? 0.5 : 0.32, delay, dest);
    // kick on beats
    if (s % 2 === 0) this.tone(160, 42, 0.14, "sine", 0.9, delay, dest);
    // snare
    if (s === 2 || s === 6) this.noise(0.13, 0.55, 3500, 900, "bandpass", delay, dest);
    // hat
    if (s % 2 === 1) this.noise(0.04, 0.22, 8000, 7000, "highpass", delay, dest);
    // arp
    const a = ARPS[bar];
    if (step % 32 >= 8 || step > 31) this.tone(mtof(a[(s + (s > 3 ? 1 : 0)) % 4] + 12), mtof(a[(s + (s > 3 ? 1 : 0)) % 4] + 12), 0.1, "square", 0.12, delay, dest);
  }
}

export const audio = new AudioEngine();
