type Props = {
  alphabet: readonly string[]
  guesses: ReadonlySet<string>
  incorrect: ReadonlySet<string>
  disabled: boolean
  label: string
  onGuess: (letter: string) => void
}

export function Keyboard({ alphabet, guesses, incorrect, disabled, label, onGuess }: Props) {
  return (
    <div className="keyboard" aria-label={label}>
      {alphabet.map((letter) => {
        const guessed = guesses.has(letter)
        const state = guessed ? (incorrect.has(letter) ? 'incorrect' : 'correct') : ''
        return <button key={letter} type="button" className={state} disabled={disabled || guessed}
          aria-label={letter} onClick={() => onGuess(letter)}>{letter}</button>
      })}
    </div>
  )
}
