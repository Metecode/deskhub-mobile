import { describe, expect, it } from 'vitest';
import { parseBridgeCommand } from './bridgeCommands.js';
import { parseCommand } from './commands.js';

const parse = (value: unknown) => parseBridgeCommand(JSON.stringify(value));

describe('parseBridgeCommand', () => {
  it.each([
    { type: 'bridge.bulletin.run' },
    { type: 'bridge.reminder.save', id: 'olcum', values: { kg: 78.4, cm: 86 } },
    { type: 'bridge.reminder.save', id: 'olcum', values: {} },
    { type: 'bridge.measurements.get', id: 'olcum' },
  ])('accepts %j', (command) => {
    expect(parse(command)).toEqual(command);
  });

  it.each([
    // Strict: an extra field is a different command.
    { type: 'bridge.bulletin.run', prompt: 'x' },
    { type: 'bridge.reminder.save', id: 'olcum', values: { kg: 78 }, at: 0 },
    { type: 'bridge.reminder.save', id: 'Ölçüm', values: { kg: 78 } },
    { type: 'bridge.reminder.save', id: '../x', values: { kg: 78 } },
    { type: 'bridge.reminder.save', id: 'olcum', values: { kg: -1 } },
    { type: 'bridge.reminder.save', id: 'olcum', values: { kg: 1e9 } },
    { type: 'bridge.reminder.save', id: 'olcum', values: { kg: '78' } },
    { type: 'bridge.reminder.save', id: 'olcum', values: { a: 1, b: 2, c: 3, d: 4, e: 5 } },
    { type: 'bridge.reminder.save', id: 'olcum', values: { __proto__x: 1 } },
    { type: 'bridge.measurements.get' },
    { type: 'bridge.ping', id: 1 },
    { type: 'bridge.snapshot' },
    { type: 'media', cmd: 'toggle' },
  ])('refuses %j', (command) => {
    expect(parse(command)).toBeNull();
  });

  it('refuses what is not JSON', () => {
    expect(parseBridgeCommand('{"type":"bridge.bulletin.run"')).toBeNull();
    expect(parseBridgeCommand('')).toBeNull();
  });

  it('never lets one through to the companion', () => {
    expect(parseCommand(JSON.stringify({ type: 'bridge.bulletin.run' }))).toBeNull();
  });
});
