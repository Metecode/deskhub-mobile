// The bridge's own features: the morning bulletin and the reminders (docs/plan-phase6.md).
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WEEKDAYS } from '@deskhub-mobile/protocol';
import { BulletinService } from './bulletinService.js';
import type { BridgeServices } from './clientEndpoint.js';
import type { Config } from './config.js';
import type { Logger } from './log.js';
import { mockCodex, mockSheet } from './mockBulletin.js';
import { portfolioMaker } from './portfolio.js';
import { RemindersService } from './remindersService.js';
import { readGoogleSheet } from './sheetsClient.js';

export interface Services {
  services: BridgeServices;
  start(): Promise<void>;
  stop(): void;
}

/**
 * In mock mode everything is made up and kept in a folder of its own, and Codex and Google are never
 * reached; `examples` is the folder of bulletin.prompt.example.md.
 */
export async function createServices(
  config: Config,
  broadcast: (text: string) => void,
  log: Logger,
  examples: string,
): Promise<Services> {
  const send = (message: object) => broadcast(JSON.stringify(message));
  let dataDir = config.dataDir;
  let remindersFile = config.remindersFile;
  if (config.mock) {
    dataDir = join(tmpdir(), 'deskhub-mobile-mock');
    await mkdir(dataDir, { recursive: true });
    // A reminder for today, whichever day it is.
    remindersFile = join(dataDir, 'reminders.json');
    const day = WEEKDAYS[new Date().getDay()];
    await writeFile(
      remindersFile,
      JSON.stringify([
        { id: 'olcum', title: 'Kilo ve bel ölçümü', day, fields: [{ key: 'kg', label: 'Kilo', unit: 'kg' }, { key: 'cm', label: 'Bel', unit: 'cm' }] },
      ]),
      'utf8',
    );
  }

  const bulletin = new BulletinService({
    ...(config.mock ? { promptFile: join(examples, 'bulletin.prompt.example.md'), from: 0 } : config.bulletin),
    dataDir,
    env: config.mock ? {} : process.env,
    publish: send,
    log,
    portfolio: portfolioMaker,
    ...(config.mock
      ? { spawn: mockCodex, findCodex: () => 'codex (mock)', readSheet: async () => mockSheet() }
      : { readSheet: config.sheets ? () => readGoogleSheet(config.sheets!) : undefined }),
  });
  const reminders = new RemindersService({ file: remindersFile, dataDir, publish: send, log });

  return {
    services: {
      messages: () => [JSON.stringify(bulletin.message), JSON.stringify(reminders.message())],
      opened: () => bulletin.opened(),
      command: (command, reply) => {
        switch (command.type) {
          case 'bridge.bulletin.run':
            void bulletin.runNow();
            break;
          case 'bridge.reminder.save':
            void reminders.save(command.id, command.values).then((saved) => {
              if (!saved) log.warn(`reminder ${command.id}: refused`);
              else {
                const chart = reminders.measurements(command.id);
                if (chart) reply(JSON.stringify(chart));
              }
            });
            break;
          case 'bridge.measurements.get': {
            const chart = reminders.measurements(command.id);
            if (chart) reply(JSON.stringify(chart));
            break;
          }
        }
      },
    },
    start: async () => {
      await reminders.start();
      await bulletin.start();
    },
    stop: () => {
      bulletin.stop();
      reminders.stop();
    },
  };
}
