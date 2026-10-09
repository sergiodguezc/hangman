/** One displayed word of the secret (characters between spaces), with its offset in the full display word. */
export type WordGroup = { start: number; characters: string[] }

export function groupDisplayWord(characters: readonly string[]): WordGroup[] {
  const words: WordGroup[] = []
  let start = 0
  let current: string[] = []
  characters.forEach((character, index) => {
    if (character === ' ') {
      if (current.length) words.push({ start, characters: current })
      current = []; start = index + 1
    } else {
      if (!current.length) start = index
      current.push(character)
    }
  })
  if (current.length) words.push({ start, characters: current })
  return words
}

/** Splits a word that does not fit `whole` tiles into the fewest balanced rows (23 letters with 12 → 11 + 12), so long
 * words wrap onto rows of similar length instead of scrolling sideways. A word that fits stays whole. Every row but the
 * last carries the continuation mark, so those rows hold at most `perRow` tiles; spare letters go to the last rows. */
export function splitWord<T>(characters: readonly T[], whole: number | null, perRow = whole): T[][] {
  const length = characters.length
  if (!whole || !perRow || perRow < 2 || length <= whole) return [[...characters]]
  for (let parts = 2; ; parts++) {
    const base = Math.floor(length / parts), extra = length % parts
    const size = (part: number) => base + (part >= parts - extra ? 1 : 0)
    if (size(parts - 2) > perRow || size(parts - 1) > whole) continue
    const rows: T[][] = []
    for (let part = 0, offset = 0; part < parts; offset += size(part), part++) rows.push(characters.slice(offset, offset + size(part)))
    return rows
  }
}

/** Text alternative for the board: every position, a word for unrevealed letters (screen readers often skip "_" at
 * default punctuation levels) and a comma between words. */
export function spokenWord(groups: readonly WordGroup[], blank: string) {
  return groups.map(({ characters }) => characters.map((character) => character === '_' ? blank : character).join(' ')).join(', ')
}
