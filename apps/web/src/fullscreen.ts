/**
 * Goes fullscreen on a tap, since browsers only allow it from a gesture. Touch only:
 * a mouse click on a desktop shouldn't. Also turns the screen to landscape, where
 * the browser lets us.
 */
export function goFullscreenOnTap(): void {
  document.addEventListener('click', (e) => {
    const touch = e instanceof PointerEvent && e.pointerType === 'touch';
    const onControl = e.target instanceof Element && e.target.closest('input, button');
    if (!touch || onControl || document.fullscreenElement) return;
    void enter();
  });
}

async function enter(): Promise<void> {
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    // Not in TypeScript's DOM types.
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await orientation.lock?.('landscape');
  } catch {
    // Not supported or not allowed: stay as we are.
  }
}
