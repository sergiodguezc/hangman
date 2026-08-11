type Props = { errors: number; label: string }

export function HangmanDrawing({ errors, label }: Props) {
  return (
    <svg className="hangman" viewBox="0 0 240 260" role="img" aria-label={`${label}: ${errors} / 6`}>
      <g className="gallows" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="8">
        <path d="M28 240h184M62 240V20h112v28M43 20h38" />
      </g>
      <g className="figure" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="7">
        {errors >= 1 && <circle cx="174" cy="76" r="27" />}
        {errors >= 2 && <path d="M174 103v67" />}
        {errors >= 3 && <path d="m174 122-38 30" />}
        {errors >= 4 && <path d="m174 122 38 30" />}
        {errors >= 5 && <path d="m174 170-31 44" />}
        {errors >= 6 && <path d="m174 170 31 44" />}
      </g>
    </svg>
  )
}
