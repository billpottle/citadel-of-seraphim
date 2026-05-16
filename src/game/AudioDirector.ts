const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

type AudioBus = "music" | "sfx";

type ToneOptions = {
  bus?: AudioBus;
  type?: OscillatorType;
  start?: number;
  duration?: number;
  attack?: number;
  volume?: number;
};

type Chord = {
  root: number;
  intervals: number[];
  bells: number[];
};

const CHORDS: Chord[] = [
  { root: 50, intervals: [0, 7, 11, 14, 21], bells: [14, 18, 21, 26] },
  { root: 57, intervals: [0, 4, 7, 14, 19], bells: [12, 16, 19, 23] },
  { root: 47, intervals: [0, 7, 10, 14, 17], bells: [14, 17, 22, 26] },
  { root: 43, intervals: [0, 7, 11, 14, 19], bells: [16, 19, 23, 26] },
];

export class AudioDirector {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextMusicTime = 0;
  private enabled = false;
  private lastSfx = new Map<string, number>();

  get isEnabled() {
    return this.enabled;
  }

  async toggle() {
    if (this.enabled) {
      this.stop();
      return false;
    }

    return this.start();
  }

  async start() {
    const context = this.ensureContext();
    if (!context) {
      return false;
    }

    if (context.state !== "running") {
      await context.resume();
    }

    this.enabled = true;
    this.master?.gain.cancelScheduledValues(context.currentTime);
    this.master?.gain.setTargetAtTime(0.42, context.currentTime, 0.08);
    this.startMusicLoop();
    return true;
  }

  stop() {
    if (!this.context) {
      this.enabled = false;
      return;
    }

    this.enabled = false;
    this.master?.gain.cancelScheduledValues(this.context.currentTime);
    this.master?.gain.setTargetAtTime(0.0001, this.context.currentTime, 0.08);

    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  playTowerBuild() {
    if (!this.canPlaySfx("tower-build", 110)) {
      return;
    }

    const now = this.context!.currentTime;
    [72, 76, 79, 84].forEach((note, index) => {
      this.tone(midiToHz(note), {
        start: now + index * 0.055,
        duration: 0.9,
        attack: 0.012,
        volume: 0.07,
        type: "sine",
      });
    });
    this.sweep(220, 880, now, 0.5, "triangle", 0.045);
  }

  playHostDeploy() {
    if (!this.canPlaySfx("host-deploy", 180)) {
      return;
    }

    const now = this.context!.currentTime;
    [62, 69, 74, 78].forEach((note) => {
      this.tone(midiToHz(note), {
        start: now,
        duration: 1.35,
        attack: 0.04,
        volume: 0.035,
        type: "triangle",
      });
    });
    this.tone(midiToHz(86), { start: now + 0.18, duration: 1.2, attack: 0.01, volume: 0.05 });
  }

  playProjectile() {
    if (!this.canPlaySfx("projectile", 70)) {
      return;
    }

    const now = this.context!.currentTime;
    this.tone(midiToHz(91), { start: now, duration: 0.18, attack: 0.004, volume: 0.027 });
  }

  playDemonProjectile() {
    if (!this.canPlaySfx("demon-projectile", 180)) {
      return;
    }

    const now = this.context!.currentTime;
    this.sweep(140, 72, now, 0.42, "sawtooth", 0.045);
    this.noise(0.22, now, 0.025, 620);
  }

  playShockwave() {
    if (!this.canPlaySfx("shockwave", 260)) {
      return;
    }

    const now = this.context!.currentTime;
    this.sweep(180, 78, now, 0.72, "sine", 0.07);
    this.tone(midiToHz(67), { start: now + 0.03, duration: 1.1, attack: 0.015, volume: 0.035 });
  }

  playTensionBurst() {
    if (!this.canPlaySfx("tension-burst", 450)) {
      return;
    }

    const now = this.context!.currentTime;
    [55, 62, 67, 74, 79, 86].forEach((note, index) => {
      this.tone(midiToHz(note), {
        start: now + index * 0.045,
        duration: 1.55,
        attack: 0.006,
        volume: 0.058,
        type: index % 2 === 0 ? "triangle" : "sine",
      });
    });
    this.sweep(160, 980, now, 0.9, "triangle", 0.085);
    this.noise(0.28, now + 0.05, 0.024, 1600);
  }

  playEnemyDefeated(count = 1) {
    if (!this.canPlaySfx("enemy-defeated", 120)) {
      return;
    }

    const now = this.context!.currentTime;
    this.tone(midiToHz(76), { start: now, duration: 0.42, attack: 0.006, volume: 0.038 });
    this.tone(midiToHz(83 + Math.min(count, 3)), {
      start: now + 0.08,
      duration: 0.5,
      attack: 0.006,
      volume: 0.03,
    });
  }

  playPurify() {
    if (!this.canPlaySfx("purify", 600)) {
      return;
    }

    const now = this.context!.currentTime;
    [62, 66, 69, 74, 81].forEach((note, index) => {
      this.tone(midiToHz(note), {
        start: now + index * 0.08,
        duration: 1.7,
        attack: 0.02,
        volume: 0.05,
        type: "triangle",
      });
    });
    this.sweep(330, 1320, now, 1.25, "sine", 0.04);
  }

  playCorruption() {
    if (!this.canPlaySfx("corruption", 500)) {
      return;
    }

    const now = this.context!.currentTime;
    this.sweep(220, 46, now, 1.0, "sawtooth", 0.07);
    this.noise(0.7, now, 0.035, 360);
  }

  playVictory() {
    if (!this.canPlaySfx("victory", 900)) {
      return;
    }

    const now = this.context!.currentTime;
    [62, 66, 69, 74, 78, 86].forEach((note, index) => {
      this.tone(midiToHz(note), {
        start: now + index * 0.12,
        duration: 1.8,
        attack: 0.018,
        volume: 0.052,
        type: "triangle",
      });
    });
  }

  playDefeat() {
    if (!this.canPlaySfx("defeat", 900)) {
      return;
    }

    const now = this.context!.currentTime;
    [50, 48, 45, 43].forEach((note, index) => {
      this.tone(midiToHz(note), {
        start: now + index * 0.18,
        duration: 1.4,
        attack: 0.035,
        volume: 0.055,
        type: "sawtooth",
      });
    });
  }

  private ensureContext() {
    if (this.context) {
      return this.context;
    }

    const audioWindow = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
    const AudioContextCtor = window.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }

    const context = new AudioContextCtor();
    const master = context.createGain();
    const musicBus = context.createGain();
    const sfxBus = context.createGain();
    const reverb = context.createConvolver();
    const reverbReturn = context.createGain();

    master.gain.value = 0.0001;
    musicBus.gain.value = 0.28;
    sfxBus.gain.value = 0.54;
    reverbReturn.gain.value = 0.22;
    reverb.buffer = this.createImpulse(context, 3.4, 2.5);

    musicBus.connect(master);
    musicBus.connect(reverb);
    sfxBus.connect(master);
    sfxBus.connect(reverb);
    reverb.connect(reverbReturn);
    reverbReturn.connect(master);
    master.connect(context.destination);

    this.context = context;
    this.master = master;
    this.musicBus = musicBus;
    this.sfxBus = sfxBus;
    return context;
  }

  private startMusicLoop() {
    if (!this.context || this.musicTimer) {
      return;
    }

    this.nextMusicTime = Math.max(this.context.currentTime + 0.08, this.nextMusicTime);
    this.scheduleMusicWindow();
    this.musicTimer = setInterval(() => this.scheduleMusicWindow(), 6000);
  }

  private scheduleMusicWindow() {
    if (!this.context || !this.enabled) {
      return;
    }

    while (this.nextMusicTime < this.context.currentTime + 18) {
      this.scheduleMusicCycle(this.nextMusicTime);
      this.nextMusicTime += 16;
    }
  }

  private scheduleMusicCycle(start: number) {
    for (const [index, chord] of CHORDS.entries()) {
      const chordStart = start + index * 4;
      this.padChord(chord, chordStart, 4.8);
      this.bellArp(chord, chordStart + 0.42);
    }
  }

  private padChord(chord: Chord, start: number, duration: number) {
    for (const interval of chord.intervals) {
      this.tone(midiToHz(chord.root + interval), {
        bus: "music",
        start,
        duration,
        attack: 1.1,
        volume: 0.014,
        type: "sine",
      });
    }

    this.tone(midiToHz(chord.root - 12), {
      bus: "music",
      start,
      duration,
      attack: 1.4,
      volume: 0.018,
      type: "triangle",
    });
  }

  private bellArp(chord: Chord, start: number) {
    chord.bells.forEach((interval, index) => {
      this.tone(midiToHz(chord.root + interval), {
        bus: "music",
        start: start + index * 0.48,
        duration: 2.2,
        attack: 0.01,
        volume: 0.022,
        type: "sine",
      });
    });
  }

  private tone(frequency: number, options: ToneOptions = {}) {
    if (!this.context) {
      return;
    }

    const bus = this.getBus(options.bus ?? "sfx");
    if (!bus) {
      return;
    }

    const start = options.start ?? this.context.currentTime;
    const duration = options.duration ?? 0.4;
    const attack = options.attack ?? 0.01;
    const volume = options.volume ?? 0.04;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = options.type ?? "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0001), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(gain);
    gain.connect(bus);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.08);
  }

  private sweep(
    startFrequency: number,
    endFrequency: number,
    start: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ) {
    if (!this.context || !this.sfxBus) {
      return;
    }

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(endFrequency, 1), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(gain);
    gain.connect(this.sfxBus);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.08);
  }

  private noise(duration: number, start: number, volume: number, frequency: number) {
    if (!this.context || !this.sfxBus) {
      return;
    }

    const sampleCount = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, sampleCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();

    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    source.start(start);
  }

  private createImpulse(context: AudioContext, durationSeconds: number, decay: number) {
    const sampleCount = Math.floor(context.sampleRate * durationSeconds);
    const impulse = context.createBuffer(2, sampleCount, context.sampleRate);

    for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let index = 0; index < sampleCount; index += 1) {
        data[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount) ** decay;
      }
    }

    return impulse;
  }

  private getBus(bus: AudioBus) {
    return bus === "music" ? this.musicBus : this.sfxBus;
  }

  private canPlaySfx(key: string, minGapMs: number) {
    if (!this.enabled || !this.context || !this.sfxBus) {
      return false;
    }

    const now = this.context.currentTime * 1000;
    const last = this.lastSfx.get(key) ?? -Infinity;
    if (now - last < minGapMs) {
      return false;
    }

    this.lastSfx.set(key, now);
    return true;
  }
}
