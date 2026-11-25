// The shortcuts page's rules. The phone only knows a tile's name, icon and colour, not what it does.

/** Columns for `n` tiles. */
export const tileColumns = (n: number): number => (n <= 4 ? 2 : n <= 6 || n === 9 ? 3 : 4);

/** How long the second touch may take, ms. */
export const CONFIRM_MS = 4000;

/** The power icon is for what would be a nuisance by mistake (sleep, shutdown): it takes two touches. */
export const needsConfirming = (icon: string): boolean => icon === 'power_settings_new';
