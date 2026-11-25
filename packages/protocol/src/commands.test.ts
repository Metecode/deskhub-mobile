import { describe, expect, it } from 'vitest';
import { parseCommand } from './commands.js';

const parse = (value: unknown) => parseCommand(JSON.stringify(value));

describe('parseCommand', () => {
  it.each([
    { type: 'media', cmd: 'toggle', value: 0 },
    { type: 'media', cmd: 'seek', value: 93 },
    { type: 'media_server', cmd: 'next', value: 0 },
    { type: 'shortcut', id: 0 },
    { type: 'shortcut', id: 15 },
    { type: 'steam_launch', appid: 730 },
    { type: 'steam_launch', appid: 0xc0000001 },
    { type: 'speedtest' },
    { type: 'alert_action', id: 'a1-B2_c3', action: 'focus' },
    { type: 'alert_action', id: 'a', action: 'dismiss' },
  ])('accepts %j', (command) => {
    expect(parse(command)).toEqual(command);
  });

  it('fills in the media value', () => {
    expect(parse({ type: 'media', cmd: 'prev' })).toEqual({ type: 'media', cmd: 'prev', value: 0 });
  });

  it('drops fields the board never sends', () => {
    expect(parse({ type: 'speedtest', token: 'x', extra: 1 })).toEqual({ type: 'speedtest' });
  });

  it.each([
    { type: 'hello', token: 'x' },
    { type: 'stats', cpu: 1 },
    { type: 'run', target: 'calc.exe' },
    {},
    [],
    null,
    { type: 'media', cmd: 'stop' },
    { type: 'media', cmd: 'seek', value: -1 },
    { type: 'media', cmd: 'seek', value: 1.5 },
    { type: 'media', cmd: 'seek', value: 2 ** 31 },
    { type: 'media', cmd: 'seek', value: '5' },
    { type: 'shortcut' },
    { type: 'shortcut', id: -1 },
    { type: 'shortcut', id: 16 },
    { type: 'shortcut', id: '0' },
    { type: 'steam_launch', appid: -1 },
    { type: 'steam_launch', appid: 2 ** 32 },
    { type: 'alert_action', id: '', action: 'focus' },
    { type: 'alert_action', id: 'a b', action: 'focus' },
    { type: 'alert_action', id: 'x'.repeat(64), action: 'focus' },
    { type: 'alert_action', id: 'a', action: 'approve' },
  ])('rejects %j', (command) => {
    expect(parse(command)).toBeNull();
  });

  it('rejects text that is not JSON', () => {
    expect(parseCommand('media')).toBeNull();
  });
});
