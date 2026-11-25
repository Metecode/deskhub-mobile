/** A value to use with useSyncExternalStore(). */
export class Store<T> {
  #state: T;
  readonly #listeners = new Set<() => void>();

  constructor(state: T) {
    this.#state = state;
  }

  readonly getState = (): T => this.#state;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  protected setState(state: T): void {
    if (state === this.#state) return;
    this.#state = state;
    for (const listener of this.#listeners) listener();
  }
}
