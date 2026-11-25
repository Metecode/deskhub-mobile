// The timer (firmware/main/ui_timer.c). It runs on the phone alone. Unlike the board's it
// survives a reload, and it ends by the clock, even if the browser slept past the end.
import { fields } from '@deskhub-mobile/protocol';
import { loadJson, saveJson } from './saved.js';
import { Store } from './store.js';

/** Minutes. */
export const PRESETS = [1, 5, 10, 15, 25, 45] as const;

const KEY = 'deskhub-mobile.timer';
const TICK_MS = 250;
const DEFAULT_TOTAL = 25 * 60;

export interface TimerState {
  status: 'idle' | 'running' | 'paused';
  /** Seconds it was set to. */
  total: number;
  /** Seconds left. */
  left: number;
  /** It ended, and that hasn't been acknowledged. */
  done: boolean;
}

const isSeconds = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0 && (v as number) <= 86_400;

export class TimerStore extends Store<TimerState> {
  readonly #onEnd: () => void;
  /** When it ends while it runs, ms. */
  #end = 0;
  #ticker: ReturnType<typeof setInterval> | undefined;

  /** Goes on from where the last page left off with resume(). */
  constructor(onEnd: () => void) {
    super({ status: 'idle', total: DEFAULT_TOTAL, left: DEFAULT_TOTAL, done: false });
    this.#onEnd = onEnd;
  }

  resume(): void {
    const saved = fields(loadJson(KEY));
    if (!isSeconds(saved.total)) return;
    const { total } = saved;
    const left = isSeconds(saved.left) ? Math.min(saved.left, total) : total;
    if (saved.status === 'running' && typeof saved.end === 'number') this.#run(total, saved.end);
    else this.setState({ status: saved.status === 'paused' ? 'paused' : 'idle', total, left, done: saved.done === true });
  }

  /** Start, pause or go on. */
  readonly toggle = (): void => {
    const { status, total, left } = this.getState();
    if (status === 'running') this.#stop({ status: 'paused', total, left: this.#secondsLeft(), done: false });
    else this.#run(total, Date.now() + left * 1000);
  };

  readonly reset = (): void => {
    const { total } = this.getState();
    this.#stop({ status: 'idle', total, left: total, done: false });
  };

  /** Restarts it while it runs, otherwise only sets it. */
  readonly choose = (minutes: number): void => {
    const total = minutes * 60;
    if (this.getState().status === 'running') this.#run(total, Date.now() + total * 1000);
    else this.#stop({ status: 'idle', total, left: total, done: false });
  };

  readonly again = (): void => {
    const { total } = this.getState();
    this.#run(total, Date.now() + total * 1000);
  };

  readonly dismiss = (): void => this.#stop({ ...this.getState(), done: false });

  /** Also called when the page comes back into view. */
  readonly tick = (): void => {
    const { status, total, left } = this.getState();
    if (status !== 'running') return;
    const now = this.#secondsLeft();
    if (now <= 0) {
      this.#stop({ status: 'idle', total, left: total, done: true });
      this.#onEnd();
    } else if (now !== left) {
      this.setState({ ...this.getState(), left: now });
    }
  };

  #secondsLeft(): number {
    return Math.max(0, Math.ceil((this.#end - Date.now()) / 1000));
  }

  #run(total: number, end: number): void {
    this.#end = end;
    clearInterval(this.#ticker);
    this.#ticker = setInterval(this.tick, TICK_MS);
    // Not more than it was set to, should the phone's clock have been set back.
    if (this.#secondsLeft() > total) this.#end = Date.now() + total * 1000;
    this.#save({ status: 'running', total, left: this.#secondsLeft(), done: false });
    this.tick();
  }

  #stop(state: TimerState): void {
    clearInterval(this.#ticker);
    this.#save(state);
  }

  #save(state: TimerState): void {
    saveJson(KEY, { ...state, end: this.#end });
    this.setState(state);
  }
}

/** Under "Time's up" (show_done). */
export const timerName = (total: number) =>
  total % 60 === 0 ? `${total / 60}-minute timer` : `${total}-second timer`;
