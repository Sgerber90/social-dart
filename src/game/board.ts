/** Board geometry helpers (framework-independent). */
export const BOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

/**
 * Radii on a 0-100 scale. Triple and double rings are slightly wider than
 * regulation so they're comfortable to tap on a phone.
 */
export const RINGS = {
  bull: 7.5,
  outerBull: 15,
  tripleIn: 52,
  tripleOut: 64,
  doubleIn: 86,
  doubleOut: 100,
  numbers: 118,
}

export function segmentAngle(index: number): { start: number; end: number; mid: number } {
  const mid = -90 + index * 18
  return { start: mid - 9, end: mid + 9, mid }
}
