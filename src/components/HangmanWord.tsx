import { isGuessableCharacter, normalizeGuess } from '../game/game'
import type { LanguageConfig } from '../game/languages'

type Props = { word: string; guesses: ReadonlySet<string>; config: LanguageConfig; reveal: boolean }

export function HangmanWord({ word, guesses, config, reveal }: Props) {
  return (
    <div className="word" aria-label={config.translations.progressLabel}>
      {[...word].map((character, index) => {
        const guessable = isGuessableCharacter(character, config)
        const visible = !guessable || reveal || guesses.has(normalizeGuess(character, config) ?? '')
        return <span key={`${character}-${index}`} className={guessable ? 'letter' : 'punctuation'}>
          {visible ? character : <span aria-hidden="true">&nbsp;</span>}
          {!visible && <span className="sr-only">_</span>}
        </span>
      })}
    </div>
  )
}
