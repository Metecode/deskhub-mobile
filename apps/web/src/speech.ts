// Reading aloud with the phone's own voice (Web Speech API): free and offline (docs/plan-phase6.md).
// Sentence by sentence; pausing is ours, as Android's pause() and resume() can't be relied on.
import type { Reading } from './bulletin.js';
import { loadJson, saveJson } from './saved.js';
import { Store } from './store.js';

const KEY = 'deskhub-mobile.speech';
export const RATES = [0.8, 1, 1.2, 1.5] as const;

export interface VoiceInfo {
  name: string;
  lang: string;
  local: boolean;
}

export interface Playing {
  title: string;
  sentences: readonly string[];
  index: number;
  paused: boolean;
}

export interface SpeechState {
  supported: boolean;
  /** null: no Turkish voice, or not known yet. */
  voice: VoiceInfo | null;
  turkishVoices: number;
  rate: number;
  /** Read the morning on the day's first touch. */
  firstTouch: boolean;
  playing: Playing | null;
  /** The engine's last error ("synthesis-failed", "not-allowed"...), for the diagnostics. */
  error: string | null;
}

/** The part of SpeechSynthesis that is used, so tests can stand in for it. */
export interface Synth {
  getVoices(): readonly SpeechSynthesisVoice[];
  speak(utterance: SpeechSynthesisUtterance): void;
  cancel(): void;
  addEventListener(type: 'voiceschanged', listener: () => void): void;
}

export type MakeUtterance = (text: string) => SpeechSynthesisUtterance;

/** A Turkish voice, one on the phone first: it needs no network. */
export function pickVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const turkish = voices.filter((v) => /^tr([-_]|$)/i.test(v.lang));
  return turkish.find((v) => v.localService) ?? turkish[0] ?? null;
}

interface Saved {
  rate: number;
  firstTouch: boolean;
}

function loadSaved(): Saved {
  const saved = loadJson(KEY) as Partial<Saved> | null;
  return {
    rate: RATES.includes(saved?.rate as (typeof RATES)[number]) ? saved!.rate! : 1,
    firstTouch: saved?.firstTouch === true,
  };
}

export class SpeechStore extends Store<SpeechState> {
  readonly #synth: Synth | null;
  readonly #make: MakeUtterance;
  #voice: SpeechSynthesisVoice | null = null;
  /** Each utterance has its own number; the end of a cancelled one is ignored. */
  #serial = 0;

  constructor(
    synth: Synth | null = typeof speechSynthesis === 'undefined' ? null : speechSynthesis,
    make: MakeUtterance = (text) => new SpeechSynthesisUtterance(text),
  ) {
    super({ supported: !!synth, voice: null, turkishVoices: 0, ...loadSaved(), playing: null, error: null });
    this.#synth = synth;
    this.#make = make;
    if (!synth) return;
    // Android gives the voices late: nothing at first, then this event.
    synth.addEventListener('voiceschanged', () => this.#loadVoices());
    this.#loadVoices();
  }

  #loadVoices(): void {
    const voices = this.#synth?.getVoices() ?? [];
    this.#voice = pickVoice(voices);
    const v = this.#voice;
    this.setState({
      ...this.getState(),
      voice: v ? { name: v.name, lang: v.lang, local: v.localService } : null,
      turkishVoices: voices.filter((x) => /^tr([-_]|$)/i.test(x.lang)).length,
    });
  }

  #save(): void {
    const { rate, firstTouch } = this.getState();
    saveJson(KEY, { rate, firstTouch } satisfies Saved);
  }

  readonly setRate = (rate: number): void => {
    this.setState({ ...this.getState(), rate });
    this.#save();
    // From the sentence being read, at the new speed.
    const playing = this.getState().playing;
    if (playing && !playing.paused) this.#say(playing.index);
  };

  readonly setFirstTouch = (firstTouch: boolean): void => {
    this.setState({ ...this.getState(), firstTouch });
    this.#save();
  };

  /** Must come from a touch: Chrome speaks only after one. */
  readonly play = (reading: Reading): void => {
    if (!this.#synth || !reading.sentences.length) return;
    this.setState({ ...this.getState(), playing: { ...reading, index: 0, paused: false } });
    this.#say(0);
  };

  readonly pause = (): void => {
    const playing = this.getState().playing;
    if (!playing || playing.paused) return;
    this.#serial++;
    this.#synth?.cancel();
    this.setState({ ...this.getState(), playing: { ...playing, paused: true } });
  };

  readonly resume = (): void => {
    const playing = this.getState().playing;
    if (playing?.paused) this.#say(playing.index);
  };

  readonly next = (): void => this.#skip(1);
  readonly back = (): void => this.#skip(-1);

  readonly stop = (): void => {
    this.#serial++;
    this.#synth?.cancel();
    this.setState({ ...this.getState(), playing: null });
  };

  #skip(by: number): void {
    const playing = this.getState().playing;
    if (!playing) return;
    const index = Math.max(0, Math.min(playing.sentences.length - 1, playing.index + by));
    this.#say(index);
  }

  #say(index: number): void {
    const playing = this.getState().playing;
    const text = playing?.sentences[index];
    if (!this.#synth || !playing || text === undefined) return this.stop();
    const serial = ++this.#serial;
    this.#synth.cancel();
    const utterance = this.#make(text);
    utterance.lang = this.#voice?.lang ?? 'tr-TR';
    if (this.#voice) utterance.voice = this.#voice;
    utterance.rate = this.getState().rate;
    utterance.onend = () => {
      if (serial !== this.#serial) return;
      if (index + 1 < playing.sentences.length) this.#say(index + 1);
      else this.stop();
    };
    // A sentence that we cut short says so too; any other error stops the reading, which the
    // diagnostics then tell about, rather than rushing through the rest.
    utterance.onerror = (e) => {
      if (serial !== this.#serial || e.error === 'interrupted' || e.error === 'canceled') return;
      this.stop();
      this.setState({ ...this.getState(), error: e.error });
    };
    this.setState({ ...this.getState(), playing: { ...playing, index, paused: false }, error: null });
    this.#synth.speak(utterance);
  }
}
