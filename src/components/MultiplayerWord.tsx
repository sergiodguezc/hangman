import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { normalizeGuess, type Language } from '../../shared/game'
import { groupDisplayWord, splitWord, spokenWord } from '../multiplayer/wordRows'

type Props = { displayWord: string[]; language: Language; label: (letters: number) => string; blank: string }
type Fit = { whole: number; perRow: number }

/** The secret's progress on the multiplayer board. Tiles grow to fill the board; a word that cannot fit even at the
 * smallest readable tile (--min-tile) wraps onto balanced rows ending in a continuation mark, so the whole word is always
 * visible instead of hiding behind a sideways scroll. Assistive technology reads one text alternative with every position. */
export function MultiplayerWord({ displayWord, language, label, blank }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<Fit | null>(null)
  const [overflowing, setOverflowing] = useState(false)
  const groups = groupDisplayWord(displayWord)
  const longest = Math.max(1, ...groups.map(({ characters }) => characters.length))

  // Capacity at the minimum tile, from the board's real width and the CSS minimum, letter gap and mark width.
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => {
      const style = getComputedStyle(element)
      const minTile = parseFloat(style.getPropertyValue('--min-tile')) || 18
      const mark = parseFloat(style.getPropertyValue('--continuation-width')) || 0
      const gap = parseFloat(getComputedStyle(element.querySelector('.multiplayer-word-group') ?? element).columnGap) || 0
      const width = element.clientWidth
      const next = { whole: Math.floor((width + gap) / (minTile + gap)), perRow: Math.floor((width - mark) / (minTile + gap)) }
      setFit((current) => current?.whole === next.whole && current.perRow === next.perRow ? current : next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [longest])
  // Only a board too narrow for any wrapping (e.g. extreme zoom) still scrolls; it is then keyboard-focusable.
  useLayoutEffect(() => { const element = ref.current; if (element) setOverflowing(element.scrollWidth > element.clientWidth + 1) }, [fit, longest])

  const words = groups.map(({ start, characters }) => ({ start, rows: splitWord(characters.map((character, offset) => ({ character, index: start + offset })), fit?.whole ?? null, fit?.perRow) }))
  const tiles = Math.max(1, ...words.flatMap(({ rows }) => rows.map((row) => row.length)))
  const split = words.some(({ rows }) => rows.length > 1)
  const letters = displayWord.filter((character) => character === '_' || normalizeGuess(character, language)).length
  const tile = (part: { character: string; index: number }[], continues: boolean) => <span className={`multiplayer-word-group${continues ? ' continues' : ''}`} key={part[0]?.index}>
    {part.map(({ character, index }) => <span key={index} className={character === '_' ? 'blank' : normalizeGuess(character, language) ? 'letter' : 'punctuation'}>{character === '_' ? '\u00a0' : character}</span>)}
  </span>
  return <div ref={ref} className={`multiplayer-word-scroll${split ? ' is-split' : ''}`} style={{ '--longest-word': tiles } as CSSProperties}
    role="group" aria-label={label(letters)} tabIndex={overflowing ? 0 : undefined}>
    <p className="sr-only">{spokenWord(groups, blank)}</p>
    <div className="multiplayer-word" aria-hidden="true">{words.map(({ start, rows }) => rows.length === 1 ? tile(rows[0], false)
      : <span className="multiplayer-word-split" key={start}>{rows.map((row, index) => tile(row, index < rows.length - 1))}</span>)}</div>
  </div>
}
