import { useEffect, useRef, type ReactNode } from 'react'

type Props = { errors: number; label: string }

export function HangmanDrawing({ errors, label }: Props) {
  const previousErrors = useRef(errors)
  const animatePart = (partError: number) => partError > previousErrors.current && partError <= errors

  useEffect(() => {
    previousErrors.current = errors
  }, [errors])

  const part = (partError: number, shape: ReactNode) => errors >= partError && (
    <g className={`hangman-part${animatePart(partError) ? ' hangman-part--entering' : ''}`}>
      {shape}
    </g>
  )

  return (
    <svg className="hangman" width="240" height="260" viewBox="0 0 240 260" role="img" aria-label={`${label}: ${errors} / 6`}>
      <g className="gallows" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="8">
        <path d="M28 240h184M62 240V20h112v28M43 20h38" />
      </g>
      <g className={`figure${errors === 6 ? ' figure--complete' : ''}`} fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="7">
        {part(1, <circle cx="174" cy="76" r="27" />)}
        {part(2, <path d="M174 103v67" />)}
        {part(3, <path d="m174 122-38 30" />)}
        {part(4, <path d="m174 122 38 30" />)}
        {part(5, <path d="m174 170-31 44" />)}
        {part(6, <path d="m174 170 31 44" />)}
      </g>
    </svg>
  )
}
