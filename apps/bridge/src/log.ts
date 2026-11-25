export interface Logger {
  info(message: string): void;
  warn(message: string): void;
}

const line = (level: string, message: string) => `${new Date().toISOString()} ${level} ${message}`;

export const consoleLogger: Logger = {
  info: (message) => console.log(line('INFO', message)),
  warn: (message) => console.warn(line('WARN', message)),
};

/** Warnings logged per minute, at most. */
export const MAX_WARNINGS = 20;
/** Characters of each. */
const MAX_LENGTH = 500;
const MINUTE_MS = 60_000;

/**
 * For warnings that anyone on the network can cause, with text they sent: not so many that they fill
 * the disk, and no control characters, which a terminal would obey.
 */
export function limitWarnings(log: Logger): Logger {
  let since = -Infinity;
  let count = 0;
  return {
    info: (message) => log.info(message),
    warn: (message) => {
      const now = Date.now();
      // Also when the clock was set back.
      if (now - since >= MINUTE_MS || now < since) {
        if (count > MAX_WARNINGS) log.warn(`${count - MAX_WARNINGS} more warnings were left out`);
        since = now;
        count = 0;
      }
      count++;
      if (count > MAX_WARNINGS) return;
      log.warn(message.slice(0, MAX_LENGTH).replace(/[\x00-\x09\x0b-\x1f\x7f-\x9f]/g, '?'));
    },
  };
}

export const silentLogger: Logger = { info() {}, warn() {} };
