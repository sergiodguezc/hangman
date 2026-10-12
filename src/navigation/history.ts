/** Every entry the app writes records its position, so a popstate can tell how far, and which way, the browser moved. */
export type AppHistoryState = { penjatIndex: number }

export function historyIndex(state: unknown): number | null {
  const index = (state as Partial<AppHistoryState> | null)?.penjatIndex
  return typeof index === 'number' && Number.isInteger(index) ? index : null
}

export type HistoryMove =
  | { action: 'ignore' }
  | { action: 'apply' }
  /** Undo the browser's move (`delta` back to the shown page, or push it again when unknown) and confirm first. */
  | { action: 'confirm'; delta: number | null }

/**
 * Decides what a popstate means. `guarded` is true while leaving would end a game or room; `allowed` is set once the
 * player confirmed and the app replays the move itself.
 */
export function resolveHistoryMove({ currentIndex, targetIndex, currentUrl, targetUrl, guarded, allowed }: {
  currentIndex: number; targetIndex: number | null; currentUrl: string; targetUrl: string; guarded: boolean; allowed: boolean
}): HistoryMove {
  // Our own undo landing back on the shown entry, or a fragment-only change, is not a page change.
  if (targetIndex === currentIndex || (targetIndex === null && targetUrl === currentUrl)) return { action: 'ignore' }
  if (!guarded || allowed) return { action: 'apply' }
  return { action: 'confirm', delta: targetIndex === null ? null : targetIndex - currentIndex }
}
