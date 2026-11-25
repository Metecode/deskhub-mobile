// Home's grid without what the panel shows already. The widgets next to the room that leaves grow into
// it; cells the user left empty stay empty.
import { GRID_COLS, GRID_ROWS, visibleWidgets, type GridItem, type Home, type Page, type Widget } from '@deskhub-mobile/protocol';

const IN_PANEL: ReadonlySet<Widget> = new Set(['clock', 'weather', 'events']);

type Rect = Pick<GridItem, 'x' | 'y' | 'w' | 'h'>;

const cellsOf = ({ x, y, w, h }: Rect): number[] => {
  const cells: number[] = [];
  for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) cells.push(row * GRID_COLS + col);
  return cells;
};

/** One row or column more on each side: the cells it takes and what it becomes. */
function* steps({ x, y, w, h }: Rect): Generator<{ takes: Rect; becomes: Rect }> {
  if (y + h < GRID_ROWS) yield { takes: { x, y: y + h, w, h: 1 }, becomes: { x, y, w, h: h + 1 } };
  if (y > 0) yield { takes: { x, y: y - 1, w, h: 1 }, becomes: { x, y: y - 1, w, h: h + 1 } };
  if (x + w < GRID_COLS) yield { takes: { x: x + w, y, w: 1, h }, becomes: { x, y, w: w + 1, h } };
  if (x > 0) yield { takes: { x: x - 1, y, w: 1, h }, becomes: { x: x - 1, y, w: w + 1, h } };
}

export function homeGrid(home: Home, pages: readonly Page[]): GridItem[] {
  const shown = visibleWidgets(home, pages);
  const kept = shown.filter(({ widget }) => !IN_PANEL.has(widget)).map((item) => ({ ...item }));
  // Better twice than nothing.
  if (kept.length === 0) return shown;
  const free = new Set(shown.filter(({ widget }) => IN_PANEL.has(widget)).flatMap(cellsOf));
  // Widgets may overlap; what is under another isn't free.
  for (const item of kept) for (const cell of cellsOf(item)) free.delete(cell);

  // In turn and one step at a time, so that neighbours share the room.
  for (let grew = true; grew; ) {
    grew = false;
    for (const item of kept) {
      for (const { takes, becomes } of steps(item)) {
        const cells = cellsOf(takes);
        if (!cells.every((cell) => free.has(cell))) continue;
        for (const cell of cells) free.delete(cell);
        Object.assign(item, becomes);
        grew = true;
        break;
      }
    }
  }
  return kept;
}
