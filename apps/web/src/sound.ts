// A beep and a vibration for the timer and for alerts. The board has neither.
//
// Browsers only allow both after a touch on the page. Without one (after a reload) they
// are left out, silently: whatever they are for shows on the screen anyway.

export type Signal = 'timer' | 'alert';

interface Pattern {
  /** Hz and, from the start, ms. */
  beeps: readonly { at: number; frequency: number; length: number }[];
  /** ms on, off, on... */
  vibration: number[];
}

const PATTERNS: Readonly<Record<Signal, Pattern>> = {
  timer: {
    beeps: [0, 300, 600].map((at) => ({ at, frequency: 880, length: 180 })),
    vibration: [400, 200, 400, 200, 400],
  },
  alert: {
    beeps: [
      { at: 0, frequency: 660, length: 120 },
      { at: 160, frequency: 880, length: 160 },
    ],
    vibration: [150, 100, 150],
  },
};

const VOLUME = 0.25;

/** A beep that comes later than this after its reason is left out. */
const LATE_MS = 1000;

export class Sound {
  #context: AudioContext | null = null;

  /** To be called in a touch: only then may a page make and start an AudioContext. */
  readonly unlock = (): void => {
    try {
      this.#context ??= new AudioContext();
      if (this.#context.state !== 'running') this.#context.resume().catch(() => {});
    } catch {
      // No Web Audio.
    }
  };

  /** Never throws. */
  play(signal: Signal): void {
    const { beeps, vibration } = PATTERNS[signal];
    try {
      // Asking without a touch would only put a warning on the console.
      if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(vibration);
    } catch {
      // Not allowed.
    }
    this.#beep(beeps).catch(() => {});
  }

  async #beep(beeps: Pattern['beeps']): Promise<void> {
    const context = this.#context;
    if (!context) return;
    if (context.state !== 'running') {
      // Without permission this only comes true with the next touch, if at all.
      const asked = Date.now();
      await context.resume();
      if (Date.now() - asked > LATE_MS) return;
    }
    for (const { at, frequency, length } of beeps) {
      const start = context.currentTime + at / 1000;
      const end = start + length / 1000;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      // Ramps, or it clicks.
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(VOLUME, start + 0.01);
      gain.gain.setValueAtTime(VOLUME, end - 0.03);
      gain.gain.linearRampToValueAtTime(0, end);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end);
    }
  }
}
