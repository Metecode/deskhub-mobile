import type { Alert } from '@deskhub-mobile/protocol';
import { describe, expect, it, vi } from 'vitest';
import { AlertStore, panelText, shortDetail } from './alerts.js';

const A: Alert = { id: 'a', permission: true, title: 'Claude wants to use Bash', detail: 'npm test', project: 'hub' };
const B: Alert = { ...A, id: 'b', permission: false };
/** The same again, as from another snapshot. */
const again = (alert: Alert): Alert => ({ ...alert });

function create() {
  const onNew = vi.fn();
  const alerts = new AlertStore(onNew);
  return { alerts, onNew };
}

describe('AlertStore', () => {
  it('shows an alert until it is cleared', () => {
    const { alerts, onNew } = create();
    expect(alerts.getState()).toBeNull();
    alerts.update(A);
    expect(alerts.getState()).toBe(A);
    expect(onNew).toHaveBeenCalledTimes(1);
    alerts.update(null);
    expect(alerts.getState()).toBeNull();
    alerts.update(again(A));
    expect(onNew).toHaveBeenCalledTimes(2);
  });

  it('only counts another id as new', () => {
    const { alerts, onNew } = create();
    alerts.update(A);
    alerts.update(again(A));
    alerts.update({ ...A, detail: 'rm -r dist' });
    expect(alerts.getState()?.detail).toBe('rm -r dist');
    expect(onNew).toHaveBeenCalledTimes(1);
    alerts.update(B);
    expect(onNew).toHaveBeenCalledTimes(2);
  });

  it('keeps a hidden alert hidden across reconnects and a restart of the bridge', () => {
    const { alerts, onNew } = create();
    alerts.update(A);
    alerts.hide();
    expect(alerts.getState()).toBeNull();
    alerts.update(A);
    alerts.update(again(A));
    alerts.update(undefined);
    alerts.update(again(A));
    expect(alerts.getState()).toBeNull();
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('shows a hidden alert again when it says something else', () => {
    const { alerts, onNew } = create();
    alerts.update(A);
    alerts.hide();
    alerts.update({ ...A, detail: 'npm run build' });
    expect(alerts.getState()?.detail).toBe('npm run build');
    expect(onNew).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['clear', null],
    ['another alert', B],
  ])('forgets the hidden alert on %s', (_name, between) => {
    const { alerts } = create();
    alerts.update(A);
    alerts.hide();
    alerts.update(between);
    alerts.update(again(A));
    expect(alerts.getState()).toEqual(A);
  });

  it('does not make a noise again when the bridge was restarted', () => {
    const { alerts, onNew } = create();
    alerts.update(A);
    alerts.update(undefined);
    expect(alerts.getState()).toBeNull();
    alerts.update(again(A));
    expect(alerts.getState()).toEqual(A);
    expect(onNew).toHaveBeenCalledTimes(1);
  });
});

describe('texts', () => {
  it.each([
    [{ detail: 'Claude wants to use Bash' }, 'Wants to use Bash'],
    [{ detail: 'Finished. the tests pass' }, 'The tests pass'],
    [{ detail: 'Claude Finished. ok' }, 'Ok'],
    [{ detail: '', title: 'Claude is waiting' }, 'Is waiting'],
    [{ detail: 'ığdır' }, 'ığdır'],
  ])('the strip: %j', (change, text) => expect(shortDetail({ ...A, ...change })).toBe(text));

  it('the panel does not say the same twice', () => {
    expect(panelText(A)).toEqual({ title: A.title, detail: 'npm test' });
    expect(panelText({ ...A, detail: A.title }).detail).toBe('');
    expect(panelText({ ...A, title: '', detail: '' }).title).toBe('Claude is waiting for you');
  });
});
