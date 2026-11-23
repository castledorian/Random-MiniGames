type OscType = OscillatorType;

export class AudioFX {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;
  musicOn = true;
  private musicTimer: number | null = null;
  private nextNote = 0;
  private step = 0;
  private lastExplode = 0;
  private intensity = 0;

  ensure() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.7;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.16;
      this.musicBus.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.02);
  }

  private tone(freq: number, dur: number, type: OscType, vol: number, slideTo?: number, delay = 0, bus?: GainNode | null) {
    const c = this.ctx;
    const out = bus ?? this.sfxBus;
    if (!c || !out) return;
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
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, f0: number, f1: number, delay = 0, bus?: GainNode | null, q = 0.7) {
    const c = this.ctx;
    const out = bus ?? this.sfxBus;
    if (!c || !out || !this.noiseBuf) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(out);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  place() {
    this.tone(220, 0.12, "square", 0.16, 110);
    this.tone(440, 0.05, "triangle", 0.1, 330);
  }
  explode(size = 1) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastExplode < 0.04) return;
    this.lastExplode = now;
    this.noise(0.5 + size * 0.15, 0.9, 2600, 90, 0, null, 1.2);
    this.tone(120, 0.4, "sawtooth", 0.35, 38);
    this.tone(60, 0.5, "sine", 0.5, 30);
  }
  pickup() {
    this.tone(660, 0.08, "square", 0.12);
    this.tone(990, 0.1, "square", 0.12, undefined, 0.07);
    this.tone(1320, 0.14, "triangle", 0.12, undefined, 0.14);
  }
  heart() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, "triangle", 0.16, undefined, i * 0.07));
  }
  skill(kind: string) {
    switch (kind) {
      case "dash":
        this.noise(0.25, 0.4, 5000, 600);
        this.tone(300, 0.2, "sawtooth", 0.14, 900);
        break;
      case "freeze":
        this.tone(1400, 0.5, "sine", 0.18, 400);
        this.tone(2100, 0.4, "triangle", 0.1, 700, 0.03);
        this.noise(0.4, 0.2, 6000, 1500);
        break;
      case "teleport":
        this.tone(200, 0.3, "sine", 0.2, 1600);
        this.tone(1600, 0.25, "sine", 0.15, 200, 0.18);
        break;
      case "wall":
        this.tone(90, 0.25, "square", 0.25, 50);
        this.noise(0.25, 0.4, 1200, 200);
        break;
      case "barrage":
        for (let i = 0; i < 4; i++) this.tone(260 + i * 60, 0.1, "square", 0.14, 160, i * 0.07);
        break;
      default:
        this.tone(180, 0.3, "sawtooth", 0.2, 700);
        this.tone(900, 0.2, "square", 0.1, 300, 0.05);
    }
  }
  hit() {
    this.tone(300, 0.2, "sawtooth", 0.22, 80);
    this.noise(0.2, 0.4, 3000, 400);
  }
  shieldPop() {
    this.tone(900, 0.18, "triangle", 0.2, 200);
    this.noise(0.15, 0.25, 6000, 1200);
  }
  death() {
    this.tone(440, 0.5, "sawtooth", 0.25, 60);
    this.tone(330, 0.6, "square", 0.12, 40, 0.05);
  }
  kick() {
    this.tone(160, 0.1, "square", 0.2, 80);
  }
  thud() {
    this.tone(90, 0.09, "sine", 0.3, 50);
  }
  click() {
    this.tone(700, 0.04, "square", 0.08);
  }
  tick() {
    this.tone(520, 0.08, "square", 0.12);
  }
  go() {
    this.tone(784, 0.25, "square", 0.15);
    this.tone(1046, 0.3, "square", 0.15, undefined, 0.1);
  }
  warn() {
    this.tone(180, 0.08, "square", 0.08);
  }
  win() {
    [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.18, "square", 0.14, undefined, i * 0.11));
  }
  lose() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.28, "triangle", 0.2, undefined, i * 0.2));
  }
  stageClear() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.15, "square", 0.14, undefined, i * 0.09));
  }

  setIntensity(v: number) {
    this.intensity = v;
  }

  startMusic() {
    if (!this.ctx || this.musicTimer !== null || !this.musicOn) return;
    this.nextNote = this.ctx.currentTime + 0.05;
    this.step = 0;
    this.musicTimer = window.setInterval(() => this.schedule(), 40);
  }
  stopMusic() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
  setMusic(on: boolean) {
    this.musicOn = on;
    if (!on) this.stopMusic();
  }

  private schedule() {
    const c = this.ctx;
    if (!c) return;
    const bpm = 128 + this.intensity * 14;
    const stepDur = 60 / bpm / 4;
    const bass = [0, 0, 12, 0, 0, 0, 12, 0, 3, 3, 15, 3, 5, 5, 17, 7];
    const arp = [0, 7, 12, 7, 15, 12, 7, 12, 3, 10, 15, 10, 5, 12, 17, 12];
    while (this.nextNote < c.currentTime + 0.2) {
      const t = this.nextNote - c.currentTime;
      const i = this.step % 16;
      const bar = Math.floor(this.step / 16) % 4;
      const root = [55, 55, 58.27, 49][bar];
      const mul = (n: number) => root * Math.pow(2, n / 12);
      this.tone(mul(bass[i]), stepDur * 0.9, "sawtooth", 0.35, undefined, Math.max(0, t), this.musicBus);
      if (i % 2 === 0 || this.intensity > 0.5) {
        this.tone(mul(arp[i] + 24), stepDur * 0.6, "square", 0.12, undefined, Math.max(0, t), this.musicBus);
      }
      if (i % 4 === 2) this.noise(0.05, 0.25, 9000, 4000, Math.max(0, t), this.musicBus);
      if (i % 8 === 0) {
        this.tone(120, 0.12, "sine", 0.6, 45, Math.max(0, t), this.musicBus);
      }
      this.step++;
      this.nextNote += stepDur;
    }
  }
}
