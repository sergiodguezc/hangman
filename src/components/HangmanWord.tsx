import type { CSSProperties } from 'react'
import { displayWord, normalizeGuess, type Language } from '../../shared/game'

type Props = { word: string; guesses: ReadonlySet<string>; language: Language; reveal: boolean; label: string }

export function HangmanWord({ word, guesses, language, reveal, label }: Props) {
  const visibleCharacters = displayWord(word, guesses, language, reveal)
  return (
    <div className="word" role="group" aria-label={label} style={{ '--letters': [...word].length } as CSSProperties}>
      {[...word].map((character, index) => {
        const guessable = normalizeGuess(character, language) !== null
        const visible = visibleCharacters[index] !== '_'
        return <span key={`${character}-${index}`} className={guessable ? 'letter' : 'punctuation'}>
          {visible ? character : <span aria-hidden="true">&nbsp;</span>}
          {!visible && <span className="sr-only">_</span>}
        </span>
      })}
    </div>
  )
}
