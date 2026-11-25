export interface Logger {
  info(message: string): void;
  warn(message: string): void;
}

const line = (level: string, message: string) => `${new Date().toISOString()} ${level} ${message}`;

export const consoleLogger: Logger = {
  info: (message) => console.log(line('INFO', message)),
  warn: (message) => console.warn(line('WARN', message)),
};

export const silentLogger: Logger = { info() {}, warn() {} };
