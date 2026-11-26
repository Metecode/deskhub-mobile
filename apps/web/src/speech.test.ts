import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pickVoice, SpeechStore, type Synth } from './speech.js';

interface FakeUtterance {
  text: string;
  lang?: string;
  rate?: number;
  voice?: unknown;
  onend?: () => void;
  onerror?: (e: { error: string }) => void;
}

const voice = (name: string, lang: string, localService: boolean) =>
  ({ name, lang, localService, default: false, voiceURI: name }) as SpeechSynthesisVoice;

class FakeSynth implements Synth {
  voices: SpeechSynthesisVoice[] = [];
  spoken: FakeUtterance[] = [];
  cancels = 0;
  #listener: () => void = () => {};
  getVoices = () => this.voices;
  speak = (u: SpeechSynthesisUtterance) => void this.spoken.push(u as unknown as FakeUtterance);
  cancel = () => void this.cancels++;
  addEventListener = (_: 'voiceschanged', listener: () => void) => void (this.#listener = listener);
  voicesChanged = () => this.#listener();
  /** The last sentence ends. */
  end = () => this.spoken.at(-1)!.onend!();
}

let synth: FakeSynth;
let store: SpeechStore;
const make = (text: string) => ({ text }) as unknown as SpeechSynthesisUtterance;
const reading = { title: 'Kısa', sentences: ['Bir.', 'İki.', 'Üç.'] };

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  });
  synth = new FakeSynth();
  store = new SpeechStore(synth, make);
});

afterEach(() => vi.unstubAllGlobals());

describe('pickVoice', () => {
  it('takes a Turkish voice on the phone first', () => {
    const voices = [voice('en', 'en-US', true), voice('tr net', 'tr-TR', false), voice('tr local', 'tr_TR', true)];
    expect(pickVoice(voices)?.name).toBe('tr local');
    expect(pickVoice([voice('en', 'en-US', true)])).toBeNull();
  });
});

describe('SpeechStore', () => {
  it('waits for the voices that Android gives late', () => {
    expect(store.getState()).toMatchObject({ supported: true, voice: null, turkishVoices: 0 });
    synth.voices = [voice('Google Türkçe', 'tr-TR', true)];
    synth.voicesChanged();
    expect(store.getState()).toMatchObject({ voice: { name: 'Google Türkçe', lang: 'tr-TR', local: true }, turkishVoices: 1 });
  });

  it('reads sentence by sentence, then stops', () => {
    store.play(reading);
    expect(synth.spoken.map((u) => u.text)).toEqual(['Bir.']);
    expect(synth.spoken[0]).toMatchObject({ lang: 'tr-TR', rate: 1 });
    synth.end();
    synth.end();
    expect(store.getState().playing).toMatchObject({ index: 2, paused: false });
    synth.end();
    expect(store.getState().playing).toBeNull();
    expect(synth.spoken.map((u) => u.text)).toEqual(['Bir.', 'İki.', 'Üç.']);
  });

  it('pauses on its own, and goes on from that sentence', () => {
    store.play(reading);
    synth.end();
    store.pause();
    // The cancelled sentence's end changes nothing.
    synth.spoken.at(-1)!.onend!();
    expect(store.getState().playing).toMatchObject({ index: 1, paused: true });
    store.resume();
    expect(synth.spoken.at(-1)!.text).toBe('İki.');
  });

  it('goes back and forward', () => {
    store.play(reading);
    store.next();
    store.next();
    store.next();
    expect(store.getState().playing?.index).toBe(2);
    store.back();
    expect(synth.spoken.at(-1)!.text).toBe('İki.');
  });

  it('keeps the speed and the first touch, and uses the speed at once', () => {
    store.play(reading);
    store.setRate(1.5);
    store.setFirstTouch(true);
    expect(synth.spoken.at(-1)).toMatchObject({ text: 'Bir.', rate: 1.5 });
    expect(new SpeechStore(synth, make).getState()).toMatchObject({ rate: 1.5, firstTouch: true });
  });

  it('stops on an error of the engine and keeps it, but not on its own cancelling', () => {
    store.play(reading);
    synth.spoken.at(-1)!.onerror!({ error: 'interrupted' });
    expect(store.getState().playing?.index).toBe(0);
    synth.spoken.at(-1)!.onerror!({ error: 'synthesis-failed' });
    expect(store.getState()).toMatchObject({ playing: null, error: 'synthesis-failed' });
    expect(synth.spoken).toHaveLength(1);
    store.play(reading);
    expect(store.getState().error).toBeNull();
  });

  it('does nothing without a speech engine', () => {
    const none = new SpeechStore(null, make);
    none.play(reading);
    expect(none.getState()).toMatchObject({ supported: false, playing: null });
  });
});
